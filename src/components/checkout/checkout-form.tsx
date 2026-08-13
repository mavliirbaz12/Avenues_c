"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Banknote, Check, MapPin, Loader2 } from "lucide-react";
import { AddressFields } from "@/components/account/address-fields";
import type { SavedAddress } from "@/components/account/address-book";
import { CartSummary, FreeShippingMeter } from "@/components/cart/cart-summary";
import { CouponField } from "@/components/cart/coupon-field";
import { useCart } from "@/store/cart";
import { usePricedCart } from "@/hooks/use-priced-cart";
import { useRazorpay } from "@/hooks/use-razorpay";
import { useRouter } from "next/navigation";
import { formatPaise } from "@/lib/format";
import { ADDRESS_TYPE_LABELS, PINCODE_REGEX } from "@/lib/constants/india";
import { cn } from "@/lib/utils";

type PincodeState =
  | { status: "idle" }
  | { status: "checking"; pin: string }
  | { status: "ok"; pin: string; city: string | null; codAvailable: boolean }
  | { status: "blocked"; pin: string };

export function CheckoutForm({
  user,
  savedAddresses,
}: {
  user: { name: string; email: string; phone: string } | null;
  savedAddresses: SavedAddress[];
}) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const couponCode = useCart((s) => s.couponCode);
  const clearCart = useCart((s) => s.clear);

  const [method, setMethod] = useState<"RAZORPAY" | "COD">("RAZORPAY");
  const { priced, loading } = usePricedCart(method);
  const { launch } = useRazorpay();

  const defaultAddressId = savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id;
  const [addressId, setAddressId] = useState<string | "new" | undefined>(defaultAddressId ?? "new");
  const usingSaved = addressId !== undefined && addressId !== "new";

  const [pincode, setPincode] = useState<PincodeState>({ status: "idle" });
  const [terms, setTerms] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Serviceability for a chosen saved address is checked automatically.
  const savedPin = usingSaved
    ? savedAddresses.find((a) => a.id === addressId)?.pincode
    : undefined;

  useEffect(() => {
    if (savedPin) void checkPin(savedPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPin]);

  async function checkPin(pin: string) {
    if (!PINCODE_REGEX.test(pin)) return;
    setPincode({ status: "checking", pin });
    try {
      const res = await fetch(`/api/pincode?pin=${pin}`);
      const data = await res.json();
      setPincode(
        data.serviceable
          ? { status: "ok", pin, city: data.city, codAvailable: data.codAvailable }
          : { status: "blocked", pin },
      );
    } catch {
      // A check that errors must not block a paying customer.
      setPincode({ status: "ok", pin, city: null, codAvailable: true });
    }
  }

  const codBlocked =
    (priced !== null && !priced.codEnabled) ||
    (pincode.status === "ok" && !pincode.codAvailable);

  useEffect(() => {
    if (codBlocked && method === "COD") setMethod("RAZORPAY");
  }, [codBlocked, method]);

  const empty = lines.length === 0;

  const prefill = useMemo(
    () => ({ name: user?.name, email: user?.email, contact: user?.phone }),
    [user],
  );

  async function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (placing) return;
    setError("");
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const read = (k: string) => String(form.get(k) ?? "").trim();

    const payload: Record<string, unknown> = {
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      email: read("email").toLowerCase(),
      phone: read("contactPhone"),
      paymentMethod: method,
      couponCode: couponCode ?? null,
      customerNote: read("customerNote") || null,
      termsAccepted: terms,
    };

    if (usingSaved) {
      payload.addressId = addressId;
    } else {
      payload.address = {
        fullName: read("fullName"),
        phone: read("phone"),
        altPhone: read("altPhone"),
        line1: read("line1"),
        line2: read("line2"),
        landmark: read("landmark"),
        city: read("city"),
        state: read("state"),
        pincode: read("pincode"),
      };
      payload.saveToBook = form.get("saveToBook") === "on";
    }

    if (!terms) {
      setError("Please accept the terms and privacy policy to continue.");
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. You have not been charged.");
        if (data.fieldErrors) {
          // API keys are like "address.line1"; the fields use bare names.
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.fieldErrors as Record<string, string>)) {
            mapped[k.replace(/^address\./, "")] = v;
          }
          setFieldErrors(mapped);
        }
        setPlacing(false);
        return;
      }

      if (data.payment.kind === "COD") {
        clearCart();
        router.push(`/order/${data.orderNumber}?t=${data.accessToken}&placed=1`);
        return;
      }

      // Prepaid: hand over to the gateway (or the mock simulator). The cart
      // is cleared only after payment succeeds — see the order page.
      await launch(
        {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          accessToken: data.accessToken,
          razorpayOrderId: data.payment.razorpayOrderId,
          keyId: data.payment.keyId,
          amountPaise: data.payment.amountPaise,
          mock: data.payment.mock,
          prefill,
        },
        {
          onError: (message) => {
            setError(message);
            setPlacing(false);
          },
          onDismiss: () => {
            setError(
              "Payment was cancelled. Your order is saved — you can pay for it from the order page, or try again now.",
            );
            setPlacing(false);
          },
        },
      );
    } catch {
      setError("Something went wrong. You have not been charged.");
      setPlacing(false);
    }
  }

  if (empty) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-d4 font-light text-bone">Nothing to check out</p>
        <p className="mx-auto mt-4 max-w-sm font-sans text-body-lg text-stone">
          Your cart is empty. The five are waiting.
        </p>
        <Link href="/shop" className="btn btn-outline btn-lg mt-8">
          Shop the five
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={placeOrder} className="grid gap-12 lg:grid-cols-12 lg:gap-16" noValidate>
      <div className="space-y-10 lg:col-span-7">
        {/* Contact */}
        <section aria-labelledby="co-contact">
          <SectionHeading id="co-contact" step={1} title="Contact" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="co-email" className="field-label">
                Email
              </label>
              <input
                id="co-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={user?.email ?? ""}
                placeholder="your@email.com"
                className={cn("field", fieldErrors.email && "field-error")}
              />
              {fieldErrors.email && <span className="field-msg-error">{fieldErrors.email}</span>}
              {!user && (
                <span className="field-hint">
                  No account needed — your order confirmation and tracking link land here.
                </span>
              )}
            </div>
            <div>
              <label htmlFor="co-phone" className="field-label">
                Phone
              </label>
              <input
                id="co-phone"
                name="contactPhone"
                type="tel"
                inputMode="numeric"
                required
                autoComplete="tel"
                defaultValue={user?.phone ?? ""}
                placeholder="10-digit mobile"
                className={cn("field", fieldErrors.phone && "field-error")}
              />
              {fieldErrors.phone && <span className="field-msg-error">{fieldErrors.phone}</span>}
            </div>
          </div>
        </section>

        <div className="rule" />

        {/* Address */}
        <section aria-labelledby="co-address">
          <SectionHeading id="co-address" step={2} title="Delivery address" />

          {savedAddresses.length > 0 && (
            <div className="mt-6 space-y-3">
              {savedAddresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-4 border p-4 transition-colors duration-400 ease-smoke",
                    addressId === a.id ? "border-gold/55 bg-gold/[0.05]" : "border-line hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="addressChoice"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    className="sr-only"
                  />
                  <MapPin
                    className={cn("mt-0.5 h-4 w-4 shrink-0", addressId === a.id ? "text-gold" : "text-stone-dark")}
                    strokeWidth={1.4}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-sans text-sm text-bone">{a.fullName}</span>
                      <span className="micro-label">{ADDRESS_TYPE_LABELS[a.type]}</span>
                      {a.isDefault && <span className="micro-label-gold">Default</span>}
                    </span>
                    <span className="mt-1 block font-sans text-xs leading-relaxed text-stone">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                    </span>
                  </span>
                </label>
              ))}

              <label
                className={cn(
                  "flex cursor-pointer items-center gap-4 border p-4 transition-colors duration-400 ease-smoke",
                  addressId === "new" ? "border-gold/55 bg-gold/[0.05]" : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="addressChoice"
                  checked={addressId === "new"}
                  onChange={() => setAddressId("new")}
                  className="sr-only"
                />
                <span className="font-sans text-sm text-bone">Deliver somewhere else</span>
              </label>
            </div>
          )}

          {!usingSaved && (
            <div className="mt-6">
              <AddressFields
                errors={fieldErrors}
                showDefaultToggle={false}
                showSaveToggle={Boolean(user)}
                idPrefix="co"
              />
              <PincodeProbe onCheck={checkPin} state={pincode} />
            </div>
          )}

          {usingSaved && <PincodeBadge state={pincode} />}
        </section>

        <div className="rule" />

        {/* Payment */}
        <section aria-labelledby="co-payment">
          <SectionHeading id="co-payment" step={3} title="Payment" />

          <div className="mt-6 space-y-3">
            <PayOption
              checked={method === "RAZORPAY"}
              onSelect={() => setMethod("RAZORPAY")}
              icon={<CreditCard className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />}
              title="Pay now"
              detail="UPI, cards, netbanking and wallets, via Razorpay."
            />
            <PayOption
              checked={method === "COD"}
              onSelect={() => setMethod("COD")}
              disabled={codBlocked}
              icon={<Banknote className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />}
              title="Cash on delivery"
              detail={
                codBlocked
                  ? "Not available for this order or pincode."
                  : priced && priced.codFeeIfChosenPaise > 0
                    ? `Pay when it arrives. Adds a ${formatPaise(priced.codFeeIfChosenPaise)} handling fee.`
                    : "Pay when it arrives."
              }
            />
          </div>

          <div className="mt-6">
            <label htmlFor="co-note" className="field-label">
              Order note (optional)
            </label>
            <textarea
              id="co-note"
              name="customerNote"
              rows={2}
              placeholder="Anything the person packing your order should know."
              className="field resize-y"
            />
          </div>

          <label htmlFor="co-terms" className="mt-6 flex cursor-pointer items-start gap-3">
            <input
              id="co-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative mt-0.5 h-[1.1rem] w-[1.1rem] shrink-0 border border-line-strong
                         transition-colors duration-300 peer-checked:border-gold peer-checked:bg-gold
                         peer-focus-visible:outline peer-focus-visible:outline-2
                         peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-light"
            >
              <Check
                className={cn(
                  "absolute inset-0 h-full w-full p-0.5 text-ink transition-opacity",
                  terms ? "opacity-100" : "opacity-0",
                )}
                strokeWidth={3}
              />
            </span>
            <span className="font-sans text-sm leading-relaxed text-stone">
              I agree to the{" "}
              <Link href="/policies/terms" target="_blank" className="text-gold underline underline-offset-4">
                terms of service
              </Link>{" "}
              and{" "}
              <Link href="/policies/privacy" target="_blank" className="text-gold underline underline-offset-4">
                privacy policy
              </Link>
              .
            </span>
          </label>
        </section>

        {error && (
          <p className="border border-danger/40 bg-danger/[0.06] px-4 py-3.5 font-sans text-sm leading-relaxed text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:col-span-5">
        <div className="card space-y-6 p-6 sm:p-8 lg:sticky lg:top-[calc(var(--nav-h)+2rem)]">
          <h2 className="font-display text-2xl font-light text-bone">Your order</h2>

          <ul className="divide-y divide-line border-y border-line">
            {(priced?.lines ?? []).map((l) => (
              <li key={l.variantId} className="flex items-baseline justify-between gap-4 py-3.5">
                <span className="min-w-0 font-sans text-sm text-bone">
                  {l.name.replace(/^Avenues\s+/i, "")}
                  <span className="text-stone-dark"> · {l.size} × {l.quantity}</span>
                </span>
                <span className="shrink-0 font-sans text-sm tabular-nums text-bone">
                  {formatPaise(l.totalPaise)}
                </span>
              </li>
            ))}
          </ul>

          <FreeShippingMeter priced={priced} />
          <CouponField outcome={priced?.coupon} loading={loading} />
          <CartSummary priced={priced} loading={loading} showCodFee />

          <button
            type="submit"
            disabled={placing || loading || !priced}
            className="btn btn-primary btn-lg w-full"
          >
            {placing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin-slow" strokeWidth={1.6} />
                {method === "COD" ? "Placing order" : "Opening payment"}
              </>
            ) : method === "COD" ? (
              `Place order · ${priced ? formatPaise(priced.totalPaise) : ""}`
            ) : (
              `Pay ${priced ? formatPaise(priced.totalPaise) : ""}`
            )}
          </button>

          <p className="text-center font-sans text-xs leading-relaxed text-stone-dark">
            Prices are recalculated on our servers at this step — what you see
            is exactly what you are charged.
          </p>
        </div>
      </aside>
    </form>
  );
}

function SectionHeading({ id, step, title }: { id: string; step: number; title: string }) {
  return (
    <h2 id={id} className="flex items-baseline gap-4">
      <span className="font-sans text-micro text-stone-dark">{String(step).padStart(2, "0")}</span>
      <span className="font-display text-d5 font-light text-bone">{title}</span>
    </h2>
  );
}

function PayOption({
  checked,
  onSelect,
  icon,
  title,
  detail,
  disabled,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-4 border p-4 transition-colors duration-400 ease-smoke",
        disabled
          ? "cursor-not-allowed opacity-45"
          : checked
            ? "cursor-pointer border-gold/55 bg-gold/[0.05]"
            : "cursor-pointer border-line hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      <span className={cn("mt-0.5", checked ? "text-gold" : "text-stone-dark")}>{icon}</span>
      <span>
        <span className="block font-sans text-sm text-bone">{title}</span>
        <span className="mt-0.5 block font-sans text-xs leading-relaxed text-stone">{detail}</span>
      </span>
    </label>
  );
}

/** Watches the inline pincode field and reports serviceability as you type. */
function PincodeProbe({
  onCheck,
  state,
}: {
  onCheck: (pin: string) => void;
  state: PincodeState;
}) {
  useEffect(() => {
    const input = document.getElementById("co-pincode") as HTMLInputElement | null;
    if (!input) return;
    const handler = () => {
      if (PINCODE_REGEX.test(input.value.trim())) onCheck(input.value.trim());
    };
    input.addEventListener("blur", handler);
    input.addEventListener("input", () => {
      if (input.value.trim().length === 6) handler();
    });
    return () => input.removeEventListener("blur", handler);
  }, [onCheck]);

  return <PincodeBadge state={state} />;
}

function PincodeBadge({ state }: { state: PincodeState }) {
  if (state.status === "idle") return null;

  if (state.status === "checking") {
    return (
      <p className="mt-4 flex items-center gap-2.5 font-sans text-xs text-stone" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin-slow text-gold" strokeWidth={1.6} />
        Checking delivery to {state.pin}
      </p>
    );
  }

  if (state.status === "blocked") {
    return (
      <p className="mt-4 border border-danger/40 bg-danger/[0.06] px-4 py-3 font-sans text-xs leading-relaxed text-danger" role="alert">
        We can&rsquo;t deliver to {state.pin} yet. Try a different address, or
        write to us and we&rsquo;ll find a way.
      </p>
    );
  }

  return (
    <p className="mt-4 flex items-center gap-2.5 font-sans text-xs text-gold-light" role="status">
      <Check className="h-3.5 w-3.5" strokeWidth={2} />
      Delivery available to {state.pin}
      {state.city ? ` (${state.city})` : ""}
      {!state.codAvailable && <span className="text-stone"> · prepaid only</span>}
    </p>
  );
}
