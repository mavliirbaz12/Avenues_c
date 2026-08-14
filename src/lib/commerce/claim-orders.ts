import { prisma } from "@/lib/prisma";

/**
 * Attaches past guest orders to a user account.
 *
 * Guest checkout is allowed (forcing signup kills conversion for a brand
 * nobody knows yet), which means orders can exist with userId = null. When
 * someone signs up or signs in with the same email they used at checkout,
 * those orders become theirs — history, tracking and invoices included.
 *
 * Matching on a verified-by-login email is deliberate: the user proved control
 * of the address by authenticating with it.
 */
export async function claimGuestOrders(userId: string, email: string) {
  const normalised = email.toLowerCase();

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
