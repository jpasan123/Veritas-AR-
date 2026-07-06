/**
 * Compress veritas-ar-ready.glb for phones — WebP + meshopt, preserve rig hierarchy.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const input = process.argv[2] || path.join(ROOT, 'public/assets/veritas-ar-ready.glb');
const output = process.argv[3] || path.join(ROOT, 'public/assets/veritas-ar-ready-mobile.glb');
const tmp = path.join(ROOT, 'public/assets/.veritas-mobile-tmp.glb');

if (!fs.existsSync(input)) {
  console.error('Input not found:', input);
  process.exit(1);
}

const npx = (args) => execSync(`npx --yes @gltf-transform/cli ${args}`, { stdio: 'inherit' });

console.log('==> Optimize (preserve scene graph + skinned rig)');
npx(
  `optimize "${input}" "${tmp}" `
  + '--texture-compress webp --compress meshopt '
  + '--simplify-ratio 1 --texture-size 1024 '
  + '--flatten false --join false --instance false',
);

console.log('==> Re-align elephant on road');
execSync(`node "${path.join(__dirname, 'realign-elephant-glb.mjs')}" "${tmp}"`, { stdio: 'inherit' });

fs.renameSync(tmp, output);

const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`OK: ${output} (${mb} MB)`);
