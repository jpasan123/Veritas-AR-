/**
 * Veritas AR — scan banner to see Sri Lanka diorama with walking elephant.
 */
const BANNER_ASPECT = 860 / 541;

const LOCATIONS = {
  'veritas-ar': {
    id: 'veritas-ar',
    targetIndices: [0, 1, 2],
    modelSrc: 'assets/veritas-ar-ready.glb',
    modelSrcMobile: 'assets/veritas-ar-ready-mobile.glb',
    modelScale: 0.48,
    modelOffset: { x: 0, y: 0, z: 0.02 },
    bannerAspect: BANNER_ASPECT,
    targetCropCenterY: {
      0: 0.47,
      1: 0.50,
      2: 0.66,
    },
    fitMode: 'center',
    fitBounds: 'diorama',
    fitCenterY: 0.40,
    fitLift: 0.35,
    preloadRequired: true,
    playAnimation: true,
    preferredAnimation: 'walk',
    preserveSkinnedMeshes: true,
    skipMaterialLite: true,
    defaultUserZoom: 1,
    defaultUserYOffset: 0,
    landscape: {
      modelOffset: { x: 0, y: 0, z: 0.02 },
      defaultUserYOffset: 0,
    },
  },
};

export const MODES = {
  all: {
    targetSrc: 'targets.mind',
    experiences: [LOCATIONS['veritas-ar']],
    targetPriority: [1, 0, 2],
    facadeTargetIndices: [],
  },
};

export const AR_SETTINGS = {
  defaultUserZoom: 1,
  minUserZoom: 0.55,
  maxUserZoom: 1.8,
  zoomStep: 0.08,
  defaultUserYOffset: 0,
  minUserYOffset: -0.2,
  maxUserYOffset: 0.35,
  positionStep: 0.06,
  targetLostDelayMs: 8000,
  targetRecoverMs: 3500,
  filterMinCF: 0.0002,
  filterBeta: 0.0003,
  poseSmooth: 0.2,
  poseMaxStep: 0.01,
  minCameraZoom: 1,
  maxCameraZoom: 3,
  cameraZoomStep: 0.25,
};

export function getMode() {
  return 'all';
}

export function getSetup() {
  const cfg = MODES.all;
  return {
    mode: 'all',
    targetSrc: cfg.targetSrc,
    experiences: cfg.experiences,
    targetPriority: cfg.targetPriority,
    facadeTargetIndices: cfg.facadeTargetIndices,
  };
}

export function experienceForTarget(experiences, index) {
  return experiences.find((exp) => exp.targetIndices.includes(index)) ?? null;
}

export function targetCount(experiences) {
  return Math.max(...experiences.flatMap((e) => e.targetIndices)) + 1;
}
