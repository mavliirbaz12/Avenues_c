/**
 * Cuts the brand marks out of the supplied lockup.
 *
 *   npm run gen:logo
 *
 * Source: assets/logo-source.jpg — the gold lockup on black, as supplied.
 * Output: public/logo-mark.png, public/logo-wordmark.png, both COMMITTED.
 *
 * WHY A SCRIPT AND NOT A ONE-OFF CROP
 * The first pass at this was done by hand and got the geometry wrong: the mark
 * was cut to 440x415 when the ring's own bounding box is 479x382 once padded, so the
 * artwork was stretched 19% vertically and the open ends of the arc were
 * pushed off the bottom edge. It read as a broken logo, which it was. Deriving
 * the crop from the pixels instead of from eyeballing it means the ratio is
 * right by construction, and re-running after a new source file is one command.
 *
 * WHY THE BLACK IS KEYED OUT
 * The lockup is gold on near-black. Left as-is it can only sit on ink; anywhere
 * else — the invoice's paper, a light admin surface — it shows as a black
 * rectangle. The key below turns luminance into alpha and unpremultiplies the
 * colour back out, so the gold survives with its gradient intact and the field
 * around it goes fully transparent.
 */
import sharp from "sharp";
import { stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets", "logo-source.jpg");
const OUT = join(ROOT, "public");

/**
 * The source is one image holding three elements stacked vertically: the ring
 * with its A, the AVENUES wordmark, and a small four-point star. These are the
 * row ranges that separate them — read off the luminance profile, generous
 * enough to survive a slightly different re-export of the same artwork.
 */
const BANDS = {
  mark: { from: 140, to: 545 },
  wordmark: { from: 546, to: 628 },
};

/**
 * Ink threshold, on a background that measures ~4/255.
 *
 * This matters more than it looks. An earlier attempt used 70, which is above
 * the luminance of the *dim* lower arc of the ring — so the measured bounding
 * box stopped short and the crop lopped the bottom off. 24 sits comfortably
 * above sensor noise and below every part of the artwork.
 */
const INK = 24;

/**
 * Anything at or below this luminance is treated as pure background.
 *
 * Sits just above the JPEG's black level (~4) and its block noise, and far
 * below the dimmest part of the artwork.
 */
const FLOOR = 14;

/** Breathing room, as a fraction of the crop's long edge. */
const PAD = 0.035;

async function bandBox(from, to) {
  const { data, info } = await sharp(SOURCE)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H } = info;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;

  for (let y = Math.max(0, from); y <= Math.min(H - 1, to); y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] > INK) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < 0) throw new Error(`No ink found between rows ${from} and ${to}.`);

  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * PAD);
  return {
    left: Math.max(0, x0 - pad),
    top: Math.max(0, y0 - pad),
    width: Math.min(W, x1 + pad + 1) - Math.max(0, x0 - pad),
    height: Math.min(H, y1 + pad + 1) - Math.max(0, y0 - pad),
  };
}

/**
 * Gold-on-black -> gold-on-transparent.
 *
 * alpha  = the pixel's own luminance (black field -> 0, bright gold -> 1)
 * colour = the pixel divided by that alpha, i.e. unpremultiplied
 *
 * Dividing back out is what keeps the mark from looking washed out over a light
 * background: without it, a mid-tone edge pixel stays mid-tone *and* becomes
 * semi-transparent, so it reads twice as dark as it should.
 */
async function keyBlack(buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = Math.max(r, g, b);

    // Rescale from the floor rather than using luminance directly.
    //
    // The source is a JPEG, so its "black" is not black: it sits around 4/255
    // and its 8x8 blocks wander a few levels either side. Straight luminance
    // turned that noise into alpha 2-12 across the whole field, and because the
    // crop is rectangular the result was a faintly visible box hanging behind
    // the mark in the nav — the exact rectangle the key was supposed to remove.
    const a = lum <= FLOOR ? 0 : Math.round(((lum - FLOOR) * 255) / (255 - FLOOR));

    data[i + 3] = a;
    if (a > 0) {
      data[i] = Math.min(255, Math.round((r * 255) / lum));
      data[i + 1] = Math.min(255, Math.round((g * 255) / lum));
      data[i + 2] = Math.min(255, Math.round((b * 255) / lum));
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function cut(name, band) {
  const box = await bandBox(band.from, band.to);
  const cropped = await sharp(SOURCE).extract(box).png().toBuffer();
  const keyed = await keyBlack(cropped);
  const file = join(OUT, `${name}.png`);
  await sharp(keyed).toFile(file);
  console.log(
    `  ${name}: ${box.width}x${box.height} (${(keyed.length / 1024).toFixed(0)} KB)` +
      `  ratio ${(box.width / box.height).toFixed(3)}`,
  );
  return box;
}

/**
 * The tab and home-screen icons.
 *
 * Cut from the same corrected mark, so a bad crop can never again live on in
 * the favicon after the on-page logo is fixed.
 *
 * Deliberately NOT transparent: a browser tab strip, an iOS home screen and a
 * bookmark bar each pick their own background, and thin gold on an unknown one
 * disappears. Painting the brand's own ink behind it means the mark reads the
 * same everywhere. Apple in particular composites onto white, and refuses to
 * round the corners of an image with alpha.
 *
 * The ring is inset rather than bled to the edges — at 16px a mark that touches
 * the border merges with whatever is next to it in the tab strip.
 */
const INK_BG = "#0B0B0D";

async function icon(file, size, inset) {
  const box = Math.round(size * inset);
  const mark = await sharp(join(OUT, "logo-mark.png"))
    .resize({ width: box, height: box, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const out = join(ROOT, "src", "app", file);
  await sharp({
    create: { width: size, height: size, channels: 4, background: INK_BG },
  })
    .composite([{ input: mark, gravity: "center" }])
    // Palette, not truecolour.
    //
    // Full-colour, the 512px icon came out at 60 KB — for something that
    // renders at 16 to 32 pixels in a tab strip. Every first-time visitor
    // downloads it before anything is painted, and unlike the page images it
    // does NOT go through /_next/image, so the raw file is what ships.
    //
    // The artwork is one gold gradient on one flat ink, which is close to the
    // best case for quantisation: 256 entries cover it with no banding worth
    // seeing at any size a favicon is ever drawn.
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toFile(out);

  const { size: bytes } = await stat(out);
  console.log(`  ${file}: ${size}x${size}  ${(bytes / 1024).toFixed(1)} KB`);
}

console.log(`Cutting marks from ${SOURCE}`);
await cut("logo-mark", BANDS.mark);
await cut("logo-wordmark", BANDS.wordmark);
await icon("icon.png", 512, 0.78);
await icon("apple-icon.png", 180, 0.72);
console.log(
  "\nThe width/height printed above are the intrinsic sizes. They must match " +
    "the `width` and `height` props on the <Image> in src/components/brand/logo.tsx " +
    "and brand-mark.tsx, or Next will letterbox the asset inside a wrong-shaped box.",
);
