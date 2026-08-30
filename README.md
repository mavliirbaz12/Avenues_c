# Avenues Perfumes

A production e-commerce storefront and admin panel for a five-SKU Indian
fragrance brand. Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma ·
Auth.js · Razorpay · Delhivery · Cloudinary · Resend.

---

## Contents

1. [Quick start](#quick-start)
2. [Mock mode](#mock-mode)
3. [How it fits together](#how-it-fits-together)
4. [Deploy A — Vercel + Railway](#deploy-a--vercel--railway)
5. [Deploy B — AWS](#deploy-b--aws)
6. [Webhooks](#webhooks)
7. [Going live: the checklist](#going-live-the-checklist)
8. [Scripts](#scripts)
9. [Tests](#tests)
10. [Conventions worth knowing before you edit](#conventions-worth-knowing-before-you-edit)

---

## Quick start

Requires Node 20.9+ and Docker (for local Postgres).

```bash
cp .env.example .env                       # then set AUTH_SECRET (see below)
docker compose up -d                       # Postgres on localhost:5433
npm install
npm run db:migrate                         # create the schema
npm run db:seed                            # 5 fragrances, admin user, settings
npm run dev                                # http://localhost:3000
```

Generate the one secret that has no sensible default:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# paste into AUTH_SECRET in .env
```

Sign in to the admin panel at `/admin` with `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` from `.env` (`admin@avenuesperfumes.com` /
`ChangeMe!2026` by default — **change this before the site is public**).

> Local Postgres is published on **5433**, not 5432, because a native
> PostgreSQL install commonly occupies 5432. If you don't have one, either
> port works — just keep `DATABASE_URL` in step with `docker-compose.yml`.

---

## Mock mode

Every third-party integration works without credentials, so the entire
purchase → payment → shipment → tracking → refund flow is testable on day
one. Leave the keys blank and:

| Integration | Behaviour with no keys |
|---|---|
| **Razorpay** | Checkout routes to `/checkout/mock-pay`, an amber-bannered simulator with "succeed" and "fail" buttons. Success drives the *same* `/api/payments/verify` path the real gateway uses. |
| **Delhivery** | Pincode checks pass (except the reserved test pin `999999`, which fails). Shipments get a `MOCK…` AWB whose tracking advances one milestone every 8 hours, deterministically — so the Order Journey visibly moves. |
| **Resend** | Emails print to the server console in full, including password-reset links you can paste straight into a browser. |
| **Cloudinary** | Image upload is disabled with an explanatory notice; the storefront falls back to the engraved-bottle SVG placeholder. |
| **Google OAuth** | The "Continue with Google" button is not rendered at all — no dead button. |
| **MSG91 (SMS)** | Phone-OTP login works end to end; the 6-digit code prints to the server console instead of texting. |

The admin dashboard shows a banner naming exactly which integrations are
still mocked. The mock signature is rejected the instant real Razorpay keys
are present, so mock mode cannot leak into production.

---

## How it fits together

```
Customer ──► /checkout ──► POST /api/checkout
                              │  price server-side, decrement stock atomically
                              ▼
                          Razorpay ──► POST /api/payments/verify  (browser)
                              │      └─► POST /api/webhooks/razorpay (independent)
                              ▼
                          confirmOrder()  ← idempotent; allocates invoice no.
                              │
Admin ──► "Generate shipment" ─► Delhivery ──► AWB
                                      │
                       poll on page view ─┬─► Order Journey timeline
                       webhook push ──────┘
```

Points that matter:

- **Nothing the browser sends can change a price.** The client cart is a list
  of `(variantId, quantity)` intents; every figure is recomputed from the
  database in `src/lib/commerce/pricing.ts`.
- **Stock cannot oversell.** It is decremented inside a guarded conditional
  update (`WHERE stock >= qty`), so two people cannot buy the last bottle.
- **Confirmation is idempotent.** The verify endpoint and the webhook can both
  fire, twice, in any order.
- **Unpaid prepaid orders release their stock** after 30 minutes and keep a
  retry link. Swept opportunistically on every order creation, plus a cron.

---

## Deploy A — Vercel + Railway

### 1. Database (Railway)

1. New Project → **Provision PostgreSQL**.
2. Copy `DATABASE_URL` from the Postgres service → *Variables* → *Connect*.
   Use the **public** connection string for migrations run from your laptop.

### 2. App (Vercel)

1. Import the Git repository. Vercel detects Next.js; leave the build command
   as the default. `npm run build` runs three steps: `gen:sequence` (renders
   the landing scroll-reveal frames into `public/sequence/` — they are
   gitignored and rebuilt every deploy, which is why `sharp` is a
   devDependency and must not be pruned), then `prisma generate`, then
   `next build`.

   The build does **not** need database access: every page that queries at
   build time is guarded, so a cold or unreachable database delays the first
   request rather than failing the release.

2. Add the environment variables. **Required or the app will not boot:**

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Railway string from step 1 |
   | `AUTH_SECRET` | a **fresh** `openssl rand -base64 32` — never the dev one |
   | `NEXT_PUBLIC_SITE_URL` | your domain, no trailing slash |
   | `AUTH_TRUST_HOST` | `true` |

   **Required before taking real money:**

   | Variable | Without it |
   |---|---|
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | checkout stays in mock mode and takes no payment |
   | `RAZORPAY_WEBHOOK_SECRET` | payments confirm only via the browser callback — a dropped connection after paying leaves the order PENDING forever |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN` | no customer receives an order confirmation |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | product images cannot be uploaded at all |
   | `DELHIVERY_API_TOKEN`, `DELHIVERY_PICKUP_NAME` | no shipment is created; fulfilment is manual |

   **Safe to leave blank:** `MSG91_*` (the phone-OTP tab hides itself until
   these are set — see below), `UPSTASH_*` (rate limits fall back to an
   in-process Map, correct on a single instance), `NEXT_PUBLIC_GA4_ID`,
   `NEXT_PUBLIC_META_PIXEL_ID`.

3. Deploy.

### 3. Schema + seed

Run against the production database from your machine:

```bash
DATABASE_URL="<railway-url>" npx prisma migrate deploy
DATABASE_URL="<railway-url>" npm run db:seed        # first deploy only
```

`db:seed` is idempotent (every write is an upsert keyed on a natural unique)
and never touches order data, so re-running it is safe.

### 4. Cron

`vercel.json` already registers the stock-release job every 15 minutes.
Vercel Cron authenticates with `Authorization: Bearer $CRON_SECRET`. Set a
`CRON_SECRET` environment variable to any strong value and the endpoint will
use it; if it is absent the endpoint falls back to `AUTH_SECRET`, so it is
never left unauthenticated either way.

`regions: ["sin1"]` puts the functions in Singapore — next to the database
rather than next to the customer. That looks backwards for an India-only
store, and is deliberate.

One COD checkout is roughly twenty *sequential* database round trips: the
reservation sweep, pricing, the coupon counts, the order transaction (one
statement per cart line), then `confirmOrder`'s second transaction. Latency to
the database is paid twenty times over. Latency between the customer and the
function is paid once, and only on requests the edge cannot already answer.

Browsing does not touch the database at all — sessions are JWT, and the
catalogue reads go through `unstable_cache`. So putting the functions in
Mumbai instead would save ~40ms on a page view and cost ~800ms at checkout.

**If you move the database, move this with it.** That the two match matters
far more than which region they land in. Railway has no Indian region;
`southeast-asia` (Singapore) is its closest to India.

### 5. Sign-in methods

Customers sign in with **email + password**. Phone OTP exists and is tested,
but the login page hides it while `MSG91_AUTH_KEY` / `MSG91_TEMPLATE_ID` are
blank: without them the code prints to the server log, so a customer would be
asked for something that never arrives. Set both — after India DLT registration
clears — and the tab returns with no code change.

Google sign-in has been removed; the provider is unregistered, so
`/api/auth/signin/google` starts no flow.

### 6. First-run checklist

```bash
# from your laptop, against the production database
DATABASE_URL="<railway-url>" npx prisma migrate deploy
DATABASE_URL="<railway-url>" npm run db:seed
```

Then, in this order:

1. Sign in at `/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and
   **change the password immediately** — the seed sets it on create only, so
   editing the env var and re-seeding will not update an existing admin.
2. Admin → Settings: WhatsApp number, support email, the statutory
   manufacturer name and address, and the Delhivery pickup location name
   **exactly** as registered in your Delhivery panel.
3. Upload real product images (needs Cloudinary configured).
4. Place one COD order end to end, then one card order, and confirm the
   confirmation email arrives and the Delhivery shipment is created.

---

## Deploy B — AWS

Two shapes work; pick by how much ops you want.

### B1 — Amplify Hosting + RDS (simplest)

1. **RDS**: create a PostgreSQL 16 instance (`db.t4g.micro` is ample at launch).
   Note the endpoint; append `?sslmode=require` to `DATABASE_URL`.
2. **Amplify**: connect the repo, framework auto-detected as Next.js SSR.
   Add the same environment variables as above.
3. **VPC**: put Amplify's compute in the same VPC as RDS, or make the RDS
   instance publicly accessible and restrict its security group to Amplify's
   egress addresses. Do not leave it open to `0.0.0.0/0`.
4. Run `prisma migrate deploy` and `db:seed` from a machine that can reach RDS
   (your laptop over a bastion, or a one-off CodeBuild job).
5. **Cron**: EventBridge Scheduler → rate(15 minutes) → HTTP target
   `https://<domain>/api/cron/release-stock` with an
   `Authorization: Bearer <AUTH_SECRET>` header.

### B2 — ECS Fargate + RDS (full control)

1. Build a container. Add `output: "standalone"` to `next.config.ts`, then:

   ```dockerfile
   FROM node:20-alpine AS deps
   WORKDIR /app
   COPY package*.json prisma ./
   RUN npm ci

   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   FROM node:20-alpine AS runner
   WORKDIR /app
   ENV NODE_ENV=production
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static
   COPY --from=builder /app/public ./public
   COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```

2. Push to ECR; run on Fargate behind an Application Load Balancer with ACM
   TLS. Health check `/` (200).
3. Secrets from AWS Secrets Manager, injected as task-definition secrets — not
   plain environment variables.
4. Migrations as a one-off ECS task running `npx prisma migrate deploy`, wired
   into your deploy pipeline before the service update.
5. Cron as EventBridge → ALB, exactly as in B1.

---

## Webhooks

Both webhooks verify authenticity and are safe to receive more than once.

### Razorpay

*Dashboard → Settings → Webhooks → + Add New Webhook*

| Field | Value |
|---|---|
| URL | `https://<your-domain>/api/webhooks/razorpay` |
| Secret | any strong string — put the same value in `RAZORPAY_WEBHOOK_SECRET` |
| Events | `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` |

The signature is verified against the **raw** request body. A bad signature
returns 401; an event we deliberately ignore returns 200 so Razorpay stops
retrying.

### Delhivery

Delhivery's tracking push does not sign bodies, so it is authenticated with a
shared secret in the query string.

| Field | Value |
|---|---|
| URL | `https://<your-domain>/api/webhooks/delhivery?token=<DELHIVERY_WEBHOOK_SECRET>` |
| Method | POST |

Ask Delhivery support to enable status push for your account. The webhook is
optional: without it, tracking is polled when a customer opens their order
page (at most once per shipment per 10 minutes), so the timeline stays live
either way.

### Testing webhooks locally

```bash
npx untun@latest tunnel http://localhost:3000     # or ngrok/cloudflared
# point the dashboard at the public URL it prints
```

---

## Going live: the checklist

**Secrets and access**
- [ ] `AUTH_SECRET` generated fresh (never reuse the dev value)
- [ ] Admin password changed from the seeded default
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain, no trailing slash

**Phone OTP login**
- [ ] MSG91 account with DLT registration done (TRAI one-time: sender ID + an
      OTP template containing the `##otp##` variable; MSG91's onboarding
      walks you through it, allow a few days)
- [ ] `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` set — until then OTPs print to
      the server console only

**Payments**
- [ ] Razorpay **live** keys in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- [ ] `NEXT_PUBLIC_RAZORPAY_KEY_ID` matches `RAZORPAY_KEY_ID`
- [ ] Webhook created, `RAZORPAY_WEBHOOK_SECRET` set, test event delivered
- [ ] Razorpay account activated — they check for the policy pages below

**Shipping**
- [ ] `DELHIVERY_API_TOKEN` set, `DELHIVERY_BASE_URL` switched to
      `https://track.delhivery.com`
- [ ] Pickup location created in Delhivery One and its exact name saved in
      **Admin → Settings → Delhivery pickup name** (a mismatch rejects every
      shipment)

**Statutory — do not skip**
- [ ] **Admin → Settings**: registered address, GSTIN, customer-care email and
      phone. These print on every product page and invoice; Legal Metrology
      requires them.
- [ ] Read the four policy pages end to end and correct anything that is not
      true of your operation: `/policies/shipping`, `/policies/returns`,
      `/policies/privacy`, `/policies/terms`.

**Content**
- [ ] Real product photography uploaded (Admin → Products → Images). Until
      then the engraved-bottle placeholder is used everywhere.
- [ ] Replace `src/app/icon.svg` and the drawn monogram in
      `src/components/brand/monogram.tsx` with the official vector artwork.
- [ ] WhatsApp number, support email, Instagram URL in Settings.

**Growth**
- [ ] `NEXT_PUBLIC_GA4_ID` and `NEXT_PUBLIC_META_PIXEL_ID` when ads start.
      Purchase conversions fire automatically on the order-success page.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Frame sequence + `prisma generate` + production build |
| `npm run gen:sequence` | Regenerate the landing scroll-reveal frames into `public/sequence/` |
| `npm run test:e2e` | Full Playwright suite against a fresh test database |
| `npm run test:e2e:smoke` | `@smoke` only — the critical path |
| `npm run typecheck` | `tsc --noEmit` — the fast correctness gate |
| `npm run db:migrate` | Create + apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Idempotent catalogue seed |
| `npm run db:studio` | Prisma Studio |
| `node scripts/shot.mjs <route>` | Visual QA — see below |

### Visual QA harness

`scripts/shot.mjs` drives your installed Chrome (via `puppeteer-core`, no
Chromium download) and captures a route at 1440 / 768 / 390.

```bash
node scripts/shot.mjs                    # "/" at all three widths
node scripts/shot.mjs shop --full        # full-page
node scripts/shot.mjs admin --login      # signs in as the seeded admin first
node scripts/shot.mjs shop --at="#notes" # scroll an element into view first
node scripts/shot.mjs cart --cart='[…]'  # seed the cart to audit real contents
```

Pass routes **without** a leading slash — under Git Bash, MSYS rewrites a bare
`/` argument into a Windows path before Node sees it.

---

## Tests

```bash
npm run typecheck        # fast gate
npm run test:e2e         # 405 Playwright specs, desktop + mobile
npm run test:e2e:smoke   # critical path only (what CI runs per PR)
```

The E2E suite runs against a **production build** and an isolated
`avenues_test` database, with every third-party integration in mock mode. It
needs Docker running.

Full documentation — the run flow, mock contracts, fixtures, route-coverage
map and known gaps — is in **[`e2e/README.md`](e2e/README.md)**. The defects it
found while being written, and the ones still open, are in
**[`e2e/FINDINGS.md`](e2e/FINDINGS.md)**.

One rule worth knowing before you add a `loading.tsx`: it is a Suspense
boundary, and Next commits the response head as soon as it streams the
fallback — so any route beneath one that calls `notFound()` will serve its 404
page with a **200** status. See the note in `src/components/ui/skeletons.tsx`.

---

## Conventions worth knowing before you edit

**Money is always integer paise.** `₹1,199` is `119900`. No `Float` touches a
price anywhere. Formatting to a string happens once, at the edge, in
`src/lib/format.ts`.

**Never export a constant from a `"use server"` file.** Every export of such a
module becomes a server-reference proxy in the client bundle, so a constant
arrives as an empty object. Shared form types and constants live in
`src/lib/form-state.ts`. (This also breaks the production build outright —
`"use server"` modules may only export async functions.)

**Watch what client components import.** Importing anything from a module that
uses `node:crypto` or a server SDK drags it into the browser bundle and fails
the webpack build. That is why `src/lib/payments/mock-constants.ts` exists
separately from `razorpay.ts`.

**Filters and settings are data, not code.** Shop facets derive from the
database, and controls with only one option hide themselves. Shipping rates,
COD policy, support channels and statutory details all live in the single
`StoreSetting` row, editable from Admin → Settings without a deploy.

**Rate limiting is in-process by default**, which is correct for one instance.
On multi-instance deploys set `UPSTASH_REDIS_REST_URL` / `_TOKEN` so counters
are shared — see `src/lib/rate-limit.ts`.
