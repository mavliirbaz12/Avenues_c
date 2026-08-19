import { env, integrations } from "@/lib/env";
import { PINCODE_REGEX } from "@/lib/constants/india";
import { hashCode } from "@/lib/utils";

/**
 * Delhivery client with a first-class MOCK MODE.
 *
 * No API token ⇒ pincode checks answer from an offline heuristic and shipment
 * creation issues a synthetic AWB. Mock tracking advances deterministically
 * with elapsed time, so the "Order Journey" timeline can be watched moving
 * without a courier account. Every mock artefact is clearly marked.
 */

export const delhiveryLive = integrations.delhivery;

const BASE = env.DELHIVERY_BASE_URL.replace(/\/$/, "");

type PincodeResult = {
  serviceable: boolean;
  codAvailable: boolean;
  city: string | null;
  state: string | null;
  mock: boolean;
};

export async function checkPincode(pincode: string): Promise<PincodeResult> {
  if (!PINCODE_REGEX.test(pincode)) {
    return { serviceable: false, codAvailable: false, city: null, state: null, mock: !delhiveryLive };
  }

  if (!delhiveryLive) {
    // Offline heuristic: every well-formed pincode is serviceable. One
    // reserved test pin lets the "not serviceable" path be exercised.
    if (pincode === "999999") {
      return { serviceable: false, codAvailable: false, city: null, state: null, mock: true };
    }
    return { serviceable: true, codAvailable: true, city: null, state: null, mock: true };
  }

  try {
    const res = await fetch(
      `${BASE}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pincode)}`,
      {
        headers: { Authorization: `Token ${env.DELHIVERY_API_TOKEN}` },
        // Serviceability changes rarely; cache aggressively per pincode.
        next: { revalidate: 86_400 },
      },
    );
    if (!res.ok) throw new Error(`pincode API ${res.status}`);

    const data = (await res.json()) as {
      delivery_codes?: {
        postal_code?: {
          pin?: number;
          cod?: "Y" | "N";
          pre_paid?: "Y" | "N";
          city?: string;
          state_or_province?: string;
        };
      }[];
    };

    const hit = data.delivery_codes?.[0]?.postal_code;
    if (!hit) {
      return { serviceable: false, codAvailable: false, city: null, state: null, mock: false };
    }

    return {
      serviceable: hit.pre_paid === "Y" || hit.cod === "Y",
      codAvailable: hit.cod === "Y",
      city: hit.city ?? null,
      state: hit.state_or_province ?? null,
      mock: false,
    };
  } catch (err) {
    console.error("[delhivery] pincode check failed:", err);
    // Fail open: a courier API blip must not block checkout. COD stays on;
    // the worst case is a manual refund for a genuinely unserviceable pin.
    return { serviceable: true, codAvailable: true, city: null, state: null, mock: false };
  }
}

/* -------------------------------------------------------------------------- */
/* Shipment creation                                                           */
/* -------------------------------------------------------------------------- */

export type CreateShipmentArgs = {
  orderNumber: string;
  /**
   * The pickup location, exactly as registered in the Delhivery panel.
   *
   * Passed in rather than read from env here, so the admin-editable store
   * setting is what actually governs it — a founder changing warehouses should
   * not need a redeploy. Falls back to DELHIVERY_PICKUP_NAME.
   */
  pickupName?: string | null;
  paymentMode: "Prepaid" | "COD";
  codAmountPaise: number;
  totalPaise: number;
  weightGrams: number;
  productsDescription: string;
  consignee: {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
};

export async function createShipment(
  args: CreateShipmentArgs,
): Promise<{ waybill: string; mock: boolean; raw: unknown }> {
  if (!delhiveryLive) {
    /*
      Mock mode is for dev and the e2e suite. In production it is a trap.

      A synthetic MOCK########## waybill is written to the shipment row and
      then emailed to the customer as their tracking number — a number that
      resolves to nothing on Delhivery's site, for a parcel no courier has been
      told about. The order looks shipped in the admin panel too, so nobody
      notices until the customer asks where it is.

      Refusing here turns a silent, customer-visible failure into an actionable
      error on the admin's own screen at the moment they click Ship.
    */
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Delhivery is not configured, so no real shipment can be booked. Set " +
          "DELHIVERY_API_TOKEN in the environment and redeploy. (Refusing to " +
          "create a mock waybill in production — it would email the customer a " +
          "tracking number that does not exist.)",
      );
    }

    // Deterministic synthetic AWB per order, so retries reuse the same number.
    const waybill = `MOCK${String(hashCode(args.orderNumber)).padStart(10, "0")}`;
    return { waybill, mock: true, raw: { mock: true, createdFor: args.orderNumber } };
  }

  // Admin setting wins, env is the fallback. Delhivery matches this string
  // against a registered ClientWarehouse and rejects the whole request if it
  // is blank or misspelled — so fail here with a message that says what to do,
  // rather than surfacing "ClientWarehouse matching query does not exist".
  const pickupName = (args.pickupName || env.DELHIVERY_PICKUP_NAME || "").trim();
  if (!pickupName) {
    throw new Error(
      "No Delhivery pickup location is configured. Set it in Admin → Settings → " +
        "Pickup location name (or DELHIVERY_PICKUP_NAME), using the exact name " +
        "registered in your Delhivery panel.",
    );
  }

  const payload = {
    shipments: [
      {
        name: args.consignee.name,
        order: args.orderNumber,
        phone: args.consignee.phone,
        add: [args.consignee.line1, args.consignee.line2].filter(Boolean).join(", "),
        city: args.consignee.city,
        state: args.consignee.state,
        pin: args.consignee.pincode,
        country: "India",
        payment_mode: args.paymentMode,
        cod_amount: args.paymentMode === "COD" ? (args.codAmountPaise / 100).toFixed(2) : "0",
        total_amount: (args.totalPaise / 100).toFixed(2),
        weight: String(args.weightGrams),
        products_desc: args.productsDescription,
      },
    ],
    /*
      pickupName, not env.DELHIVERY_PICKUP_NAME.

      The guard above resolves "admin setting, else env" and refuses to proceed
      without one — but the payload then ignored that and read the env var
      directly. So configuring the warehouse ONLY in Admin → Settings passed
      validation and shipped `{ name: undefined }`, which Delhivery rejects with
      its unhelpful "ClientWarehouse matching query does not exist". The guard
      and the payload have to agree on which value they mean.
    */
    pickup_location: { name: pickupName },
  };

  // Delhivery's create API expects this exact format=json&data= body.
  const body = `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`;

  const res = await fetch(`${BASE}/api/cmu/create.json`, {
    method: "POST",
    headers: {
      Authorization: `Token ${env.DELHIVERY_API_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const raw = (await res.json().catch(() => null)) as {
    success?: boolean;
    packages?: { waybill?: string; status?: string; remarks?: string[] }[];
    rmk?: string;
  } | null;

  const waybill = raw?.packages?.[0]?.waybill;
  if (!res.ok || !raw?.success || !waybill) {
    const reason =
      raw?.packages?.[0]?.remarks?.join("; ") ?? raw?.rmk ?? `HTTP ${res.status}`;
    throw new Error(`Delhivery shipment creation failed: ${reason}`);
  }

  return { waybill, mock: false, raw };
}

/* -------------------------------------------------------------------------- */
/* Tracking                                                                    */
/* -------------------------------------------------------------------------- */

export type TrackingScan = {
  status: string;
  detail: string | null;
  location: string | null;
  occurredAt: Date;
};

export type TrackingResult = {
  /** Normalised to our ShipmentStatus vocabulary. */
  status: "PICKUP_PENDING" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO" | "FAILED";
  statusDetail: string | null;
  expectedDeliveryAt: Date | null;
  scans: TrackingScan[];
  mock: boolean;
};

/** Milestones a mock parcel walks through, one every 8 hours. */
const MOCK_JOURNEY: { status: TrackingResult["status"]; detail: string; location: string }[] = [
  { status: "PICKUP_PENDING", detail: "Shipment manifested, pickup scheduled", location: "Mumbai" },
  { status: "IN_TRANSIT", detail: "Picked up from seller", location: "Mumbai" },
  { status: "IN_TRANSIT", detail: "Arrived at sorting hub", location: "Bhiwandi HUB" },
  { status: "IN_TRANSIT", detail: "Departed for destination city", location: "Bhiwandi HUB" },
  { status: "IN_TRANSIT", detail: "Arrived at destination facility", location: "Destination city" },
  { status: "OUT_FOR_DELIVERY", detail: "Out for delivery", location: "Destination city" },
  { status: "DELIVERED", detail: "Delivered", location: "Destination city" },
];

const MOCK_STEP_MS = 8 * 60 * 60 * 1000;

/**
 * Delhivery's free-text status → our ShipmentStatus.
 *
 * ONE mapper, exported, because there were two near-identical copies — this
 * one and another in the webhook route — and they had already drifted into
 * agreeing on the happy path while both getting the unhappy one wrong.
 *
 * THE EXCEPTION BUCKET is the reason this was rewritten. Every unrecognised
 * scan used to fall through to IN_TRANSIT, so a failed delivery attempt, an
 * address problem or a parcel on hold was all reported to the customer as
 * "Moving through the network" — a reassuring milestone for a parcel that is
 * stuck and needs them to act. Those now map to FAILED so the journey can say
 * something true.
 *
 * Order matters: "rto delivered" is an RTO, not a delivery, so RTO is tested
 * before the delivered branch rather than nested inside it.
 */
export function normaliseDelhiveryStatus(raw: string): TrackingResult["status"] {
  const w = raw.toLowerCase();

  if (w.includes("rto")) return "RTO";
  if (w.includes("delivered")) return "DELIVERED";
  if (w.includes("out for delivery") || w.includes("dispatched")) return "OUT_FOR_DELIVERY";

  // NDR / exception scans. Delhivery's wording varies by scan type and none of
  // these mean the parcel is progressing.
  if (
    w.includes("undelivered") ||
    w.includes("not delivered") ||
    w.includes("delivery attempted") ||
    w.includes("attempt failed") ||
    w.includes("address incorrect") ||
    w.includes("incorrect address") ||
    w.includes("on hold") ||
    w.includes("delayed") ||
    w.includes("exception") ||
    w.includes("pending")
  ) {
    return "FAILED";
  }

  if (w.includes("manifest") || w.includes("not picked")) return "PICKUP_PENDING";
  return "IN_TRANSIT";
}

export async function trackShipment(
  waybill: string,
  opts: { shippedAt?: Date | null } = {},
): Promise<TrackingResult> {
  if (!delhiveryLive || waybill.startsWith("MOCK")) {
    // Advance one milestone every 8h since dispatch. Deterministic, so
    // refreshing the page shows a stable, believable journey.
    const start = opts.shippedAt?.getTime() ?? Date.now();
    const steps = Math.min(
      Math.floor((Date.now() - start) / MOCK_STEP_MS),
      MOCK_JOURNEY.length - 1,
    );
    const walked = MOCK_JOURNEY.slice(0, Math.max(1, steps + 1));
    const current = walked[walked.length - 1]!;

    return {
      status: current.status,
      statusDetail: current.detail,
      expectedDeliveryAt: new Date(start + (MOCK_JOURNEY.length - 1) * MOCK_STEP_MS),
      scans: walked.map((m, i) => ({
        status: m.status,
        detail: m.detail,
        location: m.location,
        occurredAt: new Date(start + i * MOCK_STEP_MS),
      })),
      mock: true,
    };
  }

  const res = await fetch(
    `${BASE}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`,
    {
      headers: { Authorization: `Token ${env.DELHIVERY_API_TOKEN}` },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Delhivery tracking failed: HTTP ${res.status}`);

  const data = (await res.json()) as {
    ShipmentData?: {
      Shipment?: {
        Status?: { Status?: string; StatusDateTime?: string; Instructions?: string };
        ExpectedDeliveryDate?: string | null;
        Scans?: {
          ScanDetail?: {
            Scan?: string;
            Instructions?: string;
            ScannedLocation?: string;
            ScanDateTime?: string;
          };
        }[];
      };
    }[];
  };

  const shipment = data.ShipmentData?.[0]?.Shipment;
  if (!shipment) throw new Error("Delhivery tracking returned no shipment");

  const status = normaliseDelhiveryStatus(shipment.Status?.Status ?? "");

  return {
    status,
    statusDetail: shipment.Status?.Instructions ?? shipment.Status?.Status ?? null,
    expectedDeliveryAt: shipment.ExpectedDeliveryDate
      ? new Date(shipment.ExpectedDeliveryDate)
      : null,
    scans: (shipment.Scans ?? [])
      .map((s) => s.ScanDetail)
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        status: s.Scan ?? "Update",
        detail: s.Instructions ?? null,
        location: s.ScannedLocation ?? null,
        occurredAt: s.ScanDateTime ? new Date(s.ScanDateTime) : new Date(),
      })),
    mock: false,
  };
}
