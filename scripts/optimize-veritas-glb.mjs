/**
 * Build mobile-friendly Veritas AR GLB: strip animations/skins, simplify, compress textures.
 * Usage: node scripts/optimize-veritas-glb.mjs [input.glb] [output.glb]
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const input = process.argv[2] || path.join(ROOT, '../AR_poson/public/assets/veritas AR.glb');
const output = process.argv[3] || path.join(ROOT, 'public/assets/veritas-ar-fast.glb');
const tmp = path.join(ROOT, 'public/assets/.veritas-tmp.glb');

const npx = (args) => execSync(`npx --yes @gltf-transform/cli ${args}`, { stdio: 'inherit' });

if (!fs.existsSync(input)) {
  console.error('Input not found:', input);
  process.exit(1);
}

console.log('==> Simplify geometry');
npx(`simplify "${input}" "${tmp}" --ratio 0.32 --error 0.01`);

console.log('==> Prune unused nodes');
npx(`prune "${tmp}" "${tmp}"`);

console.log('==> Strip animations & skins');
const { NodeIO } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(tmp);
const root = doc.getRoot();
root.listAnimations().forEach((a) => a.dispose());
root.listSkins().forEach((s) => s.dispose());
await io.write(tmp, doc);

console.log('==> Compress textures (no meshopt — works on all phones)');
npx(`optimize "${tmp}" "${output}" --compress false --texture-compress webp`);

fs.unlinkSync(tmp);
const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`OK: ${output} (${mb} MB)`);
