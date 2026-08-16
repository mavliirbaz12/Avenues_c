import { test, expect, allowConsoleErrors } from "../fixtures";
import { main, nav } from "../utils/selectors";
import { db } from "../utils/db";
import { ensureStock } from "../utils/orders";

test.afterAll(() => db.$disconnect());

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
test.beforeAll(async () => {
  await db.product.deleteMany({ where: { slug: { startsWith: "e2e-set-" } } });
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

    if (set!.savingsNote) {
      await expect(body.getByText(set!.savingsNote)).toBeVisible();
    }
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

  test("the homepage band disappears when no set is active", async ({ page }) => {
    await db.product.updateMany({ where: { type: "COMBO" }, data: { isActive: false } });
    try {
      const live = await db.product.count({ where: { type: "COMBO", isActive: true } });
      expect(live, "no set should be active for this test").toBe(0);

      // Unique query string: a plain "/" can be served from Next's client
      // router cache within staleTimes, and this assertion is about the
      // server's output.
      await page.goto(`/?nocache=${Date.now()}`);
      await expect(page.getByTestId("combo-band")).toHaveCount(0);

      // And the sets page says so rather than rendering an empty grid.
      await page.goto(`/sets?nocache=${Date.now()}`);
      await expect(main(page).getByText(/no sets are boxed/i)).toBeVisible();
    } finally {
      await db.product.update({ where: { slug: SET_SLUG }, data: { isActive: true } });
    }
  });

  test("@smoke Gift sets is a first-class nav item", async ({ page }) => {
    await page.goto("/");
    await expect(nav(page).getByRole("link", { name: /gift sets/i })).toHaveAttribute(
      "href",
      "/sets",
    );
  });

  test("sets appear in shop, search and the kind filter", async ({ page }) => {
    await page.goto("/shop");
    await expect(
      main(page).locator(`a[href="/set/${SET_SLUG}"]`).first(),
      "a set should be listed in Shop All",
    ).toBeVisible();

    // Filtered to sets only: no fragrance links survive.
    await page.goto("/shop?kind=COMBO");
    const hrefs = await main(page)
      .locator('a[href^="/fragrance/"], a[href^="/set/"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(
      hrefs.every((h) => h.startsWith("/set/")),
      "the Gift sets filter should exclude single fragrances",
    ).toBe(true);
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

  test("a combo slug does not resolve under /fragrance", async ({ page }) => {
    allowConsoleErrors(page);
    const res = await page.goto(`/fragrance/${SET_SLUG}`);
    expect(res?.status(), "one canonical URL per product").toBe(404);
  });
});

test.describe("gift sets — checkout", () => {
  test("@smoke buying a set decrements only the set's own stock", async ({ page, request }) => {
    const set = await seededSet();
    const v = set!.variants[0]!;
    await db.variant.update({ where: { id: v.id }, data: { stock: 20 } });

    // Snapshot the member bottles: selling a box must not touch them.
    const before = await db.variant.findMany({
      where: { product: { inCombos: { some: { comboId: set!.id } } } },
      select: { id: true, stock: true },
    });

    const res = await request.post("/api/checkout", {
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
    await adminPage.waitForURL(/\/admin\/combos\/[a-z0-9]+/, { timeout: 20_000 });

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
    while ((await editRows.count()) < target) {
      await adminPage.getByTestId("combo-add-item").click();
    }
    for (let i = 0; i < target; i++) {
      await editRows.nth(i).getByRole("combobox").selectOption(fragrances[i % fragrances.length]!.id);
      // Distinct sizes so repeats of the same fragrance stay unique rows.
      await editRows.nth(i).getByRole("textbox").fill(`${(i + 1) * 5}ml`);
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
    await db.product.deleteMany({ where: { slug } });
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
