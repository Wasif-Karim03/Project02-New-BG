import sharp from "sharp";

// Burn a tiled, diagonal "BG" watermark INTO the image bytes (not a CSS overlay),
// so it survives right-click-save and appears in the raw file. Applied when the
// authorized file route serves a public portrait/tribute image. Output is PNG.
export async function watermarkImage(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes, { failOn: "none" }).rotate(); // honor EXIF orientation
  const meta = await image.metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 800;
  const tile = Math.max(70, Math.round(Math.min(w, h) / 6)); // scale to image size
  const fontSize = Math.round(tile * 0.42);

  // White fill with a dark stroke so "BG" stays legible over both light and dark
  // areas of a photo. Tiled + rotated so it can't be cropped out.
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="${Math.round(tile * 0.6)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" fill-opacity="0.5" stroke="#000000" stroke-opacity="0.28" stroke-width="1.2">BG</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)"/>
    </svg>`,
  );

  return image.composite([{ input: svg, blend: "over" }]).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}
