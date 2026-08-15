/**
 * Generates the scroll-reveal frame sequence.
 *
 * The landing page pins a section and scrubs through these frames as you
 * scroll: an extreme macro on the engraved monogram pulling back to the whole
 * bottle. Run via `npm run gen:sequence`; output lands in public/sequence/
 * and is gitignored, so it regenerates on deploy rather than committing 240
 * binaries.
 *
 * WHY RE-RENDER RATHER THAN CROP ONE BIG RASTER
 * The bottle is vector. Rendering the SVG once and extracting crops would
 * upscale the macro frames into mush — frame 0 shows a region 32 units wide
 * out of a 240-unit artboard, a 7.5x magnification. Re-rasterising per frame
 * keeps the gold engraving sharp at every zoom level, which is the whole point
 * of opening on it.
 *
 * WHY GEOMETRIC INTERPOLATION
 * Lerping the viewBox width linearly reads as an accelerating zoom, because
 * perceived zoom tracks the ratio, not the difference. Stepping it
 * geometrically (w0 * (w1/w0)^t) gives the constant-rate pull-back a camera
 * would.
 *
 * NOTE: the SVG below mirrors src/components/brand/bottle-figure.tsx. It is
 * duplicated rather than imported because that file is a TSX client component
 * using useId(), which this plain Node script cannot render. Both are
 * placeholder art — when real bottle photography or a turntable render
 * arrives, the frames are dropped into public/sequence/ directly and this
 * script goes away. Keep them in sync until then.
 */
import { mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "sequence");

/** Must match FRAME_COUNT in src/components/landing/bottle-reveal.tsx. */
const FRAMES = 120;

/**
 * Frame aspect matches the device it plays on, so the canvas fills the pinned
 * stage without letterboxing. Rendering everything at the bottle's native 2:3
 * left black bars down both sides of a laptop screen — the section has to read
 * as full-bleed, not as a portrait image floating in a void.
 *
 * `endW` is the viewBox width of the final frame: wide enough that the whole
 * bottle (240x360 on the artboard) fits inside the matching height.
 */
const SIZES = [
  { name: "lg", width: 1200, height: 750, endW: 600 }, // 1.6:1 — laptop/desktop
  { name: "sm", width: 640, height: 1100, endW: 268 }, // 0.58:1 — phone portrait
];

const INK = "#0B0B0D";
const TINT = "#C9A24B"; // Avenues gold — the hero bottle, not a per-scent tint.

// Camera path. Start: tight on the monogram, which sits at (120, 214) on the
// artboard. End: the whole bottle, recomposed centre-frame at (120, 180).
const START_CENTRE = { cx: 120, cy: 214 };
const END_CENTRE = { cx: 120, cy: 180 };
/** Opening viewBox width — 32 units of a 240-unit artboard, a 7.5x macro. */
const START_W = 32;

const lerp = (a, b, t) => a + (b - a) * t;

function viewBoxAt(t, size) {
  // Geometric on width, linear on the centre: the camera dollies back at a
  // constant perceived rate while drifting up to recompose.
  const w = START_W * Math.pow(size.endW / START_W, t);
  const h = w * (size.height / size.width);
  const cx = lerp(START_CENTRE.cx, END_CENTRE.cx, t);
  const cy = lerp(START_CENTRE.cy, END_CENTRE.cy, t);
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
}

function bottleSvg(viewBox, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="halo" cx="50%" cy="56%" r="46%">
      <stop offset="0%" stop-color="${TINT}" stop-opacity="0.34"/>
      <stop offset="55%" stop-color="${TINT}" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="${TINT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#26262B"/><stop offset="34%" stop-color="#141417"/>
      <stop offset="72%" stop-color="#0C0C0E"/><stop offset="100%" stop-color="#1A1A1F"/>
    </linearGradient>
    <linearGradient id="cap" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1F1F24"/><stop offset="22%" stop-color="#3A3A42"/>
      <stop offset="46%" stop-color="#131316"/><stop offset="78%" stop-color="#2A2A31"/>
      <stop offset="100%" stop-color="#0E0E10"/>
    </linearGradient>
    <linearGradient id="spec" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F2EDE3" stop-opacity="0"/>
      <stop offset="45%" stop-color="#F2EDE3" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#F2EDE3" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${TINT}" stop-opacity="0"/>
      <stop offset="40%" stop-color="${TINT}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${TINT}" stop-opacity="0.12"/>
    </linearGradient>
    <linearGradient id="gold" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#F0DBA4"/><stop offset="45%" stop-color="#C9A24B"/>
      <stop offset="100%" stop-color="#8A6B2A"/>
    </linearGradient>
  </defs>

  <ellipse cx="120" cy="196" rx="112" ry="140" fill="url(#halo)"/>

  <rect x="94" y="30" width="52" height="62" rx="3" fill="url(#cap)"/>
  <rect x="94" y="30" width="52" height="62" rx="3" fill="none" stroke="#3A3A42" stroke-width="0.6"/>
  <rect x="102" y="92" width="36" height="14" rx="1.5" fill="#0E0E10" stroke="#2E2E35" stroke-width="0.5"/>

  <path d="M64 138 C64 118 82 106 120 106 C158 106 176 118 176 138 L176 316 C176 325 170 330 161 330 L79 330 C70 330 64 325 64 316 Z"
        fill="url(#glass)" stroke="#33333A" stroke-width="0.8"/>

  <path d="M64 140 C64 120 82 108 118 107" stroke="url(#rim)" stroke-width="1.6" fill="none"/>
  <path d="M66 150 L66 314" stroke="url(#rim)" stroke-width="1.4" fill="none"/>
  <path d="M174 150 L174 314" stroke="url(#rim)" stroke-width="1" fill="none" opacity="0.55"/>

  <rect x="80" y="132" width="16" height="176" rx="8" fill="url(#spec)"/>

  <g transform="translate(120 214) scale(0.66) translate(-50 -50)" opacity="0.92">
    <path d="M69.4 14.2 A43 43 0 1 1 30.6 14.2 A39 39 0 1 0 69.4 14.2 Z" fill="url(#gold)"/>
    <path d="M50 20 L74.5 76 L63.5 76 L50 44 L37.5 76 L30.5 76 Z" fill="url(#gold)"/>
    <path d="M27 71.5 C36 60 56 55 71 56.8 C81 58 89 62.5 94 69.5 C88.5 63.5 80.5 59.8 71 58.7 C56.5 57 39.5 61.8 27 71.5 Z" fill="url(#gold)"/>
  </g>

  <ellipse cx="120" cy="333" rx="62" ry="7" fill="#000" opacity="0.55"/>
</svg>`;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  let bytes = 0;

  for (const size of SIZES) {
    const height = size.height;

    for (let i = 0; i < FRAMES; i++) {
      const t = FRAMES === 1 ? 1 : i / (FRAMES - 1);
      const svg = bottleSvg(viewBoxAt(t, size), size.width, height);

      const buf = await sharp(Buffer.from(svg), { density: 300 })
        .resize(size.width, height, { fit: "fill" })
        // Bake the page background in. A transparent PNG would cost alpha
        // bytes for a canvas that always draws onto the same ink ground.
        .flatten({ background: INK })
        .webp({ quality: 82, effort: 5 })
        .toBuffer();

      const name = `${size.name}-${String(i).padStart(4, "0")}.webp`;
      await writeFile(join(OUT, name), buf);
      bytes += buf.length;
    }

    process.stdout.write(`  ${size.name}: ${FRAMES} frames @ ${size.width}x${height}\n`);
  }

  const files = await readdir(OUT);
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log(`\n${files.length} frames written to public/sequence/ — ${mb(bytes)} total`);

  // Report per-variant totals, since the mobile budget is the one that matters.
  for (const size of SIZES) {
    const own = files.filter((f) => f.startsWith(`${size.name}-`));
    console.log(`  ${size.name}: ${own.length} frames`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
