/**
 * Brings the fragrance notes in the database in line with the printed cards.
 *
 *   npm run sync:notes -- --dry-run    # show what would change
 *   npm run sync:notes                 # write it
 *
 * WHY THIS EXISTS AS A SCRIPT
 *
 * The notes card is now the third image on every product page, so the pyramid
 * rendered from the database sits a few thumbnails away from a photograph of
 * the same pyramid. Any disagreement between them is visible to the customer
 * and reads as carelessness about the product itself — the one thing a
 * fragrance brand cannot afford to look careless about.
 *
 * The values below are transcribed from the supplied cards and are the source
 * of truth. What was in the database before was placeholder copy written during
 * the first build, and it disagreed with every single card.
 *
 * An admin can still edit any of this afterwards; this only sets the baseline.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

/**
 * Transcribed from the fragrance cards.
 *
 * `heart` is what the cards variously label "Heart" or "Middle" — the schema
 * calls it notesHeart throughout, so the wording is normalised here rather than
 * leaving two names for one tier in the data.
 */
const CARDS: Record<
  string,
  { top: string[]; heart: string[]; base: string[]; highlight?: string }
> = {
  "night-drip": {
    top: ["Apple", "Cinnamon", "Wild Lavender"],
    heart: ["Orange Blossom", "Lily of the Valley"],
    base: ["Vanilla", "Tonka Bean", "Amber", "Patchouli"],
    highlight:
      "A bold and seductive scent for the night. Warm, spicy and irresistibly captivating.",
  },
  intense: {
    top: ["Bergamot", "Ginger", "Apple"],
    heart: ["Sage", "Juniper", "Geranium"],
    base: ["Amberwood", "Tonka", "Cedarwood"],
    highlight:
      "A powerful and confident fragrance that defines strength and sophistication.",
  },
  "pink-aura": {
    top: ["Peony", "Citrus", "Mandarin", "Bergamot"],
    heart: ["Osmanthus", "Rose", "Jasmine", "Pink Pepper"],
    base: ["Patchouli", "Sandalwood", "Pink Sugar", "Musk"],
    highlight: "Floral and fruity. Feminine, elegant, and soft on the skin all day.",
  },
  "blue-mist": {
    top: ["Bergamot", "Lemon", "Apple", "Anise"],
    heart: ["Aquatic Accord", "Plum", "Orange Blossom", "Cardamom"],
    base: ["Ambergris", "Musk", "Driftwood", "Patchouli"],
    highlight:
      "A fresh and aquatic fragrance that brings energy, confidence and freshness everywhere you go.",
  },
  "white-oud": {
    top: ["Bergamot", "Ginger", "Apple", "Sage", "Juniper Berries", "Geranium"],
    heart: [
      "White Oud",
      "Saffron",
      "Cardamom",
      "Rose",
      "Jasmine",
      "Sandalwood",
      "Amber",
      "Musk",
    ],
    base: ["Tonka Bean", "Amberwood", "Cedar", "Vetiver", "Vanilla", "Patchouli"],
  },
};

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const products = await prisma.product.findMany({
    where: { slug: { in: Object.keys(CARDS) } },
    select: {
      id: true,
      slug: true,
      name: true,
      notesTop: true,
      notesHeart: true,
      notesBase: true,
      highlight: true,
    },
  });

  const missing = Object.keys(CARDS).filter((s) => !products.some((p) => p.slug === s));
  if (missing.length) {
    console.log(`\n  No product for: ${missing.join(", ")} — skipped.`);
  }

  let changed = 0;

  for (const p of products) {
    const card = CARDS[p.slug]!;
    const diffs: string[] = [];

    if (!same(p.notesTop, card.top)) {
      diffs.push(`    top    ${p.notesTop.join(", ")}\n        -> ${card.top.join(", ")}`);
    }
    if (!same(p.notesHeart, card.heart)) {
      diffs.push(`    heart  ${p.notesHeart.join(", ")}\n        -> ${card.heart.join(", ")}`);
    }
    if (!same(p.notesBase, card.base)) {
      diffs.push(`    base   ${p.notesBase.join(", ")}\n        -> ${card.base.join(", ")}`);
    }
    if (card.highlight && p.highlight !== card.highlight) {
      diffs.push(`    highlight -> "${card.highlight}"`);
    }

    if (diffs.length === 0) {
      console.log(`\n  ${p.slug}: already matches the card`);
      continue;
    }

    changed++;
    console.log(`\n  ${p.slug}:`);
    diffs.forEach((d) => console.log(d));

    if (!dryRun) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          notesTop: card.top,
          notesHeart: card.heart,
          notesBase: card.base,
          ...(card.highlight ? { highlight: card.highlight } : {}),
        },
      });
    }
  }

  console.log(
    dryRun
      ? `\n--dry-run: ${changed} product(s) would change, nothing written.\n`
      : `\n${changed} product(s) updated.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
