/**
 * Pulls the embedded JPEGs out of a PDF without re-encoding them.
 *
 *   node scripts/extract-pdf-images.mjs "<file.pdf>" <out-dir>
 *
 * Adobe Scan (and most camera-roll-to-PDF tools) store each page as a single
 * DCTDecode stream — which is a JPEG file, byte for byte. So the honest way to
 * get the pictures back is to copy those bytes out, not to rasterise the page:
 * rendering would re-compress an already-compressed image and add a generation
 * of loss for nothing.
 *
 * This finds each stream whose object dictionary declares /DCTDecode and writes
 * the bytes between `stream` and `endstream` straight to disk. What comes out
 * is exactly what went in, at whatever resolution the PDF actually holds —
 * which is the number worth knowing before deciding these are good enough to
 * ship as product photography.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const [, , pdfPath, outDir = "extracted"] = process.argv;

if (!pdfPath) {
  console.error('Usage: node scripts/extract-pdf-images.mjs "<file.pdf>" <out-dir>');
  process.exit(1);
}

const buf = await readFile(pdfPath);
await mkdir(outDir, { recursive: true });

const STREAM = Buffer.from("stream");
const ENDSTREAM = Buffer.from("endstream");
const SOI = Buffer.from([0xff, 0xd8, 0xff]);

let found = 0;
let cursor = 0;

while (cursor < buf.length) {
  const s = buf.indexOf(STREAM, cursor);
  if (s === -1) break;

  // `endstream` also contains "stream"; skip those matches.
  if (s >= 3 && buf.subarray(s - 3, s + 6).toString("latin1") === "endstream") {
    cursor = s + 6;
    continue;
  }

  // The dictionary sits immediately before the keyword. 400 bytes is more than
  // enough to catch /Filter /DCTDecode without scanning the whole object.
  const dict = buf.subarray(Math.max(0, s - 400), s).toString("latin1");

  // Data starts after the EOL that follows the `stream` keyword.
  let start = s + STREAM.length;
  if (buf[start] === 0x0d) start++;
  if (buf[start] === 0x0a) start++;

  const end = buf.indexOf(ENDSTREAM, start);
  if (end === -1) break;

  const data = buf.subarray(start, end);

  // Verify it really is a JPEG rather than trusting the dictionary alone — a
  // truncated or oddly-filtered stream would otherwise be written as a file
  // nothing can open.
  if (dict.includes("DCTDecode") && data.subarray(0, 3).equals(SOI)) {
    found++;
    const name = `page-${String(found).padStart(2, "0")}.jpg`;
    await writeFile(join(outDir, name), data);
    console.log(`  ${name}  ${(data.length / 1024).toFixed(0)} KB`);
  }

  cursor = end + ENDSTREAM.length;
}

console.log(`\n${found} JPEG(s) extracted to ${outDir}/`);
if (found === 0) {
  console.log(
    "Nothing found. The pages may be stored with a different filter (JPXDecode,\n" +
      "FlateDecode), in which case they need rasterising rather than copying.",
  );
}
