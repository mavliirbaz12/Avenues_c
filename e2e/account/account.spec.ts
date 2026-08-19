import { test, expect } from "../fixtures";
import { main, openEmailLogin } from "../utils/selectors";
import { db } from "../utils/db";
import { placeOrder, ensureStock, TEST_ADDRESS } from "../utils/orders";
import { CUSTOMER } from "../utils/env";

test.afterAll(() => db.$disconnect());

/**
 * My Account. Uses the signed-in customer fixture throughout.
 *
 * Anything that mutates the customer (name, password) restores it afterwards,
 * because the whole suite signs in as this user and a half-changed password
 * would take every later spec down with it.
 */

test.describe("profile", () => {
  test("@smoke shows the signed-in customer", async ({ customerPage }) => {
    await customerPage.goto("/account");
    await expect(customerPage.getByRole("heading", { level: 1 })).toContainText(CUSTOMER.name);
    await expect(main(customerPage).getByText(CUSTOMER.email)).toBeVisible();
  });

  test("editing the name persists", async ({ customerPage }) => {
    const newName = `Renamed ${Date.now()}`;

    await customerPage.goto("/account");
    const form = main(customerPage);
    const nameField = form.getByLabel("Name", { exact: true }).first();
    await nameField.fill(newName);
    await form.getByRole("button", { name: /save|update/i }).first().click();

    await expect
      .poll(
        async () =>
          (await db.user.findUnique({ where: { email: CUSTOMER.email }, select: { name: true } }))
            ?.name,
        { timeout: 15_000 },
      )
      .toBe(newName);

    // Put it back — the rest of the suite asserts on the seeded name.
    await db.user.update({ where: { email: CUSTOMER.email }, data: { name: CUSTOMER.name } });
  });

  test("the password field offers a visibility toggle", async ({ customerPage }) => {
    await customerPage.goto("/account");
    // toBeVisible auto-waits; a bare .count() does not, and raced the render.
    const toggles = main(customerPage).getByRole("button", { name: /show password/i });
    await expect(toggles.first(), "password inputs should be revealable").toBeVisible();
  });
});

test.describe("address book", () => {
  test("@smoke lists the seeded default address", async ({ customerPage }) => {
    await customerPage.goto("/account/addresses");
    await expect(main(customerPage).getByText(TEST_ADDRESS.line1)).toBeVisible();
    await expect(main(customerPage).getByText(/default/i).first()).toBeVisible();
  });

  test("adding an address stores it against the customer", async ({ customerPage }) => {
    const line1 = `E2E Address ${Date.now()}`;

    await customerPage.goto("/account/addresses");
    const add = main(customerPage).getByRole("button", { name: /add.*address|new address/i }).first();
    test.skip((await add.count()) === 0, "no add-address affordance found");
    await add.click();

    const form = main(customerPage);
    await form.getByLabel("Full name").fill("Second Home");
    await form.getByLabel("Phone", { exact: true }).first().fill(CUSTOMER.phone);
    await form.getByLabel(/flat, house/i).fill(line1);
    await form.getByLabel("City").fill("Pune");
    await form.getByLabel("State").selectOption("Maharashtra");
    await form.getByLabel("Pincode").fill("411001");
    await form.getByRole("button", { name: /save|add/i }).last().click();

    await expect
      .poll(async () => db.address.count({ where: { line1 } }), { timeout: 15_000 })
      .toBe(1);

    await db.address.deleteMany({ where: { line1 } });
  });

  test("an invalid pincode is rejected", async ({ customerPage }) => {
    await customerPage.goto("/account/addresses");
    const add = main(customerPage).getByRole("button", { name: /add.*address|new address/i }).first();
    test.skip((await add.count()) === 0, "no add-address affordance found");
    await add.click();

    const form = main(customerPage);
    const marker = `Bad pin ${Date.now()}`;
    await form.getByLabel("Full name").fill("Bad Pin");
    await form.getByLabel("Phone", { exact: true }).first().fill(CUSTOMER.phone);
    await form.getByLabel(/flat, house/i).fill(marker);
    await form.getByLabel("City").fill("Pune");
    await form.getByLabel("State").selectOption("Maharashtra");
    await form.getByLabel("Pincode").fill("12");
    await form.getByRole("button", { name: /save|add/i }).last().click();

    await customerPage.waitForTimeout(1500);
    expect(await db.address.count({ where: { line1: marker } })).toBe(0);
  });
});

test.describe("order history", () => {
  test("@smoke lists the customer's orders with a Track order button", async ({
    customerPage,
    request,
  }) => {
    // Arrange an order that belongs to this customer. Signing in claims guest
    // orders by email, so placing it against the customer's address is enough.
    const variant = await ensureStock("intense");
    const { body } = await placeOrder(request, {
      variantId: variant.id,
      email: CUSTOMER.email,
      phone: CUSTOMER.phone,
    });

    const user = await db.user.findUnique({ where: { email: CUSTOMER.email }, select: { id: true } });
    await db.order.update({
      where: { orderNumber: body.orderNumber },
      data: { userId: user!.id },
    });

    await customerPage.goto("/account/orders");
    await expect(main(customerPage).getByText(body.orderNumber)).toBeVisible();

    // The brief asks for a prominent gold Track order button per row, not a
    // bland link buried in the detail page.
    const track = main(customerPage)
      .getByRole("link", { name: /track order/i })
      .first();
    await expect(track).toBeVisible();
    await expect(track).toHaveAttribute("href", /track-order\?order=AVN-/);
  });

  test("a customer sees their own order detail without a token", async ({
    customerPage,
    request,
  }) => {
    const variant = await ensureStock("pink-aura");
    const { body } = await placeOrder(request, {
      variantId: variant.id,
      email: CUSTOMER.email,
      phone: CUSTOMER.phone,
    });
    const user = await db.user.findUnique({ where: { email: CUSTOMER.email }, select: { id: true } });
    await db.order.update({ where: { orderNumber: body.orderNumber }, data: { userId: user!.id } });

    await customerPage.goto(`/order/${body.orderNumber}`);
    await expect(customerPage).toHaveURL(new RegExp(body.orderNumber));
    await expect(main(customerPage).getByText(body.orderNumber)).toBeVisible();
  });

  test("the invoice downloads for the owner", async ({ customerPage, request }) => {
    const variant = await ensureStock("intense");
    const { body } = await placeOrder(request, {
      variantId: variant.id,
      email: CUSTOMER.email,
      phone: CUSTOMER.phone,
    });
    const user = await db.user.findUnique({ where: { email: CUSTOMER.email }, select: { id: true } });
    await db.order.update({ where: { orderNumber: body.orderNumber }, data: { userId: user!.id } });

    const res = await customerPage.request.get(`/order/${body.orderNumber}/invoice`);
    expect(res.status(), "the owner should get their invoice").toBeLessThan(400);
  });

  test("an empty history says so rather than showing a blank panel", async ({ browser }) => {
    // A second, order-free customer exists precisely for this.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // openEmailLogin, not a hand-rolled tab click: the Phone OTP tab only
    // exists when SMS is configured, and the E2E env blanks those credentials,
    // so /login renders the password form with no tab bar at all. Clicking a
    // tab that is never rendered is what made this time out.
    await openEmailLogin(page);
    await main(page).getByLabel("Email", { exact: true }).fill("fresh@test.dev");
    await main(page).getByLabel("Password", { exact: true }).fill("FreshTest!2026");
    await main(page).getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));

    await page.goto("/account/orders");
    const text = await main(page).innerText();
    expect(text.trim().length, "empty history needs a message").toBeGreaterThan(30);

    await ctx.close();
  });
});

test.describe("wishlist", () => {
  test("a signed-in wishlist persists across a reload", async ({ customerPage }) => {
    await customerPage.goto("/fragrance/intense");
    const heart = main(customerPage).getByRole("button", { name: /wishlist|save/i }).first();
    test.skip((await heart.count()) === 0, "no wishlist control");

    await heart.click();
    // Wait for the control to report the new state before navigating. The
    // toggle updates a persisted store and mirrors to the API; leaving the
    // page in the same tick can outrun the write, and the wishlist then
    // resolves an id set that does not include this product yet.
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await customerPage.goto("/wishlist");
    await expect(main(customerPage).getByText(/intense/i).first()).toBeVisible();

    await customerPage.reload();
    await expect(main(customerPage).getByText(/intense/i).first()).toBeVisible();
  });
});
