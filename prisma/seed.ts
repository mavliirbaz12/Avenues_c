/**
 * Seeds the launch catalogue: one ADMIN account, two collections, and the five
 * fragrances Avenues opens with.
 *
 * Idempotent — every write is an upsert keyed on a natural unique (email, slug,
 * sku), so running it repeatedly against a live database is safe. It never
 * deletes and never touches order data.
 *
 *   npm run db:seed
 */
import { PrismaClient, Gender, CouponType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MRP = 119900; // ₹1,199 in paise
const PRICE = 99900; // ₹999 — placeholder offer price, admin-editable
const OPENING_STOCK = 50;

/** Boilerplate that is genuinely identical across the range. */
const CAUTION = [
  "For external use only. Keep away from direct sunlight, heat and open flame — the alcohol base is flammable.",
  "Store upright below 30°C. Avoid contact with eyes and with broken or irritated skin.",
  "Do not spray directly onto silk, pearls or polished leather.",
  "If you have sensitive skin, patch test on the inner forearm and wait twenty-four hours before full use.",
  "Discontinue if irritation occurs. Keep out of reach of children.",
].join(" ");

const HOW_TO_USE = [
  "Spray twice onto pulse points — the base of the throat and the inside of each wrist — holding the bottle about fifteen centimetres from the skin.",
  "A third spray on the chest, under the shirt, carries the scent through the day without projecting into a room.",
  "Do not rub your wrists together. Friction breaks the top notes and cuts the wear short.",
  "Apply to skin rather than fabric where you can; skin warmth is what opens the heart and base.",
].join(" ");

type SeedProduct = {
  slug: string;
  name: string;
  tagline: string;
  highlight: string;
  gender: Gender;
  description: string;
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  occasions: string[];
  whyChoose: string[];
  longevity: string;
  /** How the scent opens, turns and settles — the lead-in above the pyramid. */
  sensoryNarrative: string;
  /** One line of season/occasion guidance, shown beside the occasion chips. */
  bestFor: string;
  sku: string;
  sortOrder: number;
  metaDescription: string;
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: "intense",
    name: "Avenues Intense",
    tagline: "Bold. Fresh. Powerful.",
    highlight: "Make your presence unforgettable.",
    gender: Gender.MEN,
    sku: "AVN-INT-50",
    sortOrder: 1,
    longevity: "8-10 hours",
    description:
      "Intense opens cold. Bergamot cut with lavender, sharp enough to turn a head at arm's length. Within the hour it warms — orange blossom and geranium soften the edge without dulling it — and what finally settles is amber over cedarwood, dry and resinous and close to the skin. It was built for long days: it reads as competence at nine in the morning and as something else entirely by nine at night.",
    sensoryNarrative:
      "Bergamot arrives first and it arrives cold — bright, bitter at the edge, sharpened by lavender rather than softened. Orange blossom and geranium turn it warmer through the middle hours without ever making it sweet. What is left after that is amber over cedarwood: dry, resinous, and worn close enough that people have to be near you to place it.",
    bestFor:
      "An all-season signature. Office-safe in daylight, considerably less so after dark.",
    notesTop: ["Bergamot", "Lavender"],
    notesHeart: ["Orange Blossom", "Geranium"],
    notesBase: ["Amber", "Cedarwood"],
    occasions: ["Daily Wear", "Office", "Parties"],
    whyChoose: [
      "A bright citrus opening that does not collapse by noon",
      "Amber and cedarwood dry-down that stays close to the skin",
      "Eight to ten hours of wear, tested through an Indian summer",
      "Restrained enough for the office, assertive enough after dark",
      "Eau de parfum concentration — not a diluted toilette",
    ],
    metaDescription:
      "Avenues Intense — bergamot and lavender over amber and cedarwood. A bold, fresh eau de parfum for men. 50ml, 8-10 hours of wear.",
  },
  {
    slug: "pink-aura",
    name: "Avenues Pink Aura",
    tagline: "Soft. Elegant. Feminine.",
    highlight: "A fragrance as soft and beautiful as your aura.",
    gender: Gender.WOMEN,
    sku: "AVN-PNK-50",
    sortOrder: 2,
    longevity: "8-10 hours",
    description:
      "Pink Aura begins the way a room does when someone walks into it. Peony first, lifted by a thread of citrus, light enough to feel like air. Then the rose arrives, and with it osmanthus — apricot-soft, faintly powdery. The base is where it stops being merely pretty: sandalwood and patchouli, warm and grounded, the part people notice on you hours later without quite knowing why.",
    sensoryNarrative:
      "Peony opens it almost weightlessly, lifted by a thread of citrus — the first minutes feel like air moving through a room. Rose takes over, and osmanthus arrives with it, apricot-soft and faintly powdery. Then sandalwood and patchouli settle underneath and give the whole thing gravity. That base is the reason people notice it on you hours later without being able to say why.",
    bestFor:
      "Year-round, and best in daylight — though it turns noticeably warmer on skin after sunset.",
    notesTop: ["Peony", "Citrus Accords"],
    notesHeart: ["Rose", "Osmanthus"],
    notesBase: ["Sandalwood", "Patchouli"],
    occasions: ["Daily Wear", "Dates", "Parties"],
    whyChoose: [
      "Floral without being sugary — osmanthus keeps the rose honest",
      "Sandalwood base gives it weight that most pink florals lack",
      "Sits close for daytime, opens up with body heat in the evening",
      "Eight to ten hours of wear from two sprays",
      "Eau de parfum concentration — not a diluted toilette",
    ],
    metaDescription:
      "Avenues Pink Aura — peony and rose over sandalwood and patchouli. A soft, elegant eau de parfum for women. 50ml, 8-10 hours of wear.",
  },
  {
    slug: "night-drip",
    name: "Avenues Night Drip",
    tagline: "Sweet. Bold. Addictive.",
    highlight: "Own the night with every drop.",
    gender: Gender.MEN,
    sku: "AVN-NGT-50",
    sortOrder: 3,
    longevity: "8-12 hours",
    description:
      "Apple and cinnamon — sweet, and slightly wrong in the best possible way. The opening of Night Drip is a dare. Orange blossom stops it tipping into dessert, and then vanilla, tonka bean and amber pour in and simply stay. This is the bottle you reach for at ten at night. It sits heavy on skin, sweet without being juvenile, and it is still on your collar in the morning.",
    sensoryNarrative:
      "Apple and cinnamon open it sweet and slightly wrong in the best possible way — a dare, in the first ten minutes. Orange blossom cuts across the middle and stops it collapsing into dessert. Then vanilla, tonka bean and amber pour in and simply refuse to leave. It sits heavy and close, and it is still on your collar the next morning.",
    bestFor:
      "Cooler weather and after dark. Too much for a summer afternoon, exactly right for a winter evening.",
    notesTop: ["Apple", "Cinnamon"],
    notesHeart: ["Orange Blossom"],
    notesBase: ["Vanilla", "Tonka Bean", "Amber"],
    occasions: ["Night Out", "Parties", "Dates"],
    whyChoose: [
      "The longest wear in the range — eight to twelve hours",
      "Gourmand sweetness anchored by tonka and amber, never cloying",
      "Projects across a room for the first two hours, then draws in close",
      "Built for cold weather and late evenings",
      "Eau de parfum concentration — not a diluted toilette",
    ],
    metaDescription:
      "Avenues Night Drip — apple and cinnamon over vanilla, tonka bean and amber. A sweet, addictive eau de parfum. 50ml, 8-12 hours of wear.",
  },
  {
    slug: "blue-mist",
    name: "Avenues Blue Mist",
    tagline: "Fresh. Clean. Elegant.",
    highlight: "Experience freshness that lasts all day.",
    gender: Gender.UNISEX,
    sku: "AVN-BLU-50",
    sortOrder: 4,
    longevity: "8-10 hours",
    description:
      "Blue Mist is cold water and clean cotton. Citrus and an aquatic accord open it sharp and transparent; a marine heart, salted and faintly floral, holds the middle. Musk and soft woods close it without weight. It is the most wearable thing we make — the fragrance for the eight a.m. meeting, the flight, the shirt you want to smell like nothing, only better.",
    sensoryNarrative:
      "Citrus and an aquatic accord open it sharp and transparent — cold water, clean cotton, nothing hiding. A marine heart holds the middle, salted and only faintly floral, so it stays crisp rather than turning sweet. Musk and soft woods close it without adding weight. It is the least demanding thing we make, and the hardest to get wrong.",
    bestFor:
      "An everyday, all-season signature. Holds its shape in heat and humidity, which is the whole point.",
    notesTop: ["Citrus", "Fresh Aquatic"],
    notesHeart: ["Marine", "Floral"],
    notesBase: ["Musk", "Woody"],
    occasions: ["Daily Wear"],
    whyChoose: [
      "The safest choice in the range — worn by anyone, anywhere",
      "Aquatic freshness that holds up in humidity",
      "Clean musk base that never turns soapy",
      "Eight to ten hours of wear from two sprays",
      "Eau de parfum concentration — not a diluted toilette",
    ],
    metaDescription:
      "Avenues Blue Mist — citrus and aquatic notes over musk and soft woods. A fresh, clean unisex eau de parfum. 50ml, 8-10 hours of wear.",
  },
  {
    slug: "white-oud",
    name: "Avenues White Oud",
    tagline: "Rich. Warm. Luxurious.",
    highlight: "Experience the true essence of luxury.",
    gender: Gender.UNISEX,
    sku: "AVN-WOD-50",
    sortOrder: 5,
    longevity: "8-10 hours",
    description:
      "Saffron opens White Oud with a dry, almost metallic warmth, and the spice beneath it takes a moment to bloom. Rose and oud meet in the heart — the oldest pairing in perfumery and still the most persuasive, one of them bright and the other smoky and animalic. Amber and musk finish it soft. Worn sparingly it is elegant; worn generously it is a statement, and it apologises for neither.",
    sensoryNarrative:
      "Saffron opens it dry, warm and very nearly metallic, and the spice underneath takes a minute to bloom. Then rose and oud meet in the heart — the oldest pairing in perfumery and still the most persuasive, one of them bright and the other smoky and faintly animalic. Amber and musk close it soft. Two sprays reads as elegant; four reads as a statement, and it apologises for neither.",
    bestFor:
      "Winter evenings, weddings and anything that warrants a jacket. Wear it sparingly in daylight.",
    notesTop: ["Saffron", "Spicy Accords"],
    notesHeart: ["Rose", "Oud"],
    notesBase: ["Amber", "Musk"],
    occasions: ["Special Occasions", "Evening Wear"],
    whyChoose: [
      "A rose-oud accord that usually sits at four times the price",
      "Saffron opening gives it lift where most ouds start heavy",
      "Reads formal — made for weddings, evenings and occasions",
      "Two sprays is enough; this one rewards restraint",
      "Eau de parfum concentration — not a diluted toilette",
    ],
    metaDescription:
      "Avenues White Oud — saffron and spice over rose, oud, amber and musk. A rich, luxurious unisex eau de parfum. 50ml, 8-10 hours of wear.",
  },
];

const COLLECTIONS = [
  {
    slug: "the-signature-five",
    title: "The Signature Five",
    subtitle: "The opening chapter",
    description:
      "Five fragrances, one intention: to be remembered. This is everything Avenues launched with, in the order we think you should meet them.",
    sortOrder: 1,
    members: ["intense", "pink-aura", "night-drip", "blue-mist", "white-oud"],
  },
  {
    slug: "after-dark",
    title: "After Dark",
    subtitle: "For the hours that matter",
    description:
      "Heavier, sweeter, slower to leave. The two we would wear past midnight.",
    sortOrder: 2,
    members: ["night-drip", "white-oud"],
  },
];

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@avenuesperfumes.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
  const name = process.env.SEED_ADMIN_NAME ?? "Avenues Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  // Only set the password on create — re-seeding must not reset a rotated
  // admin password back to the value sitting in .env.
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, name, passwordHash, role: "ADMIN", emailVerified: new Date() },
  });

  console.log(`  admin        ${user.email}`);
  return user;
}

async function seedProducts() {
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        tagline: p.tagline,
        highlight: p.highlight,
        description: p.description,
        gender: p.gender,
        notesTop: p.notesTop,
        notesHeart: p.notesHeart,
        notesBase: p.notesBase,
        occasions: p.occasions,
        whyChoose: p.whyChoose,
        howToUse: HOW_TO_USE,
        caution: CAUTION,
        longevity: p.longevity,
        sensoryNarrative: p.sensoryNarrative,
        bestFor: p.bestFor,
        sortOrder: p.sortOrder,
        metaTitle: `${p.name} — ${p.tagline}`,
        metaDescription: p.metaDescription,
      },
      create: {
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        highlight: p.highlight,
        description: p.description,
        concentration: "Eau De Parfum",
        gender: p.gender,
        notesTop: p.notesTop,
        notesHeart: p.notesHeart,
        notesBase: p.notesBase,
        occasions: p.occasions,
        whyChoose: p.whyChoose,
        howToUse: HOW_TO_USE,
        caution: CAUTION,
        longevity: p.longevity,
        sensoryNarrative: p.sensoryNarrative,
        bestFor: p.bestFor,
        isActive: true,
        isFeatured: true,
        sortOrder: p.sortOrder,
        metaTitle: `${p.name} — ${p.tagline}`,
        metaDescription: p.metaDescription,
      },
    });

    // 50ml is the launch size. 100ml can be added from the admin panel at any
    // time and the storefront variant selector picks it up with no code change.
    await prisma.variant.upsert({
      where: { sku: p.sku },
      update: { mrpPaise: MRP, isActive: true },
      create: {
        productId: product.id,
        size: "50ml",
        sku: p.sku,
        mrpPaise: MRP,
        pricePaise: PRICE,
        stock: OPENING_STOCK,
        isActive: true,
        sortOrder: 0,
      },
    });

    console.log(`  product      ${p.name}`);
  }
}

async function seedCollections() {
  for (const c of COLLECTIONS) {
    const collection = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: { title: c.title, subtitle: c.subtitle, description: c.description },
      create: {
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        isActive: true,
        sortOrder: c.sortOrder,
      },
    });

    for (const [i, slug] of c.members.entries()) {
      const product = await prisma.product.findUnique({ where: { slug } });
      if (!product) continue;
      await prisma.productCollection.upsert({
        where: {
          productId_collectionId: { productId: product.id, collectionId: collection.id },
        },
        update: { position: i },
        create: { productId: product.id, collectionId: collection.id, position: i },
      });
    }

    console.log(`  collection   ${c.title} (${c.members.length})`);
  }
}

/**
 * No live coupons at launch — the founder creates those from /admin/coupons.
 * This one is created disabled so the coupon machinery has something to prove
 * itself against in development. Enable it in admin to try the flow.
 */
async function seedSampleCoupon() {
  await prisma.coupon.upsert({
    where: { code: "AVENUES10" },
    update: {},
    create: {
      code: "AVENUES10",
      description: "Sample coupon — disabled. Enable from admin to test the flow.",
      type: CouponType.PERCENTAGE,
      valuePercent: 10,
      minOrderPaise: 99900,
      maxDiscountPaise: 20000,
      perUserLimit: 1,
      isActive: false,
    },
  });
  console.log("  coupon       AVENUES10 (disabled)");
}

/**
 * The single settings row. Only created, never overwritten — re-seeding must
 * not stomp shipping rates or support numbers the founder has since edited.
 */
async function seedSettings() {
  await prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shippingFlatPaise: 7900,
      freeShippingThresholdPaise: 99900,
      codEnabled: true,
      codFeePaise: 4900,
      supportEmail: "support@avenuesperfumes.com",
      customerCareEmail: "care@avenuesperfumes.com",
      manufacturerName: "Avenues Perfumes",
      manufacturerAddress:
        "Marketed by Avenues Perfumes. Add your full registered address, city, state and PIN from Admin → Settings before going live.",
      invoicePrefix: "AVN",
      invoiceNextNumber: 1,
      announcementText: "Free shipping on all orders",
      announcementHref: "/shop",
      announcementEnabled: true,
    },
  });
  console.log("  settings     store defaults");
}

async function main() {
  console.log("\nSeeding Avenues\n");
  await seedSettings();
  await seedAdmin();
  await seedProducts();
  await seedCollections();
  await seedSampleCoupon();
  console.log("\nDone.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
