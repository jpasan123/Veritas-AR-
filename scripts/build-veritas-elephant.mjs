/**
 * Bake elephant fix into GLB — parent mesh under armature, scale, parent under tripo, snap to road.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const input = process.argv[2] || path.join(ROOT, 'public/assets/veritas-ar-plain.glb');
const output = process.argv[3] || path.join(ROOT, 'public/assets/veritas-ar-ready.glb');

const SCALE_FIX = 250;
const ROAD_Y_FRAC = 0.07;
const ROAD_Z_FRAC = 0.76;
const ROAD_SINK = 0.035;

if (!fs.existsSync(input)) {
  console.error('Input not found:', input);
  process.exit(1);
}

const { NodeIO, getBounds } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();

const tripo = root.listNodes().find((n) => (n.getName() || '').startsWith('tripo_node'));
const armature = root.listNodes().find((n) => n.getName() === 'Object_5.002');
const skinNode = root.listNodes().find((n) => n.getName() === 'Object_59');

if (!tripo || !armature || !skinNode) {
  console.error('Required nodes not found');
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

const tripoBounds = getBounds(tripo);
reparentPreserveWorld(armature, tripo);
alignElephantOnRoad(tripoBounds, skinNode, armature);

root.listAnimations().forEach((anim) => {
  const name = anim.getName() || '';
  if (!/walk/i.test(name)) anim.dispose();
});

await io.write(output, doc);

const tripoB = getBounds(tripo);
const armB = getBounds(armature);
const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`OK: ${output} (${mb} MB)`);
console.log('  tripo Y:', tripoB.min[1].toFixed(3), '-', tripoB.max[1].toFixed(3));
console.log('  elephant feet Y:', armB.min[1].toFixed(3), 'center XZ:', [
  ((armB.min[0] + armB.max[0]) / 2).toFixed(3),
  ((armB.min[2] + armB.max[2]) / 2).toFixed(3),
].join(', '));

function reparentPreserveWorld(child, newParent) {
  const childWorld = child.getWorldMatrix();
  const parentWorld = newParent.getWorldMatrix();
  const invParent = invertMat4(parentWorld);
  const localMat = multiplyMat4(invParent, childWorld);
  child.getParentNode()?.removeChild(child);
  newParent.addChild(child);
  child.setMatrix([...localMat]);
}

function alignElephantOnRoad(tripoB, skinNode, armNode) {
  const armB = getBounds(skinNode);

  const roadY = tripoB.min[1] + (tripoB.max[1] - tripoB.min[1]) * ROAD_Y_FRAC;
  const roadX = (tripoB.min[0] + tripoB.max[0]) * 0.5;
  const roadZ = tripoB.min[2] + (tripoB.max[2] - tripoB.min[2]) * ROAD_Z_FRAC;

  const armCenterX = (armB.min[0] + armB.max[0]) * 0.5;
  const armCenterZ = (armB.min[2] + armB.max[2]) * 0.5;
  const feetY = armB.min[1];

  nudgeWorldTranslation(armNode, roadX - armCenterX, roadY - feetY - ROAD_SINK, roadZ - armCenterZ);
}

function nudgeWorldTranslation(node, dx, dy, dz) {
  const wm = node.getWorldMatrix();
  wm[12] += dx;
  wm[13] += dy;
  wm[14] += dz;
  const parent = node.getParentNode();
  if (!parent) {
    node.setTranslation([wm[12], wm[13], wm[14]]);
    return;
  }
  const invParent = invertMat4(parent.getWorldMatrix());
  const localMat = multiplyMat4(invParent, wm);
  node.setMatrix([...localMat]);
}

function multiplyMat4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0]
        + a[1 * 4 + r] * b[c * 4 + 1]
        + a[2 * 4 + r] * b[c * 4 + 2]
        + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function invertMat4(a) {
  const out = new Float32Array(16);
  const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
  const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
  const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
  const a30 = a[12]; const a31 = a[13]; const a32 = a[14]; const a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return out;
  det = 1 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
