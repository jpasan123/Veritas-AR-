/**
 * Bake elephant fix into GLB — parent mesh under armature, fix microscopic scale.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const input = process.argv[2] || path.join(ROOT, 'public/assets/veritas-ar-plain.glb');
const output = process.argv[3] || path.join(ROOT, 'public/assets/veritas-ar-ready.glb');

const SCALE_FIX = 250;

if (!fs.existsSync(input)) {
  console.error('Input not found:', input);
  process.exit(1);
}

const { NodeIO } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();

const armature = root.listNodes().find((n) => n.getName() === 'Object_5.002');
const skinNode = root.listNodes().find((n) => n.getName() === 'Object_59');

if (!armature || !skinNode) {
  console.error('Elephant nodes not found');
  process.exit(1);
}

const skinParent = skinNode.getParentNode();
if (skinParent) skinParent.removeChild(skinNode);

skinNode.setTranslation([0, 0, 0]);
skinNode.setRotation([0, 0, 0, 1]);
skinNode.setScale([1, 1, 1]);
armature.addChild(skinNode);

const [sx, sy, sz] = armature.getScale();
armature.setScale([sx * SCALE_FIX, sy * SCALE_FIX, sz * SCALE_FIX]);

root.listAnimations().forEach((anim) => {
  const name = anim.getName() || '';
  if (!/walk/i.test(name)) anim.dispose();
});

await io.write(output, doc);
const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`OK: ${output} (${mb} MB) — elephant parented + scale x${SCALE_FIX}`);
