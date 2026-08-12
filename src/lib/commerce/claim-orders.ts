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
