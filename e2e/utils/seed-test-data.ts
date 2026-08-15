/**
 * E2E fixtures, layered on top of the normal catalogue seed.
 *
 *   npx tsx e2e/utils/seed-test-data.ts
 *
 * Run AFTER `prisma/seed.ts`. Idempotent — safe to re-run between suites.
 *
 * Everything here exists so tests can assert against known values instead of
 * whatever happens to be in the database: two customers (one with history, one
 * empty), coupons covering every rejection branch, and a deliberately
 * zero-stock variant so the sold-out path is reachable without a test having
 * to first sell out a product and leave the catalogue broken for the next one.
 */
import { PrismaClient, CouponType, Role, AddressType } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({ log: ["error"] });

const CUSTOMER = {
  email: "customer@test.dev",
  password: "CustomerTest!2026",
  name: "Test Customer",
  phone: "9812345670",
};

const FRESH_CUSTOMER = {
  email: "fresh@test.dev",
  password: "FreshTest!2026",
  name: "Fresh Customer",
  phone: "9812345671",
};

/** Slug whose 50ml variant is forced to zero stock, for sold-out assertions. */
export const SOLD_OUT_SLUG = "white-oud";
/** Slug whose 50ml variant is forced to exactly 1, for the oversell race. */
export const LAST_ONE_SLUG = "blue-mist";

async function upsertUser(u: typeof CUSTOMER, role: Role = Role.CUSTOMER) {
  const passwordHash = await bcrypt.hash(u.password, 10);
  return db.user.upsert({
    where: { email: u.email },
    // Reset the password on every run: a spec that changes it (the
    // change-password test does) must not poison the next run.
    update: { passwordHash, name: u.name, phone: u.phone, role },
    create: {
      email: u.email,
      name: u.name,
      phone: u.phone,
      passwordHash,
      role,
      emailVerified: new Date(),
    },
  });
}

async function main() {
  // --- Users --------------------------------------------------------------
  const customer = await upsertUser(CUSTOMER);
  await upsertUser(FRESH_CUSTOMER);

  // The catalogue seed sets the admin password on CREATE only
  // (`update: { role: "ADMIN" }`), so a re-run against an existing database
  // leaves whatever password was there before. Force it here, otherwise the
  // suite's very first step — signing in as admin — fails on the second run.
  await upsertUser(
    {
      email: "admin@test.dev",
      password: "AdminTest!2026",
      name: "Test Admin",
      phone: "9812345679",
    },
    Role.ADMIN,
  );

  // A default address, so checkout's saved-address path has something to
  // pre-select and the address-book spec has a row to edit.
  const existingAddress = await db.address.findFirst({
    where: { userId: customer.id, line1: "12 Carter Road" },
  });
  if (!existingAddress) {
    await db.address.create({
      data: {
        userId: customer.id,
        type: AddressType.HOME,
        fullName: CUSTOMER.name,
        phone: CUSTOMER.phone,
        line1: "12 Carter Road",
        line2: "Bandra West",
        landmark: "Opposite the bakery",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400050",
        isDefault: true,
      },
    });
  }

  // --- Coupons: one per rejection branch ----------------------------------
  const now = Date.now();
  const day = 86_400_000;

  const coupons = [
    {
      code: "E2EFLAT100",
      description: "E2E: flat ₹100 off",
      type: CouponType.FLAT,
      valuePaise: 10_000,
      minOrderPaise: 0,
      isActive: true,
    },
    {
      code: "E2EPCT10",
      description: "E2E: 10% off, capped at ₹150",
      type: CouponType.PERCENTAGE,
      valuePercent: 10,
      maxDiscountPaise: 15_000,
      minOrderPaise: 0,
      isActive: true,
    },
    {
      code: "E2EMIN5000",
      description: "E2E: needs a ₹5000 order",
      type: CouponType.FLAT,
      valuePaise: 50_000,
      minOrderPaise: 500_000,
      isActive: true,
    },
    {
      code: "E2EEXPIRED",
      description: "E2E: ended yesterday",
      type: CouponType.FLAT,
      valuePaise: 10_000,
      startsAt: new Date(now - 30 * day),
      endsAt: new Date(now - day),
      isActive: true,
    },
    {
      code: "E2EFUTURE",
      description: "E2E: starts next week",
      type: CouponType.FLAT,
      valuePaise: 10_000,
      startsAt: new Date(now + 7 * day),
      isActive: true,
    },
    {
      code: "E2EUSEDUP",
      description: "E2E: usage limit reached",
      type: CouponType.FLAT,
      valuePaise: 10_000,
      usageLimit: 1,
      usedCount: 1,
      isActive: true,
    },
    {
      code: "E2EDISABLED",
      description: "E2E: switched off in admin",
      type: CouponType.FLAT,
      valuePaise: 10_000,
      isActive: false,
    },
  ];

  for (const c of coupons) {
    // Reset usedCount too — the checkout specs redeem these.
    await db.coupon.upsert({
      where: { code: c.code },
      update: { ...c, usedCount: c.usedCount ?? 0 },
      create: c,
    });
  }

  // --- Stock fixtures -----------------------------------------------------
  const soldOut = await db.product.findUnique({
    where: { slug: SOLD_OUT_SLUG },
    select: { variants: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  if (soldOut?.variants[0]) {
    await db.variant.update({ where: { id: soldOut.variants[0].id }, data: { stock: 0 } });
  }

  const lastOne = await db.product.findUnique({
    where: { slug: LAST_ONE_SLUG },
    select: { variants: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  if (lastOne?.variants[0]) {
    await db.variant.update({ where: { id: lastOne.variants[0].id }, data: { stock: 1 } });
  }

  // Every other variant gets healthy stock, so a previous run's purchases
  // never starve the next one.
  await db.variant.updateMany({
    where: {
      product: { slug: { notIn: [SOLD_OUT_SLUG, LAST_ONE_SLUG] } },
      stock: { lt: 50 },
    },
    data: { stock: 100 },
  });

  const counts = {
    users: await db.user.count(),
    products: await db.product.count(),
    coupons: await db.coupon.count({ where: { code: { startsWith: "E2E" } } }),
    orders: await db.order.count(),
  };

  console.log("E2E fixtures ready:", counts);
  console.log(`  sold-out: ${SOLD_OUT_SLUG} (50ml stock 0)`);
  console.log(`  last-one: ${LAST_ONE_SLUG} (50ml stock 1)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
