/**
 * Money lives in the database as integer paise. It becomes a string exactly
 * once, here, at the edge of the UI.
 */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/**
 * 119900 → "₹ 1,199". Falls back to two decimals when the amount isn't whole
 * rupees.
 *
 * The space after the symbol is deliberate and is why this does not just return
 * what Intl gives it. Set solid, "₹1,199" reads as one word and the symbol
 * crowds the first digit — worst at display sizes, which is where a price is
 * most often set. Indian retail sets it open, and so does every reference we
 * checked. One space, applied here, so no caller has to remember.
 */
export function formatPaise(paise: number) {
  const rupees = paise / 100;
  const formatted = Number.isInteger(rupees) ? inr.format(rupees) : inrWithPaise.format(rupees);
  return formatted.replace("₹", "₹ ");
}

/** For number inputs in admin: 119900 → "1199.00" */
export function paiseToRupeeInput(paise: number) {
  return (paise / 100).toFixed(2);
}

/** For admin form submission: "1199" | "1199.50" → 119900 | 119950 */
export function rupeeInputToPaise(value: string | number) {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function discountPercent(mrpPaise: number, pricePaise: number) {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return dateFmt.format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return dateTimeFmt.format(new Date(date));
}

/** "AVN-7K2QX9" — short, unambiguous, safe to read over a phone. */
export function generateOrderNumber() {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY3456789"; // no I/O/0/1/2/B/S/Z
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `AVN-${out}`;
}

export function titleCase(input: string) {
  return input
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
