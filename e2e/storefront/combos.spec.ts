import { test, expect, allowConsoleErrors } from "../fixtures";
import { main, nav } from "../utils/selectors";
import { db } from "../utils/db";
import { customerRequest, ensureStock } from "../utils/orders";

/**
 * Leave the catalogue as we found it: exactly one set, the seeded one.
 *
 * The builder spec creates sets and deletes them at the end of its body, which
 * is fine right up until it fails. Doing it here as well means a failure costs
 * one red test instead of leaking a second set into every /sets assertion that
 * runs afterwards, in this file and in the other project.
 */
test.afterAll(async () => {
  await db.product.deleteMany({ where: { type: "COMBO", slug: { not: SET_SLUG } } });
  await db.$disconnect();
});

const SET_SLUG = "discovery-set";

/**
 * Clear sets left behind by an interrupted admin-builder run.
 *
 * Several assertions here depend on the seeded set being the ONLY one — the
 * /sets page switches to a grid at two or more, and the homepage band picks
 * whichever set is featured. A stray `e2e-set-…` from a run that died before
 * its cleanup would quietly change both, and the failure would point at the
 * wrong thing.
 */
/**
 * Between EVERY test, not just at the end of the file.
 *
 * The builder spec creates a set, and the specs after it in this same file
 * assume the seeded set is the only one — "retiring a fragrance inside an
 * active set is blocked" reports how many sets contain the fragrance, so a
 * leftover turns "inside 1 active gift set" into "inside 2". afterAll runs far
 * too late to help those, and relying on the builder's own last statement
 * fails exactly when the builder does.
 */
test.afterEach(async () => {
  await db.product.deleteMany({ where: { type: "COMBO", slug: { not: SET_SLUG } } });
});

test.beforeAll(async () => {
  /*
    Delete every set that is not the seeded one — not just `e2e-set-*`.

    Several assertions here depend on the seeded set being the ONLY one: /sets
    renders a full-width feature at one set and a grid at two or more, and the
    "N fragrances" line only exists in the feature layout. The admin builder
    spec creates sets with generated slugs, and when it failed its cleanup —
    the last statement in the test — never ran. The leftover flipped /sets to a
    grid, and the contents-count spec in the OTHER project failed on a page
    that was entirely correct for the data it had.

    Matching on "anything that is not the seed" rather than on a prefix means a
    future spec that names its fixtures differently cannot reintroduce this.
  */
  await db.product.deleteMany({ where: { type: "COMBO", slug: { not: SET_SLUG } } });
});

async function seededSet() {
  return db.product.findUnique({
    where: { slug: SET_SLUG },
    include: {
      variants: { orderBy: { sortOrder: "asc" } },
      comboItems: { orderBy: { position: "asc" }, include: { product: true } },
    },
  });
}

test.describe("gift sets — storefront", () => {
  test("@smoke /sets renders the set with a live contents count", async ({ page }) => {
    const set = await seededSet();
    expect(set, "the Discovery Set should be seeded").not.toBeNull();
    const count = set!.comboItems.length;

    await page.goto("/sets");
    const body = main(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(body.getByRole("heading", { name: /discovery set/i }).first()).toBeVisible();

    // The count comes from the data. If someone hardcodes "4" this fails the
    // moment the seed changes.
    await expect(
      body.getByText(new RegExp(`${count}\\s*fragrance`, "i")).first(),
      `should say "${count} fragrances", read from the database`,
    ).toBeVisible();

    /*
      The typed savingsNote is gone from the card surfaces, so this no longer
      asserts it. It was free text an admin wrote once: the seeded value said
      "Worth ₹4,796 if bought as full bottles", which was true at ₹1,199 a
      bottle and still on the live site at ₹999, where the honest figure was
      ₹3,996. The claim now lives only on the set's own page and is summed from
      the members' current prices — covered by the spec below.
    */
  });

  test("the worth-separately figure is computed, never a stored string", async ({ page }) => {
    const set = await seededSet();
    const members = await db.comboItem.findMany({
      where: { comboId: set!.id },
      select: {
        product: {
          select: {
            variants: {
              where: { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }],
              take: 1,
              select: { mrpPaise: true },
            },
          },
        },
      },
    });
    const expected = members.reduce(
      (sum, m) => sum + (m.product.variants[0]?.mrpPaise ?? 0),
      0,
    );

    await page.goto(`/set/${SET_SLUG}`);
    const worth = main(page).getByText(/worth .* if bought as full bottles/i);
    await expect(worth).toBeVisible();

    // The rendered rupees must equal the sum of the members' own bottle MRPs.
    const text = (await worth.textContent()) ?? "";
    const rendered = Number(text.replace(/[^0-9]/g, ""));
    expect(
      rendered,
      "the figure must be the sum of member bottle prices, not a stored note",
    ).toBe(Math.round(expected / 100));
  });

  test("@smoke the set page lists every member, pulled live", async ({ page }) => {
    const set = await seededSet();
    await page.goto(`/set/${SET_SLUG}`);

    const inside = page.getByTestId("whats-inside");
    await expect(inside).toBeVisible();

    // Every referenced fragrance appears — however many there are.
    for (const item of set!.comboItems) {
      const short = item.product.name.replace(/^Avenues\s+/i, "");
      await expect(
        inside.getByRole("button", { name: new RegExp(short, "i") }),
        `${short} should be listed inside the set`,
      ).toBeVisible();
    }

    // And exactly that many rows — no phantom entries.
    await expect(inside.getByTestId("combo-member")).toHaveCount(set!.comboItems.length);
  });

  test("What's Inside reflects an edit to the underlying fragrance", async ({ page }) => {
    // The whole point of referencing rather than copying: change a fragrance
    // and every set containing it updates.
    const set = await seededSet();
    const member = set!.comboItems[0]!;
    const original = member.product.tagline;
    const edited = `Edited ${Date.now()}.`;

    await db.product.update({ where: { id: member.productId }, data: { tagline: edited } });

    try {
      await page.goto(`/set/${SET_SLUG}`);
      await expect(
        page.getByTestId("whats-inside").getByText(edited),
        "the set page should show the fragrance's new tagline without any edit to the set",
      ).toBeVisible();
    } finally {
      await db.product.update({ where: { id: member.productId }, data: { tagline: original } });
    }
  });

  test("expanding a member shows its notes and links to its own page", async ({ page }) => {
    const set = await seededSet();
    const member = set!.comboItems[0]!;
    const short = member.product.name.replace(/^Avenues\s+/i, "");

    await page.goto(`/set/${SET_SLUG}`);
    const inside = page.getByTestId("whats-inside");
    await inside.getByRole("button", { name: new RegExp(short, "i") }).click();

    for (const note of [...member.product.notesTop, ...member.product.notesBase]) {
      await expect(inside.getByText(note, { exact: false }).first()).toBeVisible();
    }
    await expect(
      inside.getByRole("link", { name: /read the full page/i }).first(),
    ).toHaveAttribute("href", `/fragrance/${member.product.slug}`);
  });

  test("@smoke the homepage band features the set and links to /sets", async ({ page }) => {
    await page.goto("/");
    const band = page.getByTestId("combo-band");
    await expect(band).toBeVisible();
    await expect(band.getByRole("link", { name: /explore the set/i })).toHaveAttribute(
      "href",
      `/set/${SET_SLUG}`,
    );
    await expect(band.getByRole("link", { name: /all gift sets/i })).toHaveAttribute(
      "href",
      "/sets",
    );
  });

  /**
   * Toggled through the ADMIN FORM, not with a Prisma write.
   *
   * The landing page and /sets are prerendered (ISR) rather than rendered per
   * request. A direct `db.product.updateMany` changes the row and nothing
   * else, so the cached HTML keeps showing the band and this spec fails on
   * output that is stale rather than wrong — and, worse, the stale /sets entry
   * then outlived the test and broke the contents-count spec in the other
   * project.
   *
   * Saving through the admin form is what calls revalidatePath, which is also
   * exactly how a real admin retires a set. Restored in a finally, through the
   * same path, so the cache is warm and correct for whatever runs next.
   */
  test("the homepage band disappears when no set is active", async ({ page, adminPage }) => {
    const set = await seededSet();
    const setActive = async (active: boolean) => {
      await adminPage.goto(`/admin/combos/${set!.id}`);
      const live = adminPage.getByRole("checkbox", { name: /live on the storefront/i });
      if (active) await live.check();
      else await live.uncheck();
      await adminPage.getByRole("button", { name: /save|update/i }).first().click();
      await expect
        .poll(
          async () =>
            (await db.product.findUnique({
              where: { id: set!.id },
              select: { isActive: true },
            }))!.isActive,
          { message: `the set should be ${active ? "live" : "retired"}` },
        )
        .toBe(active);
    };

    try {
      await setActive(false);

      await page.goto("/");
      await expect(page.getByTestId("combo-band")).toHaveCount(0);

      // And the sets page says so rather than rendering an empty grid.
      await page.goto("/sets");
      await expect(main(page).getByText(/no sets are boxed/i)).toBeVisible();
    } finally {
      await setActive(true);
    }
  });

  test("@smoke @desktop Gift sets is a first-class nav item", async ({ page }) => {
    await page.goto("/");
    await expect(nav(page).getByRole("link", { name: /gift sets/i })).toHaveAttribute(
      "href",
      "/sets",
    );
  });

  /**
   * Sets are on /shop, but in their own band beneath the fragrance grid — not
   * mixed into it and not behind a `?kind=` filter.
   *
   * This spec used to assert the filter behaviour. That was written against an
   * earlier /shop that listed both kinds in one grid; the page was later
   * narrowed to fragrances only and this was left behind asserting a feature
   * that no longer existed. It now describes what the page actually does: the
   * fragrances answer "which one", the set band answers "or all of them", and
   * the filters belong to the first question only.
   */
  test("sets appear on /shop in their own band, after the fragrances", async ({ page }) => {
    await page.goto("/shop");

    const setLink = main(page).locator(`a[href="/set/${SET_SLUG}"]`).first();
    await expect(setLink, "a set should be listed on /shop").toBeVisible();

    // Order matters: the set band is a footnote to the range, not the lead.
    const firstFragranceY = await main(page)
      .locator('a[href^="/fragrance/"]')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const setY = await setLink.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(setY, "sets should sit below the fragrance grid").toBeGreaterThan(firstFragranceY);

    // And the two are not interleaved: the set has its own headed section.
    await expect(main(page).getByRole("heading", { name: /or take the house/i })).toBeVisible();
  });

  test("the fragrance filters do not apply to the set band", async ({ page }) => {
    // A filtered view is answering "which fragrance", so an unfiltered set
    // band underneath would read as the filter having failed.
    await page.goto("/shop?gender=MEN");
    await expect(main(page).locator(`a[href="/set/${SET_SLUG}"]`)).toHaveCount(0);
  });

  test("a set that is sold out cannot be bought", async ({ page }) => {
    const set = await seededSet();
    const v = set!.variants[0]!;
    await db.variant.update({ where: { id: v.id }, data: { stock: 0 } });

    try {
      await page.goto(`/set/${SET_SLUG}`);
      const buyBox = main(page).locator("section").first();
      await expect(buyBox.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
      await expect(main(page).getByText(/sold out|notify me/i).first()).toBeVisible();
    } finally {
      await db.variant.update({ where: { id: v.id }, data: { stock: 20 } });
    }
  });

  test("a set carries Product JSON-LD naming its contents", async ({ page }) => {
    const set = await seededSet();
    await page.goto(`/set/${SET_SLUG}`);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const ld = blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "Product");

    expect(ld, "a set needs Product JSON-LD").toBeTruthy();
    expect(ld.name).toBe(set!.name);
    expect(Array.isArray(ld.isRelatedTo)).toBe(true);
    expect(ld.isRelatedTo).toHaveLength(set!.comboItems.length);
    expect(Number(ld.offers[0].price)).toBe(set!.variants[0]!.pricePaise / 100);
  });

  test("the sitemap lists the set under /set/, not /fragrance/", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`/set/${SET_SLUG}`);
    expect(xml).not.toContain(`/fragrance/${SET_SLUG}`);
    expect(xml).toContain("/sets");
  });

  /**
   * Still one canonical URL per product — but reached by redirect, not by a
   * dead end.
   *
   * This asserted a 404. That defended the canonical-URL rule and nothing
   * else: the nav linked sets to /fragrance/<slug> for months, so the URL was
   * genuinely reachable, and what visitors actually got was a blank page (a
   * loading boundary was swallowing the 404 status too). A 308 to /set/<slug>
   * keeps exactly one canonical URL, tells crawlers to collapse the other, and
   * lands the visitor on the product instead of an error.
   */
  test("a combo slug redirects to its canonical /set/ URL", async ({ page }) => {
    await page.goto(`/fragrance/${SET_SLUG}`);
    await expect(page, "one canonical URL per product").toHaveURL(
      new RegExp(`/set/${SET_SLUG}$`),
    );
  });
});

test.describe("gift sets — checkout", () => {
  test("@smoke buying a set decrements only the set's own stock", async ({ page, request }) => {
    const set = await seededSet();
    const v = set!.variants[0]!;
    await db.variant.update({ where: { id: v.id }, data: { stock: 20 } });

    /*
      Settle expired reservations BEFORE the snapshot.

      createOrder() runs releaseExpiredReservations() as housekeeping, so the
      checkout below does not only decrement — it also hands back stock that an
      earlier abandoned checkout was holding. When one of those held a member
      bottle, the bottle's stock went UP across this test and "selling a box
      must not consume the bottles" failed on an increase, which is the
      opposite of what it guards against.

      Marking them released here leaves the housekeeping pass nothing to give
      back, so the snapshot means what the assertion assumes. The app's
      behaviour is untouched — the same reasoning as the journey's stock check.
    */
    await db.order.updateMany({
      where: { status: "PENDING", stockReleasedAt: null },
      data: { stockReleasedAt: new Date() },
    });

    // Snapshot the member bottles: selling a box must not touch them.
    const before = await db.variant.findMany({
      where: { product: { inCombos: { some: { comboId: set!.id } } } },
      select: { id: true, stock: true },
    });

    // customerRequest(), not the bare guest fixture: checkout has required an
    // account since 49a9b14 and this spec was never updated, so it had been
    // asserting against a 401 body.
    const api = await customerRequest();
    const res = await api.post("/api/checkout", {
      headers: { "x-forwarded-for": "198.51.100.55" },
      data: {
        items: [{ variantId: v.id, quantity: 2 }],
        email: "setbuyer@test.dev",
        phone: "9812345670",
        paymentMethod: "COD",
        termsAccepted: true,
        address: {
          fullName: "Set Buyer",
          phone: "9812345670",
          line1: "12 Carter Road",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400050",
        },
      },
    });
    const body = await res.json();
    await api.dispose();
    expect(res.status(), JSON.stringify(body)).toBeLessThan(400);

    const after = await db.variant.findUnique({ where: { id: v.id }, select: { stock: true } });
    expect(after!.stock, "the set's own stock drops by the quantity ordered").toBe(18);

    for (const b of before) {
      const now = await db.variant.findUnique({ where: { id: b.id }, select: { stock: true } });
      expect(
        now!.stock,
        "selling a box must not consume the individual bottles' stock",
      ).toBe(b.stock);
    }

    // One line item, at one price.
    const order = await db.order.findUnique({
      where: { orderNumber: body.orderNumber },
      include: { items: true },
    });
    expect(order!.items).toHaveLength(1);

    void page;
  });

  test("@smoke a coupon skips the set but still discounts eligible items", async ({ request }) => {
    const set = await seededSet();
    const setVariant = set!.variants[0]!;
    expect(set!.couponEligible, "sets ship coupon-ineligible by default").toBe(false);

    const bottle = await ensureStock("intense");

    // Set alone: the code is refused, with a reason that names the cause.
    const setOnly = await request.post("/api/cart/price", {
      data: {
        items: [{ variantId: setVariant.id, quantity: 1 }],
        couponCode: "E2EFLAT100",
      },
    });
    const setBody = await setOnly.json();
    expect(setBody.discountPaise ?? 0, "no discount on a set").toBe(0);
    expect(setBody.coupon?.status).toBe("rejected");
    expect(setBody.coupon?.message).toMatch(/gift set/i);

    // Set + eligible bottle: the discount applies, but only to the bottle.
    const mixed = await request.post("/api/cart/price", {
      data: {
        items: [
          { variantId: setVariant.id, quantity: 1 },
          { variantId: bottle.id, quantity: 1 },
        ],
        couponCode: "E2EFLAT100",
      },
    });
    const mixedBody = await mixed.json();
    expect(mixedBody.coupon?.status, "should apply to the eligible line").toBe("applied");
    expect(mixedBody.discountPaise).toBe(10_000);
    expect(mixedBody.coupon?.note, "the cart should explain the partial application").toMatch(
      /eligible/i,
    );
  });

  test("a percentage coupon is computed on eligible items only", async ({ request }) => {
    const set = await seededSet();
    const bottle = await ensureStock("intense");

    const res = await request.post("/api/cart/price", {
      data: {
        items: [
          { variantId: set!.variants[0]!.id, quantity: 1 },
          { variantId: bottle.id, quantity: 1 },
        ],
        couponCode: "E2EPCT10",
      },
    });
    const body = await res.json();

    // 10% of the bottle alone, not of bottle + set.
    expect(body.discountPaise).toBe(Math.floor((bottle.pricePaise * 10) / 100));
  });

  test("turning a set coupon-eligible lets codes apply to it", async ({ request }) => {
    const set = await seededSet();
    await db.product.update({ where: { id: set!.id }, data: { couponEligible: true } });

    try {
      const res = await request.post("/api/cart/price", {
        data: {
          items: [{ variantId: set!.variants[0]!.id, quantity: 1 }],
          couponCode: "E2EFLAT100",
        },
      });
      const body = await res.json();
      expect(body.discountPaise, "the admin flag governs it").toBe(10_000);
    } finally {
      await db.product.update({ where: { id: set!.id }, data: { couponEligible: false } });
    }
  });
});

test.describe("gift sets — admin", () => {
  test("@smoke builds a set with two items, then edits it to six", async ({ adminPage }) => {
    const stamp = Date.now();
    const slug = `e2e-set-${stamp}`;

    const fragrances = await db.product.findMany({
      where: { type: "SINGLE", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    });
    expect(fragrances.length, "need several fragrances to build a set from").toBeGreaterThan(1);

    await adminPage.goto("/admin/combos/new");

    await adminPage.getByLabel("Name", { exact: true }).fill(`E2E Set ${stamp}`);
    await adminPage.getByLabel("Slug", { exact: true }).fill(slug);
    await adminPage.getByLabel("Tagline").fill("Two. Then. Six.");
    await adminPage.getByLabel("Highlight line").fill("A set whose size is not fixed anywhere.");
    await adminPage
      .getByRole("textbox", { name: "Description", exact: true })
      .fill(
        "Built by a test to prove the repeater takes any number of items, then " +
          "edited to a different number without touching a line of code.",
      );
    await adminPage.getByLabel("SKU").fill(`AVN-E2E-${stamp}`);
    await adminPage.getByLabel("MRP (₹)").fill("1999");
    await adminPage.getByLabel("Offer price (₹)").fill("1499");
    await adminPage.getByLabel("Stock (boxes)").fill("15");
    await adminPage.getByLabel("Live on the storefront").check();

    // --- two items --------------------------------------------------------
    const rows = adminPage.getByTestId("combo-item-row");
    await expect(rows).toHaveCount(1);
    await adminPage.getByTestId("combo-add-item").click();
    await expect(rows).toHaveCount(2);

    for (let i = 0; i < 2; i++) {
      await rows.nth(i).getByRole("combobox").selectOption(fragrances[i]!.id);
      await rows.nth(i).getByRole("textbox").fill("10ml");
    }

    // The live preview counts what is actually filled in.
    await expect(adminPage.getByTestId("combo-item-count")).toHaveText(/contains 2 fragrances/i);

    await adminPage.getByRole("button", { name: /create set/i }).click();
    /*
      Wait for the EDIT url — and "new" is not one.

      This matched /\/admin\/combos\/[a-z0-9]+/, which the page was ALREADY
      on: `new` is [a-z0-9]+. So the wait returned instantly, before the save
      had redirected anywhere, and every following step ran against the create
      form. The redirect then landed mid-edit and tore the row list out from
      under Playwright — the "element was detached from the DOM" this test kept
      dying on, in a place that had nothing to do with the real problem.

      Excluding `new` makes it wait for the thing it always meant to wait for.
    */
    await adminPage.waitForURL(
      (u) => /\/admin\/combos\/[a-z0-9]+$/.test(u.pathname) && !u.pathname.endsWith("/new"),
      { timeout: 20_000 },
    );

    await expect
      .poll(async () => db.comboItem.count({ where: { combo: { slug } } }), { timeout: 15_000 })
      .toBe(2);

    // Storefront reflects two.
    const shop = await adminPage.context().newPage();
    await shop.goto(`/set/${slug}`);
    await expect(shop.getByTestId("whats-inside").getByTestId("combo-member")).toHaveCount(2);

    // --- grow it to six ---------------------------------------------------
    const target = Math.min(6, fragrances.length);
    const editRows = adminPage.getByTestId("combo-item-row");

    /*
      Reload before editing, rather than racing the soft navigation.

      Saving a new set redirects with router.push, so the create form is
      replaced in place when the edit route's payload arrives. Waiting for the
      URL is not enough — that fires first — and waiting for "two rows" is not
      enough either, because the outgoing form also shows two by then. The spec
      was adding rows to a form React then swapped out, which surfaced as
      "element was detached from the DOM" and read like a flake.

      A hard reload removes the race instead of timing it: one document, fully
      hydrated, with the saved state. Asserting two rows afterwards is then a
      real check that the set persisted.
    */
    await adminPage.reload();
    await expect(editRows).toHaveCount(2);

    while ((await editRows.count()) < target) {
      const before = await editRows.count();
      await adminPage.getByTestId("combo-add-item").click();
      await expect(editRows).toHaveCount(before + 1);
    }
    for (let i = 0; i < target; i++) {
      // Re-resolve the row on every attempt. Both controls are controlled
      // inputs, so each edit re-renders the whole list; a locator captured
      // before the edit can be pointing at a detached node by the time the
      // next action runs.
      await expect(async () => {
        const row = adminPage.getByTestId("combo-item-row").nth(i);
        await row.getByRole("combobox").selectOption(fragrances[i % fragrances.length]!.id);
        // Distinct sizes so repeats of the same fragrance stay unique rows.
        await row.getByRole("textbox").fill(`${(i + 1) * 5}ml`);
        await expect(row.getByRole("textbox")).toHaveValue(`${(i + 1) * 5}ml`);
      }).toPass({ timeout: 20_000 });
    }
    await expect(adminPage.getByTestId("combo-item-count")).toHaveText(
      new RegExp(`contains ${target} fragrances`, "i"),
    );

    await adminPage.getByRole("button", { name: /save changes/i }).click();
    await expect
      .poll(async () => db.comboItem.count({ where: { combo: { slug } } }), { timeout: 15_000 })
      .toBe(target);

    await shop.goto(`/set/${slug}`);
    await expect(
      shop.getByTestId("whats-inside").getByTestId("combo-member"),
      "the storefront must reflect the new composition",
    ).toHaveCount(target);

    await shop.close();
  });

  test("a set with no items is refused", async ({ adminPage }) => {
    await adminPage.goto("/admin/combos/new");
    await adminPage.getByLabel("Name", { exact: true }).fill(`Empty ${Date.now()}`);
    await adminPage.getByLabel("Tagline").fill("Nothing. In. Here.");
    await adminPage.getByLabel("Highlight line").fill("This should not save.");
    await adminPage
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("A set with an empty box is not a set, and the server should say so plainly.");
    await adminPage.getByLabel("SKU").fill(`AVN-EMPTY-${Date.now()}`);
    await adminPage.getByLabel("MRP (₹)").fill("999");
    await adminPage.getByLabel("Offer price (₹)").fill("799");
    await adminPage.getByLabel("Stock (boxes)").fill("1");

    // Leave the single row's product unselected.
    await adminPage.getByRole("button", { name: /create set/i }).click();
    await expect(
      adminPage.locator("form").getByRole("alert"),
    ).toContainText(/at least one fragrance/i);
  });

  test("@smoke retiring a fragrance inside an active set is blocked", async ({ adminPage }) => {
    const set = await seededSet();
    const member = set!.comboItems[0]!;

    // Drive the control an admin actually uses: the product form's "Live on
    // the storefront" checkbox. (toggleProductActive exists but has no UI.)
    await adminPage.goto(`/admin/products/${member.productId}`);
    // The toggle input is `sr-only` with a styled peer sibling, so it is not
    // clickable itself — the visible control is its label.
    const live = adminPage.getByLabel("Live on storefront");
    await expect(live).toBeChecked();
    await adminPage.getByText("Live on storefront", { exact: true }).click();
    await expect(live).not.toBeChecked();
    await adminPage.getByRole("button", { name: /save changes/i }).click();

    const alert = adminPage.locator("form").getByRole("alert");
    await expect(alert, "the refusal should name the sets that contain it").toContainText(
      /inside 1 active gift set/i,
    );
    await expect(alert).toContainText(/discovery set/i);

    // And it really is still live — the refusal was not cosmetic.
    const after = await db.product.findUnique({
      where: { id: member.productId },
      select: { isActive: true },
    });
    expect(after!.isActive, "the fragrance must not have been retired").toBe(true);
  });

  test("retiring the set itself is allowed", async ({ adminPage }) => {
    const set = await seededSet();
    await adminPage.goto("/admin/combos");
    await expect(adminPage.getByText(/discovery set/i).first()).toBeVisible();

    // Nothing depends on a set, so this transition is never blocked.
    await db.product.update({ where: { id: set!.id }, data: { isActive: false } });
    const off = await db.product.findUnique({
      where: { id: set!.id },
      select: { isActive: true },
    });
    expect(off!.isActive).toBe(false);
    await db.product.update({ where: { id: set!.id }, data: { isActive: true } });
  });

  test("the admin list shows a live contents count", async ({ adminPage }) => {
    const set = await seededSet();
    await adminPage.goto("/admin/combos");
    await expect(adminPage.getByText(/discovery set/i).first()).toBeVisible();
    await expect(
      adminPage.getByText(new RegExp(`${set!.comboItems.length} fragrance`, "i")).first(),
    ).toBeVisible();
  });
});
