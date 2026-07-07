/**
 * Build banner tracking crops from the physical Veritas pull-up banner photo.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ASSETS, 'tracking');
const SOURCE = path.join(ASSETS, 'veritas-banner-source.jpeg');
const BANNER = path.join(ASSETS, 'veritas-banner.jpeg');

const sharp = (await import('sharp')).default;

if (!fs.existsSync(SOURCE)) {
  console.error('Missing source photo:', SOURCE);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const sourceMeta = await sharp(SOURCE).metadata();
const sw = sourceMeta.width;
const sh = sourceMeta.height;

// Crop the pull-up panel from the physical photo (exclude floor, stand, background).
const panel = {
  left: Math.round(sw * 0.03),
  top: Math.round(sh * 0.012),
  width: Math.round(sw * 0.94),
  height: Math.round(sh * 0.84),
};

await sharp(SOURCE)
  .extract(panel)
  .jpeg({ quality: 96, mozjpeg: true })
  .toFile(BANNER);

const meta = await sharp(BANNER).metadata();
const w = meta.width;
const h = meta.height;
console.log('Banner panel:', w, 'x', h);

const crops = [
  { name: 'banner-full.jpeg', extract: { left: 0, top: 0, width: w, height: h } },
  { name: 'banner-top.jpeg', extract: { left: 0, top: 0, width: w, height: Math.round(h * 0.38) } },
  { name: 'banner-headline.jpeg', extract: { left: 0, top: 0, width: w, height: Math.round(h * 0.24) } },
  { name: 'banner-logo.jpeg', extract: { left: 0, top: 0, width: Math.round(w * 0.55), height: Math.round(h * 0.12) } },
  { name: 'banner-wave.jpeg', extract: { left: Math.round(w * 0.42), top: Math.round(h * 0.04), width: Math.round(w * 0.56), height: Math.round(h * 0.30) } },
  { name: 'banner-services.jpeg', extract: { left: 0, top: Math.round(h * 0.34), width: w, height: Math.round(h * 0.26) } },
  { name: 'banner-middle.jpeg', extract: { left: 0, top: Math.round(h * 0.56), width: w, height: Math.round(h * 0.20) } },
  { name: 'banner-qr.jpeg', extract: { left: 0, top: Math.round(h * 0.60), width: Math.round(w * 0.52), height: Math.round(h * 0.14) } },
  { name: 'banner-city.jpeg', extract: { left: Math.round(w * 0.50), top: Math.round(h * 0.56), width: Math.round(w * 0.48), height: Math.round(h * 0.18) } },
  { name: 'banner-quote.jpeg', extract: { left: 0, top: Math.round(h * 0.74), width: w, height: Math.round(h * 0.10) } },
  { name: 'banner-footer.jpeg', extract: { left: 0, top: Math.round(h * 0.82), width: w, height: Math.round(h * 0.18) } },
];

for (const crop of crops) {
  const out = path.join(OUT, crop.name);
  await sharp(BANNER).extract(crop.extract).jpeg({ quality: 95, mozjpeg: true }).toFile(out);
  console.log('OK', crop.name);
}

await sharp(BANNER)
  .modulate({ brightness: 1.05, saturation: 1.12 })
  .normalize()
  .sharpen({ sigma: 1.45 })
  .jpeg({ quality: 96, mozjpeg: true })
  .toFile(path.join(OUT, 'banner-enhanced.jpeg'));
console.log('OK banner-enhanced.jpeg');

await sharp(BANNER)
  .extract({ left: 0, top: 0, width: Math.round(w * 0.50), height: Math.round(h * 0.11) })
  .png()
  .toFile(path.join(OUT, 'logo-512.png'));
console.log('OK logo-512.png');

console.log('Physical banner tracking assets ready');
