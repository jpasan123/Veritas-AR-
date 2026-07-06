/**
 * Veritas AR — scan banner logo to see Sri Lanka diorama with elephant.
 */
const LOCATIONS = {
  'veritas-ar': {
    id: 'veritas-ar',
    targetIndices: [0],
    modelSrc: 'assets/veritas-ar-final.glb',
    modelScale: 0.62,
    modelOffset: { x: 0, y: 0, z: 0.02 },
    fitMode: 'ground',
    fitBounds: 'diorama',
    fitLift: 0.35,
    preloadRequired: true,
    playAnimation: false,
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
    targetPriority: [0],
    facadeTargetIndices: [],
  },
};

export const AR_SETTINGS = {
  posSmooth: 0.018,
  rotSmooth: 0.018,
  scaleSmooth: 0.025,
  scaleCalibrateFrames: 20,
  defaultUserZoom: 1,
  minUserZoom: 0.55,
  maxUserZoom: 1.8,
  zoomStep: 0.15,
  defaultUserYOffset: 0,
  minUserYOffset: -0.3,
  maxUserYOffset: 0.35,
  positionStep: 0.06,
  targetLostDelayMs: 2200,
  filterMinCF: 0.00008,
  filterBeta: 0.00008,
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
