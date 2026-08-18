/**
 * Environment access, in one place.
 *
 * Two ideas here:
 *  1. Required vars are validated once at import so a misconfigured deploy
 *     fails loudly at boot rather than quietly at checkout.
 *  2. Every third-party integration reports whether it is *live* or in
 *     MOCK MODE. Mock mode is what makes the whole purchase and shipping
 *     flow testable before Razorpay and Delhivery credentials exist —
 *     it is a first-class state, not an error.
 */
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required — generate with: openssl rand -base64 32"),

  AUTH_GOOGLE_ID: z.string().optional().default(""),
  AUTH_GOOGLE_SECRET: z.string().optional().default(""),

  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),

  DELHIVERY_API_TOKEN: z.string().optional().default(""),
  DELHIVERY_BASE_URL: z.string().optional().default("https://staging-express.delhivery.com"),
  DELHIVERY_PICKUP_NAME: z.string().optional().default(""),
  DELHIVERY_WEBHOOK_SECRET: z.string().optional().default(""),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CLOUDINARY_FOLDER: z.string().optional().default("avenues"),

  MSG91_AUTH_KEY: z.string().optional().default(""),
  MSG91_TEMPLATE_ID: z.string().optional().default(""),

  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("Avenues <onboarding@resend.dev>"),
  /**
   * Brevo, as an alternative to Resend.
   *
   * The difference that matters before a domain exists: Brevo will send from a
   * verified single ADDRESS, so support@…gmail.com works today. Resend verifies
   * DOMAINS, and its sandbox sender only delivers to the account holder — real
   * customers get nothing.
   */
  BREVO_API_KEY: z.string().optional().default(""),
  EMAIL_ADMIN: z.string().optional().default(""),

  NEXT_PUBLIC_GA4_ID: z.string().optional().default(""),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional().default(""),

  UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),
});

function read() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  · ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
  }
  return parsed.data;
}

export const env = read();

/** Which integrations are wired up, and which are simulating. */
export const integrations = {
  google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  delhivery: Boolean(env.DELHIVERY_API_TOKEN),
  cloudinary: Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  ),
  resend: Boolean(env.RESEND_API_KEY),
  brevo: Boolean(env.BREVO_API_KEY),
  /** True when transactional email can actually leave the building. */
  email: Boolean(env.RESEND_API_KEY || env.BREVO_API_KEY),
  sms: Boolean(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID),
} as const;

/**
 * The site's own public origin.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when it is set, because a real domain is the only
 * thing that should appear in a canonical tag or a customer's email.
 *
 * Failing that, Vercel is asked. Its default was `http://localhost:3000`, which
 * is a sensible answer on a laptop and a silent disaster on a deployment: the
 * first deploy would publish canonical tags, an OG image URL, a sitemap and
 * order emails all pointing at the visitor's own machine. Nothing errors, and
 * search engines index it that way.
 *
 * The two Vercel variables are not interchangeable:
 *
 *   VERCEL_PROJECT_PRODUCTION_URL  the project's stable production hostname —
 *                                  the same on every deploy
 *   VERCEL_URL                     THIS deployment's unique hostname, which
 *                                  changes with every push
 *
 * Production is preferred, so a preview build cannot bake its own throwaway
 * hostname into a canonical. `VERCEL_URL` is the fallback so preview
 * deployments still link to themselves rather than to localhost.
 *
 * Both come without a protocol, hence the prefix.
 */
function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return env.NEXT_PUBLIC_SITE_URL;
}

export const siteUrl = resolveSiteUrl().replace(/\/$/, "");

export const isProd = process.env.NODE_ENV === "production";
