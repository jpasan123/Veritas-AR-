import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MindARThree } from 'mindar-image-three';
import { AR_SETTINGS, getSetup, experienceForTarget, targetCount } from './ar-config.js';

const setup = getSetup();
const EXPERIENCES = setup.experiences;
const TARGET_PRIORITY = setup.targetPriority;
const IS_ANDROID = /android/i.test(navigator.userAgent);
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const IS_PHONE = IS_ANDROID || IS_IOS
  || (navigator.maxTouchPoints > 1 && Math.min(window.innerWidth, window.innerHeight) < 900);

function resolveModelSrc(exp) {
  if (!exp) return '';
  if (exp.modelSrcMobile && (IS_PHONE || LOW_END)) return exp.modelSrcMobile;
  return exp.modelSrc;
}

function isLowEndDevice() {
  if (!IS_ANDROID) return false;
  const mem = navigator.deviceMemory;
  if (typeof mem === 'number' && mem <= 3) return true;
  const ua = navigator.userAgent.toLowerCase();
  return /sm-g610|sm-j710|j7 prime|galaxy j7|android [4-5]\./.test(ua);
}

const LOW_END = isLowEndDevice();

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const isLandscape = () => {
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  return w > h;
};

const getViewportSize = () => {
  const container = document.querySelector('#ar-container');
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? container?.clientWidth ?? window.innerWidth),
    h: Math.round(vv?.height ?? container?.clientHeight ?? window.innerHeight),
  };
};

const getMarkerOffset = (exp) => {
  if (!exp) return { x: 0, y: 0, z: 0 };
  if (isLandscape() && exp.landscape?.modelOffset) return exp.landscape.modelOffset;
  return exp.modelOffset ?? { x: 0, y: 0, z: 0 };
};

const getDefaultYOffset = (exp) => {
  if (!exp) return AR_SETTINGS.defaultUserYOffset;
  if (isLandscape() && exp.landscape?.defaultUserYOffset != null) {
    return exp.landscape.defaultUserYOffset;
  }
  return exp.defaultUserYOffset ?? AR_SETTINGS.defaultUserYOffset;
};

const $ = (id) => document.getElementById(id);
const show = (id) => $(id)?.classList.remove('hidden');
const hide = (id) => $(id)?.classList.add('hidden');

function setLoadStatus(message) {
  const el = $('load-status');
  if (el) el.textContent = message || '';
}

function prefetchModels(experiences) {
  experiences.forEach((exp) => {
    const src = resolveModelSrc(exp);
    if (!src) return;
    const link = document.createElement('link');
    link.rel = IS_PHONE ? 'preload' : 'prefetch';
    link.as = 'fetch';
    link.href = src;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

function showError(message) {
  hide('loading-screen');
  hide('start-screen');
  $('error-message').textContent = message;
  show('error-screen');
}

function sanitizeScene(scene) {
  const remove = [];
  scene.traverse((child) => {
    const name = (child.name || '').toLowerCase();
    if (
      name === 'camera'
      || name === 'maincamera'
      || name.endsWith('camera')
      || name === 'light'
      || name.includes('keylight')
      || name.includes('filllight')
      || name.includes('rimlight')
    ) {
      remove.push(child);
    }
  });
  remove.forEach((node) => node.parent?.remove(node));
}

function findLogoMesh(model) {
  let logo = null;
  model.traverse((child) => {
    if (!child.isMesh) return;
    if ((child.name || '').startsWith('tripo_node')) logo = child;
  });
  return logo;
}

function shouldDetachLogo(exp) {
  return !!(exp?.logoRotation || exp?.logoFlipX || exp?.logoOffset);
}

function getTowerBounds(model) {
  const box = new THREE.Box3();
  model.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || '').toLowerCase();
    if (name.startsWith('tripo_node') || name.includes('camera') || name.includes('light')) return;
    box.union(new THREE.Box3().setFromObject(child));
  });
  return box;
}

function applyLogoMapFlip(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((mat) => {
    if (!mat?.map) return;
    mat.map.wrapS = THREE.RepeatWrapping;
    mat.map.repeat.x = -1;
    mat.map.offset.x = 1;
    mat.map.needsUpdate = true;
  });
}

function logoPlaneSize(map) {
  const img = map?.image;
  if (img?.width && img?.height) {
    const aspect = img.width / img.height;
    const height = 0.38;
    return { w: height * aspect, h: height };
  }
  return { w: 1.1, h: 0.38 };
}

function createLogoMaterial(srcMat) {
  if (!srcMat) {
    return new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, depthWrite: true });
  }
  const mat = new THREE.MeshStandardMaterial({
    map: srcMat.map,
    normalMap: srcMat.normalMap,
    metalnessMap: srcMat.metalnessMap,
    roughnessMap: srcMat.roughnessMap,
    color: srcMat.color ?? new THREE.Color(0xffffff),
    metalness: srcMat.metalness ?? 0,
    roughness: srcMat.roughness ?? 0.8,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = 4;
    mat.map.needsUpdate = true;
  }
  return mat;
}

function mountLogoOnTower(model, logo, exp) {
  if (!logo) return;

  const rot = exp.logoRotation ?? { x: 0, y: Math.PI / 2, z: 0 };
  logo.rotation.set(rot.x, rot.y, rot.z);
  logo.position.set(0, 0, 0);
  logo.scale.x = Math.abs(logo.scale.x || 1);
  logo.scale.y = Math.abs(logo.scale.y || 1);
  logo.scale.z = Math.abs(logo.scale.z || 1);
  if (exp.logoFlipX) {
    if (LOW_END) applyLogoMapFlip(logo);
    else logo.scale.x = -Math.abs(logo.scale.x || 1);
  }
  logo.frustumCulled = false;
  logo.visible = true;

  const mats = Array.isArray(logo.material) ? logo.material : [logo.material];
  mats.forEach((mat) => {
    if (!mat) return;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = true;
    mat.transparent = false;
    if (mat.map) {
      mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.map.needsUpdate = true;
    }
    mat.needsUpdate = true;
  });

  const offset = exp.logoOffset ?? { x: -0.22, y: 1.95, z: 0.14 };
  const finial = model.getObjectByName('Finial_Ball');

  if (finial) {
    const anchor = new THREE.Group();
    anchor.name = 'logo-anchor';
    anchor.position.set(offset.x, offset.y, offset.z);
    anchor.add(logo);
    finial.add(anchor);
    model.updateMatrixWorld(true);
    console.info('[AR] Logo mounted on finial');
    return;
  }

  model.updateMatrixWorld(true);
  const towerBox = getTowerBounds(model);
  if (towerBox.isEmpty()) {
    model.add(logo);
    return;
  }

  const worldPos = new THREE.Vector3(
    towerBox.getCenter(new THREE.Vector3()).x + offset.x,
    towerBox.max.y + (exp.logoWorldLift ?? 0.15),
    towerBox.getCenter(new THREE.Vector3()).z + offset.z,
  );
  model.worldToLocal(worldPos);
  logo.position.copy(worldPos);
  model.add(logo);
  model.updateMatrixWorld(true);
  console.info('[AR] Logo mounted at tower top');
}

function resetSkeletonBindPose(model) {
  model.traverse((child) => {
    if (!child.isSkinnedMesh || !child.skeleton) return;
    child.skeleton.pose();
    child.frustumCulled = false;
    child.visible = true;
  });
  model.updateMatrixWorld(true);
}

function ensureDioramaPartsVisible(model) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || '').toLowerCase();
    if (name.includes('elephant') || name.includes('mob') || child.isSkinnedMesh) {
      child.visible = true;
      child.frustumCulled = false;
    }
  });
}

function removeSkinnedRig(model, exp) {
  if (exp?.preserveSkinnedMeshes) return;
  const remove = [];
  model.traverse((child) => {
    const name = (child.name || '').toLowerCase();
    if (
      name.includes('bip01')
      || name.includes('armature')
      || name.includes('_rootjoint')
      || name.includes('bn_tail')
    ) {
      remove.push(child);
    }
  });
  remove.forEach((node) => node.parent?.remove(node));
}

function detachLogoForFitting(model, exp) {
  if (!shouldDetachLogo(exp)) return null;
  const logo = findLogoMesh(model);
  if (!logo) return null;
  logo.parent?.remove(logo);
  return logo;
}

function stabilizeTowerPivot(model) {
  ['Main_Pivot', 'LanternRoot'].forEach((name) => {
    const pivot = model.getObjectByName(name);
    if (!pivot) return;
    pivot.rotation.set(0, 0, 0);
    pivot.quaternion.identity();
    pivot.updateMatrixWorld(true);
  });
}

function stabilizeDioramaRoot(model) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    const name = child.name || '';
    if (name.startsWith('tripo_node')) {
      child.rotation.set(0, 0, 0);
    }
  });
}

function freezeStaticModel(model) {
  model.traverse((child) => {
    if (child === model) return;
    child.matrixAutoUpdate = false;
    child.updateMatrix();
  });
  model.updateMatrixWorld(true);
}

function preNormalizeModel(model) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 10) {
    model.scale.setScalar(1 / maxDim);
    model.updateMatrixWorld(true);
  }
}

function lightenMaterials(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || '').toLowerCase();
    const isGlow = name.includes('glow') || name.includes('amber') || name.includes('lantern');

    const convert = (mat) => {
      if (!mat || mat.isMeshBasicMaterial) return mat;
      const opts = {
        map: mat.map,
        color: mat.color,
        side: mat.side ?? THREE.FrontSide,
        transparent: mat.transparent,
        opacity: mat.opacity ?? 1,
      };
      let next;
      if (isGlow && mat.emissive) {
        next = new THREE.MeshLambertMaterial({
          ...opts,
          emissive: mat.emissive,
          emissiveIntensity: mat.emissiveIntensity ?? 1,
        });
      } else {
        next = new THREE.MeshBasicMaterial(opts);
      }
      mat.normalMap?.dispose?.();
      mat.roughnessMap?.dispose?.();
      mat.metalnessMap?.dispose?.();
      mat.aoMap?.dispose?.();
      mat.dispose?.();
      return next;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map(convert);
    } else {
      child.material = convert(child.material);
    }
  });
}

function simplifyLogoMesh(logo) {
  const verts = logo.geometry?.attributes?.position?.count ?? 0;
  if (!logo.isMesh || verts < 5000) return logo;

  const srcMat = Array.isArray(logo.material) ? logo.material[0] : logo.material;
  const map = srcMat?.map ?? null;
  const { w, h } = logoPlaneSize(map);
  const mat = createLogoMaterial(srcMat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.name = logo.name;
  plane.rotation.copy(logo.rotation);
  plane.scale.copy(logo.scale);
  plane.scale.x = Math.abs(plane.scale.x);
  plane.scale.y = Math.abs(plane.scale.y);
  plane.scale.z = Math.abs(plane.scale.z);
  plane.frustumCulled = false;
  logo.geometry?.dispose?.();
  srcMat?.dispose?.();
  console.info('[AR] Logo simplified for low-end GPU:', verts, 'verts -> plane');
  return plane;
}

function countVertices(root) {
  let count = 0;
  root.traverse((child) => {
    if (child.isMesh) count += child.geometry?.attributes?.position?.count ?? 0;
  });
  return count;
}

function optimizeModelForDevice(model, logoMesh, exp) {
  if (exp?.skipMaterialLite) return logoMesh;
  const verts = countVertices(model);
  if (LOW_END) {
    let logo = logoMesh;
    if (logo) logo = simplifyLogoMesh(logo);
    lightenMaterials(model);
    return logo;
  }
  if (IS_ANDROID && verts > 250000) lightenMaterials(model);
  return logoMesh;
}

function prepareModel(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    child.visible = true;
    child.matrixAutoUpdate = true;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (!mat) return;
      mat.side = THREE.FrontSide;
      mat.depthTest = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;

      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = LOW_END ? 1 : 4;
        mat.map.needsUpdate = true;
      }
      if (mat.emissiveMap) {
        mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        mat.emissiveMap.needsUpdate = true;
      }
      if (mat.normalMap) mat.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
      if (mat.roughnessMap) mat.roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
      if (mat.metalnessMap) mat.metalnessMap.colorSpace = THREE.LinearSRGBColorSpace;
    });
  });
}

async function loadModelAsset(src, onProgress) {
  const attempts = IS_ANDROID ? 3 : 1;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.load(
          src,
          (gltf) => {
            console.info('[AR] Loaded GLB:', src);
            resolve({ scene: gltf.scene, animations: gltf.animations ?? [] });
          },
          (event) => {
            if (!onProgress || !event.total) return;
            onProgress(event.loaded / event.total);
          },
          (err) => reject(err),
        );
      });
    } catch (err) {
      lastErr = err;
      console.warn(`[AR] Load attempt ${attempt}/${attempts} failed:`, src, err);
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
  }
  throw lastErr;
}

async function loadModelForExperience(exp, onProgress) {
  return loadModelAsset(resolveModelSrc(exp), onProgress);
}

async function buildExperience(exp, slot, onProgress) {
  const asset = await loadModelForExperience(exp, onProgress);
  const holder = new THREE.Group();
  holder.visible = false;
  holder.name = exp.id;

  const model = asset.scene;
  sanitizeScene(model);
  removeSkinnedRig(model, exp);
  resetSkeletonBindPose(model);
  ensureDioramaPartsVisible(model);
  stabilizeTowerPivot(model);
  let logoMesh = detachLogoForFitting(model, exp);
  preNormalizeModel(model);
  prepareModel(model);
  logoMesh = optimizeModelForDevice(model, logoMesh, exp);
  fitModel(
    model,
    exp.modelScale,
    exp.fitMode ?? 'ground',
    exp.fitLift,
    exp.fitBounds,
    exp.fitHeightFactor,
    logoMesh !== null,
  );
  mountLogoOnTower(model, logoMesh, exp);
  holder.add(model);

  if (slot) slot.attachRig.add(holder);

  let anim = null;
  if (exp.preferredAnimation && exp.preserveSkinnedMeshes) {
    anim = setupElephantWalk(model, asset.animations, exp.preferredAnimation);
  } else if (exp.playAnimation !== false) {
    anim = setupAnimations(
      model,
      asset.animations,
      exp.animationExclude ?? [],
      exp.preferredAnimation ?? '',
    );
  }

  anchorElephantToGround(model);
  anim?.refreshArmaturePin?.();

  return { holder, anim };
}

function getFitBox(model, fitBounds, excludeLogoMesh = false) {
  model.updateMatrixWorld(true);

  if (fitBounds === 'diorama') {
    const tripo = model.children.find((c) => (c.name || '').startsWith('tripo_node'));
    if (tripo) {
      const box = new THREE.Box3().setFromObject(tripo);
      if (!box.isEmpty()) return box;
    }
  }

  if (fitBounds !== 'mesh') {
    const box = new THREE.Box3();
    model.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();
      if (excludeLogoMesh && name.startsWith('tripo_node')) return;
      box.union(new THREE.Box3().setFromObject(child));
    });
    return box.isEmpty() ? new THREE.Box3().setFromObject(model) : box;
  }

  const box = new THREE.Box3();
  let found = false;
  model.traverse((child) => {
    if (!child.isMesh) return;

    const name = (child.name || '').toLowerCase();
    if (name.includes('camera') || name.includes('light')) return;
    if (excludeLogoMesh && name.startsWith('tripo_node')) return;

    const meshBox = new THREE.Box3().setFromObject(child);
    if (meshBox.isEmpty()) return;

    const meshCenter = meshBox.getCenter(new THREE.Vector3());
    if (fitBounds !== 'diorama' && meshCenter.y < -1.0) return;

    box.union(meshBox);
    found = true;
  });

  return found ? box : new THREE.Box3().setFromObject(model);
}

function fitModel(model, modelScale, fitMode = 'ground', fitLift, fitBounds, fitHeightFactor, excludeLogoMesh = false) {
  const box = getFitBox(model, fitBounds, excludeLogoMesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (size.length() < 0.0001) {
    model.scale.setScalar(modelScale);
    return;
  }

  model.position.sub(center);

  switch (fitMode) {
    case 'ground':
      model.position.y += size.y * 0.5;
      break;
    case 'facade':
      model.position.y += size.y * (fitLift ?? 0.40);
      break;
    case 'diorama':
      model.position.y += size.y * 0.12;
      break;
    case 'center':
    default:
      break;
  }

  let scaleBase;
  if (fitMode === 'facade' || fitMode === 'center') {
    scaleBase = Math.max(size.x, size.y * (fitHeightFactor ?? 0.88));
  } else if (fitMode === 'diorama') {
    scaleBase = Math.max(size.x, size.y * 0.92);
  } else {
    scaleBase = Math.max(size.x, size.y, size.z);
  }
  model.scale.setScalar(modelScale / Math.max(scaleBase, 0.0001));
}

function anchorElephantToGround(model) {
  const tripo = model.children.find((c) => (c.name || '').startsWith('tripo_node'));
  const armature = model.getObjectByName('Object_5.002');
  const skinned = model.getObjectByName('Object_59') || findElephantSkinnedMesh(model);
  if (!tripo || !armature) return;

  model.updateMatrixWorld(true);

  if (armature.parent !== tripo) {
    tripo.attach(armature);
  }

  model.updateMatrixWorld(true);

  const tripoBox = new THREE.Box3();
  tripo.traverse((child) => {
    if (!child.isMesh || child.isSkinnedMesh) return;
    tripoBox.union(new THREE.Box3().setFromObject(child));
  });
  if (tripoBox.isEmpty()) tripoBox.setFromObject(tripo);
  const tripoSize = tripoBox.getSize(new THREE.Vector3());
  const roadY = tripoBox.min.y + tripoSize.y * 0.10;
  const roadX = (tripoBox.min.x + tripoBox.max.x) * 0.5;
  const roadZ = tripoBox.min.z + tripoSize.z * 0.76;

  const elephantBox = new THREE.Box3();
  if (skinned?.geometry?.attributes?.position) {
    elephantBox.setFromBufferAttribute(skinned.geometry.attributes.position);
    elephantBox.applyMatrix4(skinned.matrixWorld);
  } else {
    elephantBox.setFromObject(armature);
  }

  if (tripoBox.isEmpty() || elephantBox.isEmpty()) return;

  const eleCenter = elephantBox.getCenter(new THREE.Vector3());
  const feetY = elephantBox.min.y;
  const dx = roadX - eleCenter.x;
  const dy = roadY - feetY;
  const dz = roadZ - eleCenter.z;

  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || Math.abs(dz) > 0.001) {
    const wp = armature.getWorldPosition(new THREE.Vector3());
    wp.x += dx;
    wp.y += dy;
    wp.z += dz;
    tripo.worldToLocal(wp);
    armature.position.copy(wp);
    model.updateMatrixWorld(true);
    console.info('[AR] Elephant on road', { dx: dx.toFixed(3), dy: dy.toFixed(3), dz: dz.toFixed(3) });
  }
}

function pickElephantWalkClip(clips, preferredClip = 'walk') {
  if (!clips?.length) return null;
  const preferred = clips.find((c) => c.name.toLowerCase().includes(preferredClip.toLowerCase()));
  if (preferred) return preferred;
  return clips.find((c) => /walk/i.test(c.name))
    || clips.find((c) => /run/i.test(c.name))
    || clips.find((c) => /idle/i.test(c.name))
    || clips[0];
}

function findElephantSkinnedMesh(model) {
  let best = null;
  let fallback = null;
  model.traverse((child) => {
    if (!child.isSkinnedMesh) return;
    fallback = child;
    if (/elephant|mob/i.test(child.name || '')) best = child;
  });
  return best || fallback;
}

function ensureElephantVisible(model) {
  const skinned = findElephantSkinnedMesh(model);
  if (!skinned) {
    console.warn('[AR] Elephant skinned mesh not found');
    return null;
  }

  skinned.visible = true;
  skinned.frustumCulled = false;
  skinned.matrixAutoUpdate = true;

  let parent = skinned.parent;
  while (parent && parent !== model) {
    parent.visible = true;
    parent.matrixAutoUpdate = true;
    parent = parent.parent;
  }

  const skeleton = skinned.skeleton;
  if (skeleton) {
    skeleton.bones.forEach((bone) => {
      bone.visible = true;
      bone.matrixAutoUpdate = true;
    });
    skeleton.update();
  }

  model.traverse((child) => {
    if (!child.isBone && !child.isSkinnedMesh) return;
    const n = (child.name || '').toLowerCase();
    if (
      child.isSkinnedMesh
      || n.includes('bip')
      || n.includes('bn_')
      || n.includes('armature')
      || n.includes('rootjoint')
      || n.includes('object_5')
    ) {
      child.visible = true;
      child.frustumCulled = false;
      child.matrixAutoUpdate = true;
    }
  });

  model.updateMatrixWorld(true);

  const mats = Array.isArray(skinned.material) ? skinned.material : [skinned.material];
  mats.forEach((mat) => {
    if (!mat) return;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = true;
    mat.needsUpdate = true;
  });

  return skinned;
}

function createElephantArmaturePin(armature) {
  if (!armature) {
    return { apply() {}, refresh() {} };
  }
  const state = {
    pos: armature.position.clone(),
    quat: armature.quaternion.clone(),
    scale: armature.scale.clone(),
  };
  return {
    refresh() {
      state.pos.copy(armature.position);
      state.quat.copy(armature.quaternion);
      state.scale.copy(armature.scale);
    },
    apply() {
      armature.position.copy(state.pos);
      armature.quaternion.copy(state.quat);
      armature.scale.copy(state.scale);
    },
  };
}

function createElephantRootPin(skinned) {
  if (!skinned?.skeleton) return () => {};
  const pinned = [];
  skinned.skeleton.bones.forEach((bone) => {
    if (/^(_rootjoint|hips_01|bip01_pelvis)/i.test(bone.name)) {
      pinned.push({ bone, pos: bone.position.clone() });
    }
  });
  return () => {
    pinned.forEach(({ bone, pos }) => bone.position.copy(pos));
  };
}

const ROOT_MOTION_NODES = /^(_rootjoint|hips_01|bip01_pelvis)/i;

function trackNodeName(track) {
  const dot = track.name.lastIndexOf('.');
  const path = dot < 0 ? track.name : track.name.slice(0, dot);
  return path.split('/').pop();
}

function trackProp(track) {
  const dot = track.name.lastIndexOf('.');
  return dot < 0 ? '' : track.name.slice(dot + 1);
}

function filterWalkClipSafe(clip) {
  const tracks = clip.tracks.filter((track) => {
    const prop = trackProp(track);
    const node = trackNodeName(track);
    if (prop === 'scale') return false;
    if (prop === 'position' && ROOT_MOTION_NODES.test(node)) return false;
    return true;
  });
  if (!tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function setupElephantWalk(model, clips, preferredClip = 'walk') {
  const skinned = ensureElephantVisible(model);
  if (!skinned) return null;

  const armature = model.getObjectByName('Object_5.002') || skinned.parent;
  const clip = pickElephantWalkClip(clips, preferredClip);
  if (!clip) {
    console.warn('[AR] Walk clip not found');
    return null;
  }

  const walkClip = filterWalkClipSafe(clip);
  const pinRoot = createElephantRootPin(skinned);
  const pinArmature = createElephantArmaturePin(armature);
  const mixer = new THREE.AnimationMixer(armature || model);
  const action = mixer.clipAction(walkClip);
  action.setLoop(THREE.LoopRepeat);
  action.play();
  console.info('[AR] Elephant walk:', walkClip.name, `(${walkClip.tracks.length} tracks)`);

  return {
    skinned,
    refreshArmaturePin() {
      pinArmature.refresh();
    },
    reset() {
      action.reset();
      action.paused = false;
      action.play();
      pinRoot();
      pinArmature.apply();
    },
    update(delta) {
      mixer.update(delta);
      pinRoot();
      pinArmature.apply();
      skinned.skeleton?.update();
    },
    play() {
      action.paused = false;
      action.play();
    },
    pause() {
      action.paused = true;
    },
  };
}

function setupAnimations(root, clips, excludeTracks = [], preferredClip = '') {
  if (!clips?.length) return null;

  let useClips = clips;
  if (preferredClip) {
    const matched = clips.filter((clip) => clip.name.includes(preferredClip));
    if (matched.length) useClips = matched;
  }

  const mixer = new THREE.AnimationMixer(root);
  const actions = [];

  useClips.forEach((clip) => {
    const tracks = clip.tracks.filter(
      (track) => !excludeTracks.some((key) => track.name.includes(key)),
    );
    if (!tracks.length) return;

    const filtered = tracks.length === clip.tracks.length
      ? clip
      : new THREE.AnimationClip(clip.name, clip.duration, tracks);
    const action = mixer.clipAction(filtered);
    action.setLoop(THREE.LoopRepeat);
    action.play();
    actions.push(action);
  });

  if (!actions.length) return null;

  return {
    update(delta) { mixer.update(delta); },
    play() { actions.forEach((a) => { a.paused = false; a.play(); }); },
    pause() { actions.forEach((a) => { a.paused = true; }); },
  };
}

function preventPageZoom() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
    document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    if (e.target.closest('.ctrl-btn, .zoom-btn, .back-btn, .start-btn, .btn-ar, .cam-btn')) return;
    if (Date.now() - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = Date.now();
  }, { passive: false });
}

function createZoomControl() {
  let userZoom = AR_SETTINGS.defaultUserZoom;
  const clamp = (v) => THREE.MathUtils.clamp(v, AR_SETTINGS.minUserZoom, AR_SETTINGS.maxUserZoom);

  return {
    zoomIn: () => { userZoom = clamp(userZoom + AR_SETTINGS.zoomStep); },
    zoomOut: () => { userZoom = clamp(userZoom - AR_SETTINGS.zoomStep); },
    resetFor(exp) {
      userZoom = exp?.defaultUserZoom ?? AR_SETTINGS.defaultUserZoom;
    },
    getZoom: () => userZoom,
  };
}

function createPositionControl() {
  let userYOffset = AR_SETTINGS.defaultUserYOffset;
  const clamp = (v) => THREE.MathUtils.clamp(v, AR_SETTINGS.minUserYOffset, AR_SETTINGS.maxUserYOffset);

  return {
    moveUp: () => { userYOffset = clamp(userYOffset + AR_SETTINGS.positionStep); },
    moveDown: () => { userYOffset = clamp(userYOffset - AR_SETTINGS.positionStep); },
    resetFor(exp) {
      userYOffset = getDefaultYOffset(exp);
    },
    getYOffset: () => userYOffset,
  };
}

function createCameraControls(getVideo) {
  let torchOn = false;
  let brightenOn = false;
  let camZoom = AR_SETTINGS.minCameraZoom;
  let videoTrack = null;

  const refreshTrack = () => {
    const video = getVideo();
    const stream = video?.srcObject;
    videoTrack = stream?.getVideoTracks?.()?.[0] ?? null;
    return videoTrack;
  };

  const applyVideoStyle = () => {
    const video = getVideo();
    if (!video) return;
    video.style.transform = camZoom !== 1 ? `scale(${camZoom})` : '';
    video.style.transformOrigin = 'center center';
    video.style.filter = brightenOn ? 'brightness(1.45) contrast(1.08)' : '';
  };

  const toggleTorch = async () => {
    refreshTrack();
    if (!videoTrack) return null;
    torchOn = !torchOn;
    const attempts = [
      { advanced: [{ torch: torchOn }] },
      { torch: torchOn },
    ];
    for (const constraints of attempts) {
      try {
        await videoTrack.applyConstraints(constraints);
        return torchOn;
      } catch { /* try next */ }
    }
    torchOn = false;
    return null;
  };

  const toggleBrighten = () => {
    brightenOn = !brightenOn;
    applyVideoStyle();
    return brightenOn;
  };

  const camZoomIn = () => {
    camZoom = Math.min(camZoom + AR_SETTINGS.cameraZoomStep, AR_SETTINGS.maxCameraZoom);
    applyVideoStyle();
  };

  const camZoomOut = () => {
    camZoom = Math.max(camZoom - AR_SETTINGS.cameraZoomStep, AR_SETTINGS.minCameraZoom);
    applyVideoStyle();
  };

  return {
    refreshTrack,
    toggleTorch,
    toggleBrighten,
    camZoomIn,
    camZoomOut,
    isTorchOn: () => torchOn,
    isBrightenOn: () => brightenOn,
  };
}

function bindButton(el, handler) {
  if (!el) return;
  let busy = false;
  const run = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    busy = true;
    handler();
    setTimeout(() => { busy = false; }, 220);
  };
  el.addEventListener('pointerup', run, { passive: false });
  el.addEventListener('touchend', run, { passive: false });
}

function configureRenderer(renderer) {
  const maxDpr = LOW_END ? 1 : (IS_ANDROID ? 1.15 : 1.35);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.sortObjects = true;
  if (IS_ANDROID) {
    renderer.powerPreference = LOW_END ? 'default' : 'high-performance';
  }
  const canvas = renderer.domElement;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '2';
  canvas.style.pointerEvents = 'none';
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    setLoadStatus('GPU busy — refresh and try again.');
    console.warn('[AR] WebGL context lost');
  }, false);
}

async function loadExperiences(slots, onProgress) {
  const registry = new Map();
  const slotByExp = new Map();
  slots.forEach((slot) => {
    const id = slot.experience?.id;
    if (id && !slotByExp.has(id)) slotByExp.set(id, slot);
  });

  for (const exp of EXPERIENCES) {
    if (registry.has(exp.id)) continue;
    try {
      const entry = await buildExperience(exp, slotByExp.get(exp.id), (pct) => {
        onProgress?.(exp.id, pct);
      });
      registry.set(exp.id, entry);
      console.info('[AR] Model ready:', exp.id, resolveModelSrc(exp));
      if (IS_ANDROID) await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      console.error(`[AR] Failed to load model for ${exp.id}:`, err);
      setLoadStatus(`Model load failed: ${err?.message || 'check connection'}`);
    }
  }

  return registry;
}

async function initAR() {
  preventPageZoom();

  if (!hasWebGL()) {
    showError('This phone does not support 3D (WebGL). Try Chrome or a newer phone.');
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showError(IS_ANDROID ? 'Use Chrome on your Android phone.' : 'Use Safari or Chrome on your phone.');
    return;
  }

  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    showError('HTTPS required.');
    return;
  }

  prefetchModels(EXPERIENCES);

  const slotCount = targetCount(EXPERIENCES);
  const maxTrack = Math.min(slotCount, 2);
  const forcePreload = EXPERIENCES.some((e) => e.preloadRequired);
  let mindar;
  try {
    mindar = new MindARThree({
      container: document.querySelector('#ar-container'),
      imageTargetSrc: setup.targetSrc,
      maxTrack,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
      filterMinCF: AR_SETTINGS.filterMinCF,
      filterBeta: AR_SETTINGS.filterBeta,
    });
  } catch (err) {
    showError('AR failed to load.');
    console.error(err);
    return;
  }

  const { renderer, scene, camera } = mindar;
  configureRenderer(renderer);

  const slots = [];
  const _smoothTmp = {
    rawPos: new THREE.Vector3(),
    rawQuat: new THREE.Quaternion(),
    rawMat: new THREE.Matrix4(),
    smoothMat: new THREE.Matrix4(),
    invRaw: new THREE.Matrix4(),
    localMat: new THREE.Matrix4(),
    unitScale: new THREE.Vector3(1, 1, 1),
    decompScale: new THREE.Vector3(),
  };

  for (let i = 0; i < slotCount; i++) {
    const exp = experienceForTarget(EXPERIENCES, i);
    const anchor = mindar.addAnchor(i);
    const smoothRig = new THREE.Group();
    smoothRig.name = 'smooth-rig';
    const marker = new THREE.Object3D();
    const attachRig = new THREE.Group();
    attachRig.name = 'attach-rig';
    const off = getMarkerOffset(exp);
    marker.position.set(off.x, off.y, off.z);
    marker.add(attachRig);
    smoothRig.add(marker);
    anchor.group.add(smoothRig);
    slots.push({
      anchor,
      smoothRig,
      marker,
      attachRig,
      targetIndex: i,
      experience: exp,
      smoothWorldPos: new THREE.Vector3(),
      smoothWorldQuat: new THREE.Quaternion(),
      smoothReady: false,
    });
  }

  scene.add(new THREE.AmbientLight(0xffffff, 1.65));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(1, 3, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  let activeSlot = null;
  let activeRegistry = null;
  const zoom = createZoomControl();
  const position = createPositionControl();
  let expRegistry = new Map();
  let hideTimer = null;
  const found = new Set();
  const loadingExps = new Set();
  let renderLoop = null;
  let arRunning = false;
  let orientationBusy = false;
  let lastLandscape = isLandscape();
  let pendingActiveSlot = null;
  let lockedTargetIndex = null;

  const getVideo = () => document.querySelector('#ar-container video');
  const cameraControls = createCameraControls(getVideo);

  const applyUserTransform = (slot) => {
    if (!slot) return;
    const z = zoom.getZoom();
    const yOff = position.getYOffset();
    const off = getMarkerOffset(slot.experience);
    slot.marker.position.set(off.x, off.y + yOff, off.z);
    slot.attachRig.position.set(0, 0, 0);
    slot.attachRig.scale.set(1, 1, 1);
    const holder = slot.attachRig.children[0];
    if (holder) {
      holder.position.set(0, 0, 0);
      holder.scale.setScalar(z);
    }
  };

  const resetSlotSmoothing = (slot) => {
    if (!slot) return;
    slot.smoothReady = false;
    slot.smoothRig.position.set(0, 0, 0);
    slot.smoothRig.quaternion.identity();
    slot.smoothRig.scale.set(1, 1, 1);
  };

  const applyAnchorSmoothing = () => {
    slots.forEach((slot) => {
      if (!found.has(slot)) return;

      const anchor = slot.anchor.group;
      anchor.updateMatrixWorld(true);
      anchor.getWorldPosition(_smoothTmp.rawPos);
      anchor.getWorldQuaternion(_smoothTmp.rawQuat);

      if (!slot.smoothReady) {
        slot.smoothWorldPos.copy(_smoothTmp.rawPos);
        slot.smoothWorldQuat.copy(_smoothTmp.rawQuat);
        slot.smoothReady = true;
        slot.smoothRig.position.set(0, 0, 0);
        slot.smoothRig.quaternion.identity();
        slot.smoothRig.scale.set(1, 1, 1);
        return;
      }

      slot.smoothWorldPos.lerp(_smoothTmp.rawPos, AR_SETTINGS.posSmooth);
      slot.smoothWorldQuat.slerp(_smoothTmp.rawQuat, AR_SETTINGS.rotSmooth);

      _smoothTmp.smoothMat.compose(
        slot.smoothWorldPos,
        slot.smoothWorldQuat,
        _smoothTmp.unitScale,
      );
      _smoothTmp.rawMat.copy(anchor.matrixWorld);
      _smoothTmp.invRaw.copy(_smoothTmp.rawMat).invert();
      _smoothTmp.localMat.multiplyMatrices(_smoothTmp.invRaw, _smoothTmp.smoothMat);
      _smoothTmp.localMat.decompose(
        slot.smoothRig.position,
        slot.smoothRig.quaternion,
        _smoothTmp.decompScale,
      );
      slot.smoothRig.scale.set(1, 1, 1);
    });
  };

  const hideAllHolders = () => {
    if (!expRegistry) return;
    expRegistry.forEach((entry) => {
      entry.holder.visible = false;
      entry.anim?.pause();
    });
    activeRegistry = null;
  };

  const showExperience = (expId) => {
    if (!expRegistry) return false;
    const entry = expRegistry.get(expId);
    if (!entry) return false;

    expRegistry.forEach((item) => {
      const on = item === entry;
      item.holder.visible = on;
      const model = item.holder.children[0];
      item.holder.traverse((child) => {
        child.visible = on;
        if (on && child.isSkinnedMesh) child.frustumCulled = false;
      });
      if (on) {
        ensureElephantVisible(model);
        item.anim?.reset?.() || item.anim?.play();
      } else {
        item.anim?.pause();
      }
    });
    activeRegistry = entry;
    return true;
  };

  const isSlotTracked = (slot) => {
    if (!slot) return false;
    if (found.has(slot)) return true;
    return slots.some((s) => s.experience?.id === slot.experience?.id && found.has(s));
  };

  const slotByExp = new Map();
  slots.forEach((slot) => {
    const id = slot.experience?.id;
    if (id && !slotByExp.has(id)) slotByExp.set(id, slot);
  });

  const ensureExperienceLoaded = async (expId) => {
    if (expRegistry.has(expId)) return true;
    if (loadingExps.has(expId)) return false;
    const exp = EXPERIENCES.find((e) => e.id === expId);
    if (!exp) return false;

    loadingExps.add(expId);
    setLoadStatus('Loading 3D model… 0%');
    try {
      const entry = await buildExperience(exp, slotByExp.get(expId), (pct) => {
        setLoadStatus(`Loading 3D model… ${Math.round(pct * 100)}%`);
      });
      expRegistry.set(expId, entry);
      setLoadStatus('');
      return true;
    } catch (err) {
      console.error(`[AR] Load failed for ${expId}:`, err);
      setLoadStatus('Model failed to load. Check Wi‑Fi and refresh.');
      return false;
    } finally {
      loadingExps.delete(expId);
    }
  };

  const mountToSlot = async (slot, expId) => {
    if (!slot) return false;
    if (!expRegistry.has(expId)) {
      pendingActiveSlot = slot;
      const ok = await ensureExperienceLoaded(expId);
      if (!ok) return false;
      pendingActiveSlot = null;
    }

    const entry = expRegistry.get(expId);
    if (!entry) return false;

    if (entry.holder.parent !== slot.attachRig) {
      slot.attachRig.add(entry.holder);
    }

    showExperience(expId);
    ensureElephantVisible(entry.holder.children[0]);
    entry.holder.visible = true;
    entry.holder.traverse((child) => {
      child.visible = true;
      if (child.isSkinnedMesh) child.frustumCulled = false;
    });
    entry.anim?.reset?.();
    applyUserTransform(slot);
    setLoadStatus('');
    return true;
  };

  const ensureActiveVisible = async () => {
    if (!activeSlot?.experience || !isSlotTracked(activeSlot)) return;
    await mountToSlot(activeSlot, activeSlot.experience.id);
    if (activeRegistry?.holder) {
      activeRegistry.holder.visible = true;
      activeRegistry.holder.traverse((child) => {
        child.visible = true;
        if (child.isSkinnedMesh) child.frustumCulled = false;
      });
      activeRegistry.anim?.reset?.();
    }
  };

  const showStartWhenReady = async () => {
    if (forcePreload || (IS_ANDROID && setup.mode !== 'all')) {
      setLoadStatus('Loading 3D model… 0%');
      try {
        expRegistry = await loadExperiences(slots, (expId, pct) => {
          setLoadStatus(`Loading 3D model… ${Math.round(pct * 100)}%`);
        });
        if (expRegistry.size === 0) {
          setLoadStatus('Model failed to load. Check Wi‑Fi and refresh.');
          return;
        }
      } catch (err) {
        console.error('Model load failed:', err);
        setLoadStatus('Model failed to load. Check Wi‑Fi and refresh.');
        return;
      }
    }
    hide('loading-screen');
    show('start-screen');
    setLoadStatus('Ready — tap to start');
  };

  if (forcePreload || (IS_ANDROID && setup.mode !== 'all')) {
    show('loading-screen');
    const titleEl = document.querySelector('#loading-screen .loader-title');
    if (titleEl) titleEl.textContent = 'Loading 3D model…';
  } else {
    hide('loading-screen');
    show('start-screen');
  }

  const modelReady = (forcePreload || (IS_ANDROID && setup.mode !== 'all'))
    ? showStartWhenReady()
    : loadExperiences(slots, (expId, pct) => {
        setLoadStatus(`Loading 3D model… ${Math.round(pct * 100)}%`);
      }).then((registry) => {
        expRegistry = registry;
        setLoadStatus('');
        if (pendingActiveSlot) {
          const slot = pendingActiveSlot;
          pendingActiveSlot = null;
          activeSlot = slot;
          return mountToSlot(slot, slot.experience.id).then(() => {
            ensureActiveVisible();
            show('ar-controls');
          });
        }
        return registry;
      }).catch((err) => {
        console.error('Model load failed:', err);
        setLoadStatus('Model failed to load. Refresh and try again.');
      });

  const applyMarkerOffsets = () => {
    slots.forEach((slot) => {
      const off = getMarkerOffset(slot.experience);
      slot.marker.position.set(off.x, off.y, off.z);
    });
  };

  const resizeAR = () => {
    const container = document.querySelector('#ar-container');
    if (!container) return;

    const { w, h } = getViewportSize();
    if (w < 1 || h < 1) return;

    document.documentElement.style.height = `${h}px`;
    document.body.style.height = `${h}px`;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_END ? 1 : (IS_ANDROID ? 1.15 : 1.35)));
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const video = container.querySelector('video');
    if (video) {
      video.style.position = 'absolute';
      video.style.inset = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
    }
  };

  const restartAR = async () => {
    if (!arRunning || orientationBusy) return;
    orientationBusy = true;

    try {
      hideAllHolders();
      found.clear();
      clearTimeout(hideTimer);
      activeSlot = null;

      await mindar.stop();
      await new Promise((r) => setTimeout(r, 120));

      resizeAR();
      applyMarkerOffsets();

      await mindar.start();
      resizeAR();

      const video = getVideo();
      if (video) {
        video.style.zIndex = '1';
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.muted = true;
        await video.play().catch(() => {});
        cameraControls.refreshTrack();
      }
    } catch (err) {
      console.error('AR orientation restart failed:', err);
    } finally {
      orientationBusy = false;
    }
  };

  let resizeTimer = null;
  const onViewportChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      const nowLandscape = isLandscape();
      const flipped = nowLandscape !== lastLandscape;
      lastLandscape = nowLandscape;

      resizeAR();
      applyMarkerOffsets();

      if (arRunning && flipped) {
        if (activeSlot?.experience) {
          zoom.resetFor(activeSlot.experience);
          position.resetFor(activeSlot.experience);
          applyUserTransform(activeSlot);
        }
        await restartAR();
      }
    }, 500);
  };

  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  window.visualViewport?.addEventListener('resize', onViewportChange);
  screen.orientation?.addEventListener?.('change', onViewportChange);

  const containerEl = document.querySelector('#ar-container');
  if (containerEl && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(() => onViewportChange());
    ro.observe(containerEl);
  }

  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }

  const setActive = async (slot) => {
    if (!slot?.experience) {
      activeSlot = null;
      hideAllHolders();
      hide('ar-controls');
      return;
    }

    if (activeSlot?.experience?.id !== slot.experience.id) {
      zoom.resetFor(slot.experience);
      position.resetFor(slot.experience);
    }

    activeSlot = slot;
    const mounted = await mountToSlot(slot, slot.experience.id);
    if (mounted) show('ar-controls');
  };

  const pickActive = () => {
    if (lockedTargetIndex !== null) {
      const locked = slots.find((s) => s.targetIndex === lockedTargetIndex && found.has(s));
      if (locked) {
        void setActive(locked);
        return;
      }
      lockedTargetIndex = null;
    }

    for (const idx of TARGET_PRIORITY) {
      const slot = slots.find((s) => s.targetIndex === idx && found.has(s));
      if (slot) {
        lockedTargetIndex = idx;
        void setActive(slot);
        return;
      }
    }
    void setActive(null);
  };

  slots.forEach((slot) => {
    slot.anchor.onTargetFound = () => {
      clearTimeout(hideTimer);
      const wasFound = found.has(slot);
      found.add(slot);
      if (!wasFound) resetSlotSmoothing(slot);
      window.dispatchEvent(new CustomEvent('ar:target_found', {
        detail: { expId: slot.experience?.id || '', targetIndex: slot.targetIndex },
      }));
      pickActive();
      void ensureActiveVisible();
    };
    slot.anchor.onTargetLost = () => {
      found.delete(slot);
      resetSlotSmoothing(slot);
      if (lockedTargetIndex === slot.targetIndex) lockedTargetIndex = null;
      const stillTracked = slots.some((s) => s.experience?.id === slot.experience?.id && found.has(s));
      if (activeSlot === slot && !stillTracked) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!isSlotTracked(activeSlot)) pickActive();
        }, AR_SETTINGS.targetLostDelayMs);
      } else if (stillTracked) {
        pickActive();
      }
    };
  });

  bindButton($('zoom-in'), () => {
    zoom.zoomIn();
    applyUserTransform(activeSlot);
  });
  bindButton($('zoom-out'), () => {
    zoom.zoomOut();
    applyUserTransform(activeSlot);
  });
  bindButton($('zoom-reset'), () => {
    if (activeSlot?.experience) {
      zoom.resetFor(activeSlot.experience);
      position.resetFor(activeSlot.experience);
      applyUserTransform(activeSlot);
    }
  });
  bindButton($('move-up'), () => {
    position.moveUp();
    applyUserTransform(activeSlot);
  });
  bindButton($('move-down'), () => {
    position.moveDown();
    applyUserTransform(activeSlot);
  });

  bindButton($('torch-btn'), async () => {
    const on = await cameraControls.toggleTorch();
    $('torch-btn')?.classList.toggle('active', on === true);
  });
  bindButton($('bright-btn'), () => {
    const on = cameraControls.toggleBrighten();
    $('bright-btn')?.classList.toggle('active', on);
  });
  bindButton($('cam-zoom-in'), () => cameraControls.camZoomIn());
  bindButton($('cam-zoom-out'), () => cameraControls.camZoomOut());

  const startBtn = $('start-btn');

  startBtn.onclick = async () => {
    hide('start-screen');
    try {
      await mindar.start();
      arRunning = true;
      lastLandscape = isLandscape();
      resizeAR();
      applyMarkerOffsets();
      show('camera-controls');
      window.dispatchEvent(new CustomEvent('ar:started', { detail: { mode: setup.mode } }));
      const video = getVideo();
      if (video) {
        video.style.zIndex = '1';
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.muted = true;
        await video.play().catch(() => {});
        cameraControls.refreshTrack();
      }
    } catch (err) {
      showError('Allow camera and try again.');
      console.error(err);
      return;
    }

    if (!renderLoop) {
      const clock = new THREE.Clock();
      renderLoop = () => {
        const delta = Math.min(clock.getDelta(), 0.032);
        applyAnchorSmoothing();
        if (activeSlot) applyUserTransform(activeSlot);
        if (activeRegistry?.anim && isSlotTracked(activeSlot)) {
          activeRegistry.anim.update(delta);
        }
        renderer.render(scene, camera);
      };
      renderer.setAnimationLoop(renderLoop);
    }
  };

  modelReady.catch(() => {});
}

$('back-btn').onclick = () => { window.location.href = 'index.html'; };

initAR().catch((err) => {
  showError('Please refresh and try again.');
  console.error(err);
});
