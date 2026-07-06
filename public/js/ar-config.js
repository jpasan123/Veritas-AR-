/**
 * Veritas AR — scan banner to see Sri Lanka diorama with walking elephant.
 */
const LOCATIONS = {
  'veritas-ar': {
    id: 'veritas-ar',
    targetIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    modelSrc: 'assets/veritas-ar-ready.glb',
    modelSrcMobile: 'assets/veritas-ar-ready-mobile.glb',
    modelScale: 0.88,
    modelOffset: { x: 0, y: 0.02, z: 0 },
    fitMode: 'ground',
    fitBounds: 'diorama',
    fitLift: 0.35,
    preloadRequired: true,
    playAnimation: true,
    preferredAnimation: 'walk',
    preserveSkinnedMeshes: true,
    skipMaterialLite: true,
    defaultUserZoom: 1,
    defaultUserYOffset: 0.02,
    landscape: {
      modelOffset: { x: 0, y: 0.02, z: 0 },
      defaultUserYOffset: 0.02,
    },
  },
};

export const MODES = {
  all: {
    targetSrc: 'targets.mind',
    experiences: [LOCATIONS['veritas-ar']],
    targetPriority: [1, 8, 2, 3, 4, 5, 6, 7, 0],
    facadeTargetIndices: [],
  },
};

export const AR_SETTINGS = {
  posSmooth: 0.05,
  rotSmooth: 0.04,
  scaleSmooth: 0.025,
  scaleCalibrateFrames: 14,
  defaultUserZoom: 1,
  minUserZoom: 0.55,
  maxUserZoom: 1.8,
  zoomStep: 0.08,
  defaultUserYOffset: 0.02,
  minUserYOffset: -0.2,
  maxUserYOffset: 0.35,
  positionStep: 0.06,
  targetLostDelayMs: 5500,
  targetLostSmoothResetMs: 900,
  filterMinCF: 0.00025,
  filterBeta: 0.00045,
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
