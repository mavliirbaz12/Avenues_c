/**
 * Generates the scroll-reveal frame sequence from the product film.
 *
 *   npm run gen:sequence
 *
 * Source: assets/hero-reveal.mp4 — the 16:9 studio clip of the bottle on silk.
 * Output: public/sequence/{lg,sm}-NNNN.webp, which ARE committed.
 *
 * WHY THIS IS NOT PART OF `npm run build`
 * It shells out to ffmpeg, and Vercel's build image does not have ffmpeg. So
 * the frames are generated here, on a machine that does, and committed. Run it
 * again whenever the film changes; nothing else needs to know.
 *
 * WHY TWO DIFFERENT CROPS
 * The film is 16:9. The pinned stage is roughly 1.6:1 on a laptop and 0.46:1 on
 * a phone — those cannot be served by one frame without either cropping the
 * bottle out of shot or letterboxing it into a stamp.
 *
 *   lg  the full 16:9 frame, padded top and bottom to 1.6:1
 *   sm  a 4:5 centre crop (verified to keep the bottle in shot across the whole
 *       clip), padded to roughly phone ratio
 *
 * Both are padded with the page's own ink, so the canvas can use `cover` and
 * the padding is invisible against the background — no letterbox bars, no
 * cropped subject, and no special-casing in the component.
 */
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets", "hero-reveal.mp4");
const OUT = join(ROOT, "public", "sequence");

/** Must match FRAME_COUNT in src/components/landing/bottle-reveal.tsx. */
const FRAMES = 120;

const INK = "0x0B0B0D";

/**
 * Source geometry, from `ffprobe`: 1024x576, 24fps, ~6s, 145 frames.
 * The 4:5 crop is 461 wide centred at x=281 — checked frame by frame against
 * the clip so the bottle never leaves the crop.
 */
/**
 * NOTHING IS UPSCALED.
 *
 * The film is 1024x576. An earlier version of this script enlarged it to
 * 1280x720 before padding, which cost about 40% more bytes and added exactly
 * zero detail — interpolation cannot invent what the sensor did not record.
 * The frames now stay at native width and only the ink padding is added.
 *
 * That makes the SOURCE the ceiling on sharpness, which is the honest position:
 * on a 1440px stage at devicePixelRatio 2 the browser is asked for 2880 device
 * pixels and has 1024 real ones. For a crisp full-screen reveal the film needs
 * re-exporting at 1920x1080 or better; until then, upscaling here would only
 * make the file bigger while looking identical.
 */
/**
 * NO PADDING EITHER, now that the canvas uses `contain`.
 *
 * The bars existed so `cover` had something safe to crop. With `contain` the
 * frame is never cut, so every pixel spent on black was a pixel not spent on
 * the bottle — and against an already-low-resolution source that mattered:
 * the padded desktop frame was 1024x640 of which 64 rows were ink, and the
 * padded phone frame was 461x936 of which 360 rows were.
 *
 * The letterbox is now drawn by the page itself, in exactly the same ink,
 * which costs nothing and renders the subject larger.
 */
const VARIANTS = [
  { name: "lg", filter: "null" },                        // the frame as shot
  { name: "sm", filter: "crop=461:576:281:0" },          // 4:5 centre crop
];

async function ffmpegAvailable() {
  try {
    await run("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(
      `Missing ${SOURCE}.\n` +
        "The committed frames in public/sequence/ are what the site actually " +
        "serves, so this is only an error if you meant to regenerate them.",
    );
    process.exit(1);
  }

  if (!(await ffmpegAvailable())) {
    console.error(
      "ffmpeg is not on PATH. Install it (winget install Gyan.FFmpeg) and re-run.\n" +
        "This script is deliberately NOT part of `npm run build` — the frames it " +
        "produces are committed, because the deploy environment has no ffmpeg.",
    );
    process.exit(1);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // Resample 145 source frames down to exactly FRAMES, evenly across the clip.
  const total = 145;
  const fps = (24 * FRAMES) / total;

  for (const v of VARIANTS) {
    await run("ffmpeg", [
      "-v", "error",
      "-i", SOURCE,
      "-vf", `fps=${fps.toFixed(4)},${v.filter}`,
      "-frames:v", String(FRAMES),
      "-c:v", "libwebp",
      "-quality", "78",
      "-compression_level", "5",
      "-an",
      join(OUT, `${v.name}-%04d.webp`),
      "-y",
    ]);

    // ffmpeg numbers from 1; the component asks for 0000-0119.
    const files = (await readdir(OUT)).filter((f) => f.startsWith(`${v.name}-`)).sort();
    const { rename } = await import("node:fs/promises");
    for (let i = 0; i < files.length; i++) {
      await rename(join(OUT, files[i]), join(OUT, `${v.name}-tmp-${String(i).padStart(4, "0")}.webp`));
    }
    for (let i = 0; i < files.length; i++) {
      await rename(
        join(OUT, `${v.name}-tmp-${String(i).padStart(4, "0")}.webp`),
        join(OUT, `${v.name}-${String(i).padStart(4, "0")}.webp`),
      );
    }
    console.log(`  ${v.name}: ${files.length} frames`);
  }

  const files = await readdir(OUT);
  let bytes = 0;
  for (const f of files) bytes += (await stat(join(OUT, f))).size;

  console.log(`\n${files.length} frames → public/sequence/  (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  for (const v of VARIANTS) {
    const own = files.filter((f) => f.startsWith(`${v.name}-`));
    let b = 0;
    for (const f of own) b += (await stat(join(OUT, f))).size;
    console.log(`  ${v.name}: ${own.length} frames, ${(b / 1024 / 1024).toFixed(2)} MB`);
  }

  if (files.length !== FRAMES * VARIANTS.length) {
    console.error(
      `\nExpected ${FRAMES * VARIANTS.length} frames, got ${files.length}. ` +
        "The component indexes 0000-0119 per variant and falls back to the " +
        "nearest decoded frame, so a gap degrades smoothness silently — worth fixing.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
