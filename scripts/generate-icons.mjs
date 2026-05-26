import sharp from "sharp";
import { writeFileSync } from "fs";

function makeSvg(size) {
  const outerRadius = Math.round(size * 0.24);
  const panelRadius = Math.round(size * 0.14);
  const strokeWidth = Math.max(4, Math.round(size * 0.028));
  const calendarX = Math.round(size * 0.18);
  const calendarY = Math.round(size * 0.21);
  const calendarWidth = Math.round(size * 0.64);
  const calendarHeight = Math.round(size * 0.62);
  const headerHeight = Math.round(size * 0.16);
  const ringRadius = Math.max(7, Math.round(size * 0.045));
  const ringY = Math.round(size * 0.17);
  const ringLeft = Math.round(size * 0.32);
  const ringRight = Math.round(size * 0.68);
  const cellSize = Math.round(size * 0.09);
  const cellGap = Math.round(size * 0.035);
  const gridStartX = Math.round(size * 0.28);
  const gridStartY = Math.round(size * 0.46);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2957E8"/>
      <stop offset="100%" stop-color="#5F90FF"/>
    </linearGradient>
    <linearGradient id="sheet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E7EEFF"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${outerRadius}" fill="url(#bg)"/>
  <rect x="${calendarX}" y="${calendarY}" width="${calendarWidth}" height="${calendarHeight}" rx="${panelRadius}" fill="url(#sheet)"/>
  <rect x="${calendarX}" y="${calendarY}" width="${calendarWidth}" height="${headerHeight}" rx="${panelRadius}" fill="#FF6B5E"/>
  <rect x="${calendarX}" y="${calendarY + Math.round(headerHeight * 0.55)}" width="${calendarWidth}" height="${Math.round(headerHeight * 0.45)}" fill="#FF6B5E"/>
  <line x1="${ringLeft}" y1="${ringY}" x2="${ringLeft}" y2="${calendarY + Math.round(headerHeight * 0.4)}" stroke="#FFFFFF" stroke-width="${strokeWidth}" stroke-linecap="round"/>
  <line x1="${ringRight}" y1="${ringY}" x2="${ringRight}" y2="${calendarY + Math.round(headerHeight * 0.4)}" stroke="#FFFFFF" stroke-width="${strokeWidth}" stroke-linecap="round"/>
  <circle cx="${ringLeft}" cy="${ringY}" r="${ringRadius}" fill="#FFFFFF"/>
  <circle cx="${ringRight}" cy="${ringY}" r="${ringRadius}" fill="#FFFFFF"/>
  <rect x="${gridStartX}" y="${gridStartY}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX + cellSize + cellGap}" y="${gridStartY}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX + (cellSize + cellGap) * 2}" y="${gridStartY}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX}" y="${gridStartY + cellSize + cellGap}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX + cellSize + cellGap}" y="${gridStartY + cellSize + cellGap}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8"/>
  <rect x="${gridStartX + (cellSize + cellGap) * 2}" y="${gridStartY + cellSize + cellGap}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX}" y="${gridStartY + (cellSize + cellGap) * 2}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX + cellSize + cellGap}" y="${gridStartY + (cellSize + cellGap) * 2}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
  <rect x="${gridStartX + (cellSize + cellGap) * 2}" y="${gridStartY + (cellSize + cellGap) * 2}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.28)}" fill="#2957E8" opacity="0.18"/>
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
