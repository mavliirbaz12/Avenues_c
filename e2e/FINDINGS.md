# E2E findings

What the suite found while it was being written. Everything listed as **fixed**
was fixed in the same commit as the spec that caught it; the spec now guards
against its return.

---

## Fixed

### 1. Signing up did not sign you in — `feat/auth`, commit `7e0449a`

`signup-form.tsx` read the email and password back off the DOM in an effect
after the server action resolved. React resets an uncontrolled form once its
action succeeds, so both inputs were empty by then, the guard fell through to
`router.push("/login")`, and **every new customer was dumped on the login form
to retype what they had just entered.**

For a first-time D2C brand that is a hole in the most expensive step of the
funnel. Fixed by capturing the credentials from `FormData` on the way into the
action — the only moment they are reliably present.

*Caught by:* `auth/signup.spec.ts` → "creates an account and lands signed in".

### 2. Unknown product and order URLs returned HTTP 200 — commit `acb47cf`

`/fragrance/<unknown-slug>` served the branded 404 UI with a **200** status, so
a search engine would index "Fragrance not found" as a real page. Same for
`/order/<unknown>`.

Cause: `loading.tsx` is a Suspense boundary, and Next commits the response head
as soon as it starts streaming the fallback. Any route beneath one that later
calls `notFound()` can no longer set the status. Bisected: with the boundary,
200; without it, 404.

Fixed by keeping loading boundaries only on subtrees where nothing calls
`notFound()` (`/shop`, `/account`, `/admin`). The rule is written into
`components/ui/skeletons.tsx` so the next person adding one doesn't silently
undo it.

*Caught by:* `storefront/smoke.spec.ts` → "returns a real 404".

### 3. Deep links into `/account` lost their destination — commit `7e0449a`

`account/layout.tsx` called `requireUser("/account")`. A layout renders before
its page, so that redirect always won: a guest opening `/account/orders` was
sent to `/login?next=/account` and, after signing in, landed on the account
home instead of their orders.

The layout now reads the session without redirecting; enforcement sits on the
pages, each of which already calls `requireUser()` with its own path.

*Caught by:* `auth/route-protection.spec.ts` → "preserving the destination".

### 4. Policy links on signup were plain `<a>` — commit `7e0449a`

Full document reloads out of the signup form, re-downloading the bundle.
Now `<Link>`. The spec proves it by setting a marker on `window` and checking
it survives the navigation.

### 5. Two palette colours failed WCAG AA — commit `8a262be`

- `stone-dark` was `#6B655D` — **3.41:1** on ink, against a 4.5:1 floor for
  body text. It is the colour used for struck-through MRPs, breadcrumbs and the
  statutory "inclusive of all taxes" lines: legally required copy a customer
  has to be able to read. Now `#868075` (5.0:1 on ink, 4.7:1 on the raised
  surface), still clearly quieter than `stone`.
- `danger` was `#B4544E` — **4.04:1**. Error messages and the "Out" stock
  badge. Now `#C56A63` (5.1:1).

### 6. Two list-semantics breaks — commit `8a262be`

- The landing note index wrapped each `<li>` in a `Reveal`, putting a `<div>`
  between `<ul>` and `<li>`.
- The PDP breadcrumb put chevron SVGs directly inside the `<ol>`.

Both stop a screen reader announcing the list at all. `Reveal` now goes inside
the `<li>`; separators are `<li aria-hidden>`.

---

## Not defects — recorded so they aren't "fixed" by mistake

- **An order visited without its access token is not a 404.** It redirects to
  `/track-order` with the number prefilled. Friendlier than a dead end, and no
  order content is served. The spec asserts the redirect *and* the absence of
  content.
- **The star rating is `role="radio"` in a radiogroup, not five buttons.** The
  correct ARIA pattern. The first draft of the spec was wrong.
- **The Fragrances menu opens on hover**, so a programmatic `.click()` opens
  then immediately closes it. Worth knowing: a mouse user clicking the trigger
  experiences the same thing.
- **The cart drawer legitimately shows "you save ₹…"** from the MRP-vs-offer
  difference even with no coupon applied, so a coupon-rejection spec must not
  assert on that string.

---

## Open gaps

| Gap | Why | Cost to close |
|---|---|---|
| **Admin image upload untested** | `uploadImage` *throws* when Cloudinary is unconfigured — there is no fake-upload fallback — so `/api/admin/upload` cannot succeed in mock mode. Image reorder and set-primary are storefront-visible behaviour, so this is the most valuable gap. | A local-disk adapter behind the same interface, or a signed-upload stub. |
| **Refunds and RTO** | No spec yet for the Razorpay refund path or return-to-origin handling on COD. | Mock refund already returns `rfnd_mock_…`; mostly spec-writing. |
| **Delhivery shipment creation** | Exercised only through the mock's deterministic tracking, not a recorded real payload. | Record one real response and replay it. |
| **Visual regression** | The reveal is verified by frame-difference hashing (more robust than pixel snapshots for a canvas), but nothing catches an unrelated restyle. | Playwright snapshots on 3–4 stable views with dynamic regions masked. |
| **Rate limits are in-process** | `rateLimit` uses an in-memory `Map`, so limits are per-instance. Fine on one container; on a scaled deploy the limits multiply by instance count. Already documented in `src/lib/rate-limit.ts`; `UPSTASH_*` moves it to Redis. | Config only. |

---

## Suite health

405 specs across `chromium-desktop` (1440×900) and `mobile` (Pixel 7). Run
three times consecutively, green each time.

Flake sources found and removed rather than retried away:

- **Shared rate-limit buckets.** `/api/checkout` allows 10 orders per IP per 5
  minutes and the suite places far more; the search limiter is 40/min. Both are
  in-memory and the reused dev server carries them between runs and projects.
  Each simulated buyer now arrives from its own `X-Forwarded-For`, and the
  rate-limit spec burns a dedicated address so it cannot poison the UI search
  specs. The limits themselves were left untouched.
- **Inventory ordering.** Order specs consume stock and the oversell test
  deliberately zeroes a variant. Specs top up their own stock via
  `ensureStock()` instead of depending on execution order.
- **`.count()` does not auto-wait** — one assertion raced the render and was
  replaced with `expect(...).toBeVisible()`.
- **Axe scanning mid-animation.** The scanner was reporting foreground colours
  that appear nowhere in the palette (`text-bone` at 20% opacity over ink). The
  scan now pauses the slider and waits for opacity to become *stable* — not to
  reach 1, since many elements sit at a fixed fractional opacity by design.
- **Clicks landing before hydration.** Playwright clicks a control the moment
  it is painted, which can precede React attaching the handler — the click is
  then simply lost. Two spots hit this (the shop filter toggle and its facet
  chips). Both now retry the *interaction* until the app responds, rather than
  waiting longer before a single click, which only makes the race rarer.
  Related: `isVisible()` and `.count()` do not auto-wait, so neither is safe as
  a branch condition on a freshly loaded page.

### A note on `--repeat-each`

Rate-limited forms are not repeat-safe by default: `--repeat-each=6` fires a
dozen enquiries in two minutes and the limiter correctly refuses them. The
contact specs pin their own `x-forwarded-for` so repetition stays meaningful.
If you add a spec that submits a throttled form, do the same rather than
raising the limit.
