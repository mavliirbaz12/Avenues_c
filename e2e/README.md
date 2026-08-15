# E2E tests

Playwright suite for the Avenues storefront and admin panel.

```bash
npm run test:e2e          # everything: fresh DB, seed, build, run
npm run test:e2e:smoke    # @smoke only — the critical path, what CI runs per PR
npm run test:e2e:fast     # skip the rebuild (use while iterating on specs)
npm run test:e2e:ui       # Playwright's UI mode
```

Prerequisite: Docker running, because the orchestrator creates the test
database inside the existing `avenues-postgres` container.

```bash
docker compose up -d
```

---

## What runs, and where

`scripts/e2e.mjs` does the whole sequence so a run is reproducible from a cold
machine:

1. Creates `avenues_test` in the Postgres container if it isn't there.
2. `prisma migrate deploy`
3. `prisma/seed.ts` — the real catalogue seed
4. `e2e/utils/seed-test-data.ts` — fixtures the app's own seed doesn't provide
5. `npm run build`
6. `npx playwright test`

**Tests run against a production build (`next start`), not `next dev.`** Dev
compiles routes on demand, double-renders under StrictMode and disables `<Link>`
prefetch — none of which is what ships, and all of which changes timing enough
to hide real races.

### Database isolation

`DATABASE_URL` is passed **explicitly** to every step and to `webServer.env`,
never through a `.env` file. Next resolves env files differently between `dev`
and `start`, and a file that might or might not be loaded is exactly how a
suite ends up seeding the development database. The value lives in
`e2e/utils/env.ts` and points at `avenues_test` — unmistakable in a connection
string.

### Projects

| Project | Viewport | Notes |
|---|---|---|
| `setup` | 1440×900 | Signs in once per role, writes `e2e/.auth/*.json` |
| `chromium-desktop` | 1440×900 | Skips `@mobile` |
| `mobile` | Pixel 7 (412px) | Skips `@desktop` and all of `e2e/admin/` |

`@desktop` marks assertions about affordances that only exist on wide
viewports — the nav's text labels (hidden below 1400px by design) and the
hover-opened Fragrances menu. `@mobile` marks the hamburger menu and the sticky
buy bar. Neither tag is a way to duck a failure: each has a real counterpart on
the other viewport, and where one control simply moves (search, shop filters)
the specs use the viewport-aware helpers in `utils/selectors.ts` instead of
being duplicated.

---

## How the mocks work

Every integration is forced into mock mode by leaving its credentials blank.
The app already treats absent keys as mock (`integrations` in `src/lib/env.ts`),
so nothing test-only was added to production code to make this work.

| Service | Mock behaviour |
|---|---|
| **Razorpay** | `createGatewayOrder` returns `order_mock_…`. Verification accepts **only** `razorpayPaymentId` starting `pay_mock_` plus signature `mock_signature_ok`, so specs take the same verification branch a real payment would. `/api/payments/mock-fail` simulates failure and 404s the moment real keys exist. |
| **Delhivery** | Any well-formed 6-digit pincode is serviceable **except `999999`**, which the specs use for the unserviceable path. Tracking advances deterministically. |
| **Resend** | Prints the message to the server log. Visible as `Subject: …` lines in the Playwright `[WebServer]` output. |
| **MSG91** | Prints the OTP to the server log. |
| **Cloudinary** | Not mocked — `uploadImage` **throws** when unconfigured, so admin image upload has no automated coverage. See *Known gaps*. |
| **Google OAuth** | The one integration deliberately switched **on**, with dummy credentials. The sign-in button only renders when its vars are set and the brief requires testing it, so the spec asserts the click reaches the provider and stops there. No OAuth round-trip is ever completed. |

### The rate-limit trick

`/api/checkout` allows 10 orders per IP per five minutes and this suite places
many more. Rather than weakening a limit worth keeping honest, each simulated
buyer arrives from its own `X-Forwarded-For` — which is what `clientIp()`
reads. That also makes the oversell race truthful: two different buyers, not
one customer double-clicking.

---

## Fixtures

From `e2e/fixtures.ts`:

- `page` / `guestPage` — signed out
- `customerPage` — signed in as `customer@test.dev`
- `adminPage` — signed in as `admin@test.dev`
- `consoleErrors` — attached to every page automatically

**Console errors fail the test that provoked them.** A spec that deliberately
visits something broken (a 404, a rejected request) opts out with
`allowConsoleErrors(page)` and a comment saying why. The default is on, because
finding out which click produced an error is far cheaper than a separate
"no errors anywhere" sweep.

### Seeded fixtures

`e2e/utils/seed-test-data.ts` adds what the catalogue seed doesn't: two
customers (one with history, one empty), a default address, coupons covering
every rejection branch (`E2EFLAT100`, `E2EPCT10`, `E2EMIN5000`, `E2EEXPIRED`,
`E2EFUTURE`, `E2EUSEDUP`, `E2EDISABLED`), a zero-stock variant and a
stock-of-one variant. It also resets the admin password, which the catalogue
seed only sets on create — without that, the second run can't sign in.

Specs that spend inventory call `ensureStock(slug, n)` first. Order specs
consume stock and the oversell test deliberately zeroes a variant, so leaving
it to execution order is the classic way a suite becomes "sometimes red".

---

## Writing a test

Assertions read from the database, not from copies of the seed constants. A
spec that hard-codes `"Bergamot"` keeps passing after someone edits the
formulation in admin and the storefront stops matching.

```ts
import { test, expect } from "../fixtures";
import { main } from "../utils/selectors";
import { db } from "../utils/db";

test("@smoke the PDP shows the real price", async ({ page }) => {
  const product = await db.product.findUnique({
    where: { slug: "night-drip" },
    include: { variants: true },
  });

  await page.goto("/fragrance/night-drip");
  const price = (product!.variants[0]!.pricePaise / 100).toLocaleString("en-IN");
  await expect(main(page).getByText(new RegExp(`₹\\s*${price}`)).first()).toBeVisible();
});
```

**Scope storefront lookups to `main(page)`.** The footer carries an enquiry
form and a newsletter form on every page, so a bare `getByLabel("Email")` is
ambiguous almost everywhere.

**No `waitForTimeout` as a substitute for an assertion.** The two places a
fixed wait appears — settling the scroll-scrub, settling fades before an axe
scan — are followed by an assertion that actually decides the test.

### Selector gotchas found the hard way

- The star rating is `role="radio"` in a radiogroup, **not** five buttons. That
  is the correct ARIA pattern; the first draft of the spec was wrong.
- The Fragrances menu opens on **hover**, so a programmatic `.click()` hovers
  (opening it) then toggles it shut. Specs `.hover()`.
- A PDP has **three** "Add to cart" buttons: the main one, and duplicates in the
  mobile sticky bar and the related-products strip. Scope, then `.first()`.
- `.count()` does not auto-wait. Use `expect(locator).toBeVisible()`.
- Admin has both "Description" and "Meta description"; "Announcement strip"
  matches both the input and its enable checkbox. Use `getByRole("textbox", …)`.

---

## Route coverage map

| Route | Spec | What is asserted |
|---|---|---|
| `/` | `storefront/home.spec.ts` | Announcement strip from settings + dismiss, labelled nav, Fragrances dropdown, hero + Discover CTA, no video unless configured, featured slider, collection grid vs DB, tax line appears once, `#collection` anchor clears the header, footer links |
| `/` (reveal) | `storefront/bottle-reveal.spec.ts` | Section pins, canvas mounts, four scroll depths render **different** frames, scrolling back returns to frame 0, text beats change, coarse-first load strides the sequence, phones get the small frame set, reduced motion loads ≤1 image and doesn't pin |
| `/shop` | `storefront/shop-search-track.spec.ts` | Full catalogue, gender filter, price sort as card order vs DB, designed empty state, card → PDP |
| `/fragrance/[slug]` | `storefront/product.spec.ts` | ×5 products: name, tagline, offer price, MRP strike, every note in all tiers, sensory narrative, best-for, longevity, Legal Metrology. Add to cart, Buy now, quantity stepper, notify-me when sold out, guest wishlist, WhatsApp enquiry link, related products, breadcrumb |
| PDP reviews | `storefront/product.spec.ts` | Submission lands `PENDING` and is **not** publicly visible |
| Search | `storefront/shop-search-track.spec.ts` | By name, by note, empty state, rate limit |
| `/track`, `/track-order` | `storefront/shop-search-track.spec.ts` | Redirect preserves `?order=`, wrong pair leaks nothing, prefill |
| `/contact` | `storefront/shop-search-track.spec.ts` | Enquiry stored `NEW`, subject dropdown populated, empty rejected |
| `/login` | `auth/login.spec.ts` | Tab default + switch, success, wrong password, unknown email indistinguishable, password toggle, Google button + handoff, forgot-password non-disclosure |
| Phone OTP | `auth/login.spec.ts` | Code requested, six-digit gate, wrong code, malformed number |
| `/signup` | `auth/signup.spec.ts` | Creates + signs in, duplicate email, weak password, invalid email, policy links are `<Link>` |
| Protection matrix | `auth/route-protection.spec.ts` | Guests bounced with destination preserved; customers get non-200 and zero admin content on all 10 admin routes; admins get all 10; 8 API endpoints reject appropriately |
| `/cart` | `cart-checkout/cart.spec.ts` | Add/adjust/remove, empty state, guest persistence, **guest cart merges on login**, server pricing, forged price discarded |
| Coupons | `cart-checkout/cart.spec.ts` | Flat, percentage cap, 6 rejection branches, unknown ≡ disabled (no enumeration oracle) |
| `/checkout` | `cart-checkout/checkout.spec.ts` | Guest reaches it, terms required, field validation, saved-address refused to guests, pincode serviceability |
| Payments | `cart-checkout/checkout.spec.ts` | COD places + decrements, mock Razorpay success confirms, forged signature refused, failure stays PENDING, replay is idempotent |
| Inventory | `cart-checkout/checkout.spec.ts` | Oversell race has exactly one winner, over-ordering refused, sold-out unbuyable |
| `/order/[n]` | `cart-checkout/checkout.spec.ts` | Token grants access; without it, redirect to tracking and no content leaked |
| `/account/*` | `account/account.spec.ts` | Profile edit, password toggle, address book add/validate, order history + **gold Track order button**, invoice download, empty history, wishlist persistence |
| `/admin/*` | `admin/admin.spec.ts` | Dashboard low-stock, product CRUD → storefront, inactive → 404, price edit → PDP, coupons, orders list/detail/filter, review approve → published, enquiry inbox, customers, newsletter + CSV, settings → storefront |
| Cross-cutting | `cross-cutting/a11y-seo.spec.ts` | axe on 9 public pages + admin, one `<h1>` and a skip link per page, titles/descriptions/OG, robots + sitemap vs DB, `noindex` on account, Product JSON-LD validated against the DB, `aggregateRating` omitted when there are no reviews |
| Mobile | `storefront/mobile-nav.spec.ts` | Hamburger, menu contents, cart badge announces its count, sticky buy bar in the lower half of the screen |

---

## `data-testid`s added

Only three, all on the bottle reveal, because it is the one component with no
accessible name to target — a decorative `aria-hidden` canvas:

- `bottle-reveal` — the section wrapper (also carries `data-reduced="true"` in
  the reduced-motion fallback)
- `bottle-reveal-canvas` — the canvas itself

Everything else uses roles, labels and text.

---

## Known gaps

- **Admin image upload is untested.** `uploadImage` throws when Cloudinary is
  unconfigured — there is no fake-upload fallback — so `/api/admin/upload`
  cannot succeed in mock mode. Covering it needs either a local-disk adapter
  behind the same interface, or a signed-upload stub. Worth doing: image
  reorder and set-primary are storefront-visible behaviour.
- **Delhivery shipment creation** is exercised only through the mock's
  deterministic tracking, not against a recorded real payload.
- **Visual regression snapshots** are not enabled. The reveal is verified by
  frame-difference hashing rather than pixel snapshots, which is more robust
  for a canvas but does not catch a restyle elsewhere on the page.
- **Refunds and RTO** have no spec yet.

---

## CI

`.github/workflows/e2e.yml` — `@smoke` on every PR and push, the full suite
nightly at 02:30 UTC (≈08:00 IST) or on demand. Traces on first retry;
report, traces and videos uploaded on failure.
