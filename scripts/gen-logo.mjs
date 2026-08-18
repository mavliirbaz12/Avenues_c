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
 *
 * Lowered again from 24 to 8: the two tips of the crescent taper to a point and
 * fade as they go, so 24 clipped the last few pixels of each and the padding
 * that followed was measured from the wrong place.
 */
const INK = 8;

/**
 * Anything at or below this luminance is treated as pure background.
 *
 * Sits just above the JPEG's black level (~4) and its block noise, and far
 * below the dimmest part of the artwork.
 */
const FLOOR = 14;

/** Breathing room taken from the source, as a fraction of the crop's long edge. */
const PAD = 0.035;

/**
 * Final margin on every side, as a fraction of the ink's SHORT edge.
 *
 * Short, not long, and the wordmark is why. AVENUES is 578x55 — measuring the
 * margin against 578 gave it a 46px border, which left the letters occupying
 * 37% of their own box. Sized by that box in the nav they rendered at about
 * eight pixels tall: the brand name reduced to a caption beside its own mark.
 * Against the short edge the two assets come out consistent, ~86% ink each.
 */
const PAD_EVEN = 0.08;

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

/**
 * Gives the artwork the same margin on all four sides.
 *
 * `bandBox` already pads, but only with black it can actually reach. Below the
 * mark it cannot reach far: the crescent's tips end at y=527 and the AVENUES
 * wordmark starts at y=561, so there are 34 pixels of clear source and no more.
 * The tips came out roughly ten pixels from the edge — which at nav size is a
 * single pixel, and reads as a circle with its bottom sliced off.
 *
 * So the shortfall is added as transparency. Even margins also mean the ink
 * stays optically centred in its own box, which is what lets the mark line up
 * with the wordmark beside it without hand-tuned offsets at every size.
 */
async function padEvenly(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  const iw = x1 - x0 + 1;
  const ih = y1 - y0 + 1;
  const want = Math.round(Math.min(iw, ih) * PAD_EVEN);

  // Trim to the ink first, THEN extend. Adding margin without removing what is
  // already there leaves whatever `bandBox` happened to include — which for the
  // wordmark was 26 rows top and bottom, so the letters stayed at half their
  // box height and the "even" margin added nothing. Cutting back to the ink
  // makes this step the single authority on the final geometry.
  const out = await sharp(buf)
    .extract({ left: x0, top: y0, width: iw, height: ih })
    .extend({
      left: want,
      right: want,
      top: want,
      bottom: want,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const w = iw + want * 2;
  const h = ih + want * 2;
  console.log(`      ink ${iw}x${ih} + ${want}px margin -> ${w}x${h} (${((ih / h) * 100).toFixed(0)}% ink)`);
  return { buf: out, width: w, height: h };
}

async function cut(name, band) {
  const box = await bandBox(band.from, band.to);
  const cropped = await sharp(SOURCE).extract(box).png().toBuffer();
  const keyedRaw = await keyBlack(cropped);
  const padded = await padEvenly(keyedRaw);
  const keyed = padded.buf;
  box.width = padded.width;
  box.height = padded.height;
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
 * The tab icon is TRANSPARENT. Painting the brand's ink behind it looked right
 * on a dark tab strip and wrong everywhere else — a black tile against a light
 * strip, a bookmark bar, or a browser using the system accent. Transparency
 * lets the mark sit on whatever the browser is already using.
 *
 * The Apple icon keeps its ground, and that is not an inconsistency. iOS does
 * not honour alpha in a home-screen icon: it composites onto white and then
 * rounds the corners itself. A thin gold ring on white is close to invisible at
 * 60pt, so this one is painted on ink deliberately.
 *
 * The ring is inset rather than bled to the edges — at 16px a mark touching the
 * border merges with whatever sits next to it in the tab strip.
 */
const INK_BG = "#0B0B0D";

async function icon(file, size, inset, ground) {
  const box = Math.round(size * inset);
  const mark = await sharp(join(OUT, "logo-mark.png"))
    .resize({ width: box, height: box, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const out = join(ROOT, "src", "app", file);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ground ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
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
await icon("icon.png", 512, 0.95);
await icon("apple-icon.png", 180, 0.72, INK_BG);
console.log(
  "\nThe width/height printed above are the intrinsic sizes. They must match " +
    "the `width` and `height` props on the <Image> in src/components/brand/logo.tsx " +
    "and brand-mark.tsx, or Next will letterbox the asset inside a wrong-shaped box.",
);
