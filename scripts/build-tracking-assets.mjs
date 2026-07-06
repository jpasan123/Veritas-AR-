/**
 * Build banner tracking crops — logo, sections, contrast boost for MindAR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ASSETS, 'tracking');

try {
  await import('sharp');
} catch {
  execSync('npm install sharp --no-save', { cwd: ROOT, stdio: 'inherit' });
}

const sharp = (await import('sharp')).default;

const bannerPath = path.join(ASSETS, 'veritas-banner.jpeg');
const logoPath = path.join(ASSETS, 'veritas-logo.png');

if (!fs.existsSync(bannerPath)) {
  console.error('Missing', bannerPath);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const banner = sharp(bannerPath);
const meta = await banner.metadata();
const w = meta.width;
const h = meta.height;

const crops = [
  { name: 'banner-full.jpeg', extract: { left: 0, top: 0, width: w, height: h } },
  { name: 'banner-top.jpeg', extract: { left: 0, top: 0, width: w, height: Math.round(h * 0.42) } },
  { name: 'banner-headline.jpeg', extract: { left: 0, top: Math.round(h * 0.02), width: w, height: Math.round(h * 0.28) } },
  { name: 'banner-services.jpeg', extract: { left: 0, top: Math.round(h * 0.30), width: w, height: Math.round(h * 0.28) } },
  { name: 'banner-middle.jpeg', extract: { left: 0, top: Math.round(h * 0.52), width: w, height: Math.round(h * 0.22) } },
  { name: 'banner-city.jpeg', extract: { left: Math.round(w * 0.48), top: Math.round(h * 0.52), width: Math.round(w * 0.50), height: Math.round(h * 0.20) } },
  { name: 'banner-quote.jpeg', extract: { left: 0, top: Math.round(h * 0.72), width: w, height: Math.round(h * 0.14) } },
];

for (const crop of crops) {
  const out = path.join(OUT, crop.name);
  await sharp(bannerPath).extract(crop.extract).jpeg({ quality: 94, mozjpeg: true }).toFile(out);
  console.log('OK', crop.name);
}

await sharp(bannerPath)
  .modulate({ brightness: 1.04, saturation: 1.12 })
  .normalize()
  .sharpen({ sigma: 0.8 })
  .jpeg({ quality: 94, mozjpeg: true })
  .toFile(path.join(OUT, 'banner-enhanced.jpeg'));
console.log('OK banner-enhanced.jpeg');

if (fs.existsSync(logoPath)) {
  await sharp(logoPath)
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(path.join(OUT, 'logo-512.png'));
  console.log('OK logo-512.png');
}

console.log('Tracking assets ready in', OUT);
