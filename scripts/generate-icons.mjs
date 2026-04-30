import sharp from "sharp";
import { writeFileSync } from "fs";

// Navy background with "GC" text rendered as SVG
function makeSvg(size) {
  const fontSize = Math.round(size * 0.35);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#0F172A"/>
  <text x="50%" y="54%" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800"
    fill="#6366F1" text-anchor="middle" dominant-baseline="middle">GC</text>
</svg>`;
}

for (const size of [192, 512, 180]) {
  const buf = await sharp(Buffer.from(makeSvg(size)))
    .png()
    .toBuffer();
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(`public/${name}`, buf);
  console.log(`created public/${name} (${buf.length} bytes)`);
}
