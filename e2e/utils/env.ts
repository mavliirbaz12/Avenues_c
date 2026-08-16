/**
 * Environment for the E2E run.
 *
 * Everything is defined here in code rather than in a `.env.test` file, for
 * one reason: the dev database must be impossible to seed by accident. A file
 * that Next might or might not load depending on NODE_ENV is exactly how a
 * suite ends up truncating the wrong database. These values are passed
 * explicitly to `webServer.env` and to the setup script's child processes.
 *
 * Every third-party integration is forced into mock mode by leaving its
 * credentials blank — the app already treats absent keys as "mock", which is
 * how the whole checkout flow has been testable without a Razorpay account.
 */

export const TEST_PORT = Number(process.env.E2E_PORT ?? 3100);
export const TEST_BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${TEST_PORT}`;

/**
 * Separate database on the same local Postgres container. Not a separate
 * container: one fewer moving part, and `avenues_test` is unmistakable in a
 * connection string.
 */
export const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://avenues:avenues@localhost:5433/avenues_test?schema=public";

/** Credentials the suite signs in with. Created by e2e/utils/seed-test-data.ts. */
export const ADMIN = {
  email: "admin@test.dev",
  password: "AdminTest!2026",
  name: "Test Admin",
} as const;

export const CUSTOMER = {
  email: "customer@test.dev",
  password: "CustomerTest!2026",
  name: "Test Customer",
  phone: "9812345670",
} as const;

/** A customer with no orders, for empty-state assertions. */
export const FRESH_CUSTOMER = {
  email: "fresh@test.dev",
  password: "FreshTest!2026",
  name: "Fresh Customer",
  phone: "9812345671",
} as const;

export function testEnv(): Record<string, string> {
  return {
    // Inherit PATH etc; Playwright merges this over process.env.
    NODE_ENV: "production",
    PORT: String(TEST_PORT),
    DATABASE_URL: TEST_DATABASE_URL,

    NEXT_PUBLIC_SITE_URL: TEST_BASE_URL,
    AUTH_URL: TEST_BASE_URL,
    AUTH_TRUST_HOST: "true",
    // Fixed so sessions minted in global setup stay valid for the whole run.
    AUTH_SECRET: "e2e-fixed-auth-secret-do-not-use-outside-tests-0000000000",

    // --- Every integration blank => mock mode -----------------------------
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: "",
    RAZORPAY_WEBHOOK_SECRET: "e2e_razorpay_webhook_secret",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: "",
    DELHIVERY_API_TOKEN: "",
    DELHIVERY_WEBHOOK_SECRET: "e2e_delhivery_webhook_secret",
    CLOUDINARY_CLOUD_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    RESEND_API_KEY: "",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",

    // No analytics beacons firing at a test runner.
    NEXT_PUBLIC_GA4_ID: "",
    NEXT_PUBLIC_META_PIXEL_ID: "",

    SEED_ADMIN_EMAIL: ADMIN.email,
    SEED_ADMIN_PASSWORD: ADMIN.password,
    SEED_ADMIN_NAME: ADMIN.name,
  };
}

/** Where global setup parks signed-in storage state. */
export const STORAGE = {
  admin: "e2e/.auth/admin.json",
  customer: "e2e/.auth/customer.json",
} as const;
