import { prisma } from "@/lib/prisma";

/**
 * Attaches past guest orders to a user account.
 *
 * Checkout now requires an account, so no NEW guest orders are created — but
 * orders placed before that change still exist with userId = null, and this is
 * how they find their owner.
 *
 * REQUIRES A VERIFIED EMAIL, and that is the whole point of the guard below.
 *
 * The original reasoning was "the user proved control of the address by
 * authenticating with it". That holds on sign-IN. It is false on sign-UP, where
 * the attacker picks both the email and the password: registering with a
 * stranger's address handed over every guest order that address had ever
 * placed — full shipping address, phone, line items, the GST invoice — and with
 * it the ability to cancel the victim's live order or file a return in their
 * name. The victim, having never registered, could then never claim it back.
 *
 * `emailVerified` is nullable and nothing sets it yet, so today this refuses
 * every email claim. That is the correct failure direction: customers reach
 * legacy guest orders through /track-order, which already demands the order
 * number AND the email or phone used at checkout — real proof of control,
 * rather than a self-asserted address. Wire up a verification link and set
 * `emailVerified` when it is clicked, and claiming resumes on its own.
 *
 * The phone twin below needs no such guard: it is reachable only from an
 * OTP login, which proves control of the number by construction.
 */
export async function claimGuestOrders(userId: string, email: string) {
  const normalised = email.toLowerCase();

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!account?.emailVerified) return 0;

  const result = await prisma.order.updateMany({
    where: { userId: null, email: normalised },
    data: { userId },
  });

  if (result.count > 0) {
    console.info(`[orders] attached ${result.count} guest order(s) to user ${userId}`);
  }

  return result.count;
}

/**
 * The phone-OTP twin of the email claim. Signing in with an OTP proves
 * control of the number, so guest orders placed with that contact phone
 * belong to this account. Matches on the bare 10 digits — checkout stores
 * phones as typed, which may carry a +91 or spacing.
 */
export async function claimGuestOrdersByPhone(userId: string, phone10: string) {
  if (!/^\d{10}$/.test(phone10)) return 0;

  // No SQL "digits-only" normalisation without raw queries — candidate set is
  // tiny (guest orders only), so filter in memory.
  const candidates = await prisma.order.findMany({
    where: { userId: null, phone: { contains: phone10.slice(-4) } },
    select: { id: true, phone: true },
  });

  const ids = candidates
    .filter((o) => o.phone.replace(/\D/g, "").endsWith(phone10))
    .map((o) => o.id);
  if (ids.length === 0) return 0;

  const result = await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: { userId },
  });

  console.info(`[orders] attached ${result.count} guest order(s) by phone to user ${userId}`);
  return result.count;
}
