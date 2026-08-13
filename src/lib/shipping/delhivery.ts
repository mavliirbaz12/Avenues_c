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
    // Deterministic synthetic AWB per order, so retries reuse the same number.
    const waybill = `MOCK${String(hashCode(args.orderNumber)).padStart(10, "0")}`;
    return { waybill, mock: true, raw: { mock: true, createdFor: args.orderNumber } };
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
    pickup_location: { name: env.DELHIVERY_PICKUP_NAME },
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

  const statusWord = (shipment.Status?.Status ?? "").toLowerCase();
  const status: TrackingResult["status"] = statusWord.includes("delivered")
    ? statusWord.includes("rto")
      ? "RTO"
      : "DELIVERED"
    : statusWord.includes("out for delivery") || statusWord.includes("dispatched")
      ? "OUT_FOR_DELIVERY"
      : statusWord.includes("rto")
        ? "RTO"
        : statusWord.includes("manifest") || statusWord.includes("not picked")
          ? "PICKUP_PENDING"
          : "IN_TRANSIT";

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
