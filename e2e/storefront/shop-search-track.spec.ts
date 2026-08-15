import { test, expect, allowConsoleErrors } from "../fixtures";
import { main, nav } from "../utils/selectors";
import { db } from "../utils/db";

test.afterAll(() => db.$disconnect());

test.describe("shop", () => {
  test("@smoke lists every active product", async ({ page }) => {
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
    });

    await page.goto("/shop");
    for (const p of products) {
      const short = p.name.replace(/^Avenues\s+/i, "");
      await expect(main(page).getByRole("link", { name: new RegExp(short, "i") }).first()).toBeVisible();
    }
    await expect(main(page).getByText(new RegExp(`${products.length} fragrance`, "i"))).toBeVisible();
  });

  test("gender filter narrows to the right products", async ({ page }) => {
    const men = await db.product.findMany({
      where: { isActive: true, gender: "MEN" },
      select: { name: true },
    });
    test.skip(men.length === 0, "no MEN products seeded");

    await page.goto("/shop");
    await main(page).getByRole("button", { name: /^him/i }).click();
    await page.waitForURL(/gender=/);

    for (const p of men) {
      const short = p.name.replace(/^Avenues\s+/i, "");
      await expect(main(page).getByRole("link", { name: new RegExp(short, "i") }).first()).toBeVisible();
    }

    // And a women-only product should be gone.
    const women = await db.product.findFirst({
      where: { isActive: true, gender: "WOMEN" },
      select: { name: true },
    });
    if (women) {
      const short = women.name.replace(/^Avenues\s+/i, "");
      await expect(main(page).getByRole("link", { name: new RegExp(`^${short}$`, "i") })).toHaveCount(0);
    }
  });

  test("sort by price orders the cards, not just the page", async ({ page }) => {
    // Compare the rendered card ORDER against the database rather than
    // scraping every rupee figure: each card shows the offer price AND a
    // struck-through MRP, so a naive text sweep is never monotonic.
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { slug: true, variants: { select: { pricePaise: true }, take: 1 } },
    });
    const priceOf = (slug: string) =>
      products.find((p) => p.slug === slug)?.variants[0]?.pricePaise ?? 0;

    await page.goto("/shop?sort=price-asc");
    const hrefs = await main(page)
      .locator('a[href^="/fragrance/"]')
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!.split("/").pop()!),
      );

    // One card can contain several links to the same product.
    const order: string[] = [];
    for (const slug of hrefs) if (!order.includes(slug)) order.push(slug);

    test.skip(order.length < 2, "not enough products to compare");

    const rendered = order.map(priceOf);
    const ascending = [...rendered].sort((a, b) => a - b);
    expect(rendered, "cards should be ordered cheapest first").toEqual(ascending);
  });

  test("a filter that matches nothing shows a styled empty state, not a blank page", async ({
    page,
  }) => {
    await page.goto("/shop?gender=MEN&gender=WOMEN&price=0-1");
    const body = main(page);

    // A designed empty state, not a blank grid: it must say something and
    // offer a way out of the filter.
    await expect(body.getByText(/nothing|no fragrance|no match/i).first()).toBeVisible();
    await expect(
      body.getByRole("link", { name: /show all|clear|reset|see all/i }).first(),
    ).toBeVisible();
  });

  test("a card links through to the right PDP", async ({ page }) => {
    await page.goto("/shop");
    const first = main(page).locator('a[href^="/fragrance/"]').first();
    const href = await first.getAttribute("href");
    await first.click();
    await page.waitForURL(new RegExp(href!.replace(/\//g, "\\/")));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("search", () => {
  test("@smoke finds a product by name", async ({ page }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /search/i }).click();

    const box = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
    await box.fill("night drip");
    await expect(page.getByRole("link", { name: /night drip/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("finds a product by one of its notes", async ({ page }) => {
    // Vanilla is a Night Drip base note — searching the smell, not the label,
    // is how people actually shop for perfume.
    await page.goto("/");
    await nav(page).getByRole("button", { name: /search/i }).click();

    const box = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
    await box.fill("vanilla");
    await expect(page.getByRole("link", { name: /night drip/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("a nonsense query shows an elegant empty state", async ({ page }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /search/i }).click();

    const box = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
    await box.fill("qwertyuiopzxcv");

    await expect(page.getByText(/nothing|no match|no result/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("the search API is rate limited", async ({ request }) => {
    // 40 requests per minute per IP; fire past it and expect a 429.
    const codes: number[] = [];
    for (let i = 0; i < 55; i++) {
      const r = await request.get(`/api/search?q=rate${i}`);
      codes.push(r.status());
      if (r.status() === 429) break;
    }
    expect(codes, "search should rate-limit a burst").toContain(429);
  });
});

test.describe("track order", () => {
  test("@smoke /track redirects to /track-order, keeping the prefill", async ({ page }) => {
    await page.goto("/track?order=AVN-ABC123");
    await expect(page).toHaveURL(/\/track-order/);
    expect(new URL(page.url()).searchParams.get("order")).toBe("AVN-ABC123");
  });

  test("a wrong order/contact pair reveals nothing", async ({ page }) => {
    allowConsoleErrors(page);
    await page.goto("/track-order");
    const form = main(page);

    await form.getByLabel(/order number/i).fill("AVN-NOPE01");
    await form.getByLabel(/email|mobile|contact/i).first().fill("wrong@test.dev");
    await form.getByRole("button", { name: /find my order/i }).click();

    // An error, and crucially no order detail leaking.
    await expect(form.getByRole("alert").first()).toBeVisible({ timeout: 15_000 });
    await expect(form.getByText(/delivered|out for delivery|awb/i)).toHaveCount(0);
  });

  test("the form is prefilled from the query string", async ({ page }) => {
    await page.goto("/track-order?order=AVN-PREFIL");
    await expect(main(page).getByLabel(/order number/i)).toHaveValue("AVN-PREFIL");
  });
});

test.describe("contact and enquiry", () => {
  test("@smoke a valid enquiry is stored", async ({ page }) => {
    const message = `E2E enquiry ${Date.now()}`;

    await page.goto("/contact");
    const form = main(page);
    await form.getByLabel("Name", { exact: true }).fill("Test Enquirer");
    await form.getByLabel("Email", { exact: true }).fill("enquirer@test.dev");
    await form.getByLabel("Message").fill(message);
    await form.getByRole("button", { name: /send message/i }).click();

    await expect(form.getByRole("status").first()).toBeVisible({ timeout: 20_000 });
    await expect(form.getByText(/message received/i)).toBeVisible();

    const row = await db.enquiry.findFirst({ where: { message } });
    expect(row, "enquiry should be stored").not.toBeNull();
    expect(row?.status).toBe("NEW");
  });

  test("the subject dropdown is populated", async ({ page }) => {
    // This one is a regression guard: SUBJECT_LABELS was once exported from a
    // "use server" module, which compiles to an empty proxy on the client and
    // rendered a select with zero options.
    await page.goto("/contact");
    const select = main(page).getByLabel("Subject");
    const options = await select.locator("option").count();
    expect(options, "subject select must have options").toBeGreaterThanOrEqual(4);
  });

  test("an empty enquiry is rejected", async ({ page }) => {
    await page.goto("/contact");
    const form = main(page);
    await form.getByRole("button", { name: /send message/i }).click();

    await expect(form.getByText(/message received/i)).toHaveCount(0);
    await expect(form.getByLabel("Message")).toBeVisible();
  });
});
