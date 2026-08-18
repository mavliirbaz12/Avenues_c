/**
 * Uploads local product photography to Cloudinary and attaches it to products.
 *
 *   npm run seed:images -- --dry-run     # show the mapping, upload nothing
 *   npm run seed:images                  # upload and attach
 *   npm run seed:images -- --replace     # drop existing images first
 *
 * WHY THIS GOES THROUGH CLOUDINARY RATHER THAN public/
 *
 * Committing the photos and pointing `ProductImage.url` at /products/foo.jpg
 * would work today and quietly break the admin panel forever. The image
 * manager's delete purges the CDN by `publicId`; a local file has none, so
 * removing a seeded photo would leave a dead row or an orphaned file, and
 * "replace this shot" would behave differently depending on whether the image
 * happened to be seeded or uploaded. Seeded and admin-uploaded images have to
 * be the same kind of thing, and the only kind the admin can fully manage is a
 * Cloudinary asset.
 *
 * So this uses the exact upload path the admin panel uses — same folder, same
 * 2000px ceiling, same returned publicId. Once it has run, every image on the
 * site is editable from the admin panel and nothing is special-cased.
 *
 * FILE NAMING
 *
 * Photos live in assets/products/ and are matched to products by filename:
 *
 *   <product-slug>[-<n>][-anything].<ext>
 *
 *   intense-1.jpg          -> Avenues Intense, first image (the primary)
 *   intense-2.jpg          -> Avenues Intense, second
 *   blue-mist-1-box.jpg    -> Avenues Blue Mist, first
 *   discovery-set-1.jpg    -> the Discovery Set
 *
 * The number sets the running order; the primary is whichever sorts first. A
 * filename whose slug matches nothing is reported rather than skipped
 * silently — a typo in a filename should not look like a missing photo.
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { uploadImage, destroyImage, cloudinaryLive } from "../src/lib/images/cloudinary";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "assets", "products");
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const replace = args.includes("--replace");

const prisma = new PrismaClient();

/** "intense-2-box.jpg" -> { slug: "intense", order: 2 }. Longest slug wins. */
function match(file: string, slugs: string[]) {
  const stem = basename(file, extname(file)).toLowerCase();
  // Longest first, so "discovery-set" beats a hypothetical "discovery".
  const slug = [...slugs]
    .sort((a, b) => b.length - a.length)
    .find((s) => stem === s || stem.startsWith(`${s}-`));
  if (!slug) return null;
  const rest = stem.slice(slug.length).replace(/^-/, "");
  const n = Number.parseInt(rest, 10);
  return { slug, order: Number.isFinite(n) ? n : 999 };
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`Missing ${DIR}. Put the product photography there first.`);
    process.exit(1);
  }

  const files = (await readdir(DIR)).filter((f) => EXT.has(extname(f).toLowerCase()));
  if (files.length === 0) {
    console.error(
      `No images in ${DIR}.\n` +
        "Name them <product-slug>-<n>.jpg, e.g. intense-1.jpg, intense-2.jpg.",
    );
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      images: { select: { id: true, publicId: true } },
    },
  });
  const slugs = products.map((p) => p.slug);
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const planned = new Map<string, { file: string; order: number }[]>();
  const orphans: string[] = [];

  for (const f of files) {
    const m = match(f, slugs);
    if (!m) {
      orphans.push(f);
      continue;
    }
    const list = planned.get(m.slug) ?? [];
    list.push({ file: f, order: m.order });
    planned.set(m.slug, list);
  }
  for (const list of planned.values()) {
    list.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));
  }

  console.log(`\n${files.length} file(s) in assets/products/\n`);
  for (const p of products) {
    const list = planned.get(p.slug) ?? [];
    const has = p.images.length ? `  (${p.images.length} already attached)` : "";
    console.log(`  ${p.slug.padEnd(16)} ${String(list.length).padStart(2)} photo(s)${has}`);
    list.forEach((x, i) =>
      console.log(`      ${i === 0 ? "primary" : `      ${i + 1}`}  ${x.file}`),
    );
  }

  if (orphans.length) {
    console.log(
      `\n  ${orphans.length} file(s) matched no product slug — check the names:\n` +
        orphans.map((f) => `      ${f}`).join("\n") +
        `\n  Known slugs: ${slugs.join(", ")}`,
    );
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing uploaded.\n");
    return;
  }

  if (!cloudinaryLive) {
    console.error(
      "\nCloudinary is not configured, so there is nowhere to upload to.\n" +
        "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.\n" +
        "Re-run with --dry-run to check the file-to-product mapping meanwhile.",
    );
    process.exit(1);
  }

  let uploaded = 0;
  for (const [slug, list] of planned) {
    const product = bySlug.get(slug)!;

    if (product.images.length && !replace) {
      console.log(`\n  ${slug}: already has images, skipping (use --replace to overwrite)`);
      continue;
    }

    if (product.images.length && replace) {
      // Purge the CDN as well as the rows, so --replace does not quietly leave
      // the old assets billable and orphaned in the Cloudinary folder.
      for (const img of product.images) {
        if (img.publicId) await destroyImage(img.publicId).catch(() => {});
      }
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
    }

    console.log(`\n  ${slug}:`);
    for (const [i, item] of list.entries()) {
      const buf = await readFile(join(DIR, item.file));
      const res = await uploadImage(buf, item.file);
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: res.url,
          publicId: res.publicId,
          width: res.width,
          height: res.height,
          // A real sentence beats a filename. This is a sensible default an
          // admin can improve; it never ships as an empty string.
          alt: `${product.name} — product photograph ${i + 1}`,
          position: i,
          isPrimary: i === 0,
        },
      });
      uploaded++;
      console.log(`      ${item.file} -> ${res.publicId} (${res.width}x${res.height})`);
    }
  }

  console.log(`\n${uploaded} image(s) uploaded and attached.`);
  console.log(
    "They are ordinary Cloudinary assets now — edit or replace them in the admin panel.\n",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
