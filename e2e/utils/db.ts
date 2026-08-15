import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "./env";

/**
 * Prisma client for assertions and fixture setup inside tests.
 *
 * Pinned to TEST_DATABASE_URL explicitly rather than reading whatever
 * DATABASE_URL happens to be in the ambient environment. A test that truncates
 * the wrong database is a very expensive five minutes.
 */
export const db = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
  log: ["error"],
});

/** Paise → the rupee string the UI renders, for cross-checking totals. */
export function rupees(paise: number) {
  return (paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}
