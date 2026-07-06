/**
 * Veritas AR — scan banner to see Sri Lanka diorama with walking elephant.
 */
const LOCATIONS = {
  'veritas-ar': {
    id: 'veritas-ar',
    targetIndices: [0],
    modelSrc: 'assets/veritas-ar-final.glb',
    modelScale: 0.92,
    modelOffset: { x: 0, y: 0.1, z: 0.03 },
    fitMode: 'diorama',
    fitBounds: 'diorama',
    fitLift: 0.35,
    preloadRequired: true,
    playAnimation: true,
    preferredAnimation: 'walk',
    preserveSkinnedMeshes: true,
    skipMaterialLite: true,
    defaultUserZoom: 1,
    defaultUserYOffset: 0.08,
    landscape: {
      modelOffset: { x: 0, y: 0.1, z: 0.03 },
      defaultUserYOffset: 0.08,
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
  posSmooth: 0.012,
  rotSmooth: 0.012,
  scaleSmooth: 0.02,
  scaleCalibrateFrames: 16,
  defaultUserZoom: 1,
  minUserZoom: 0.55,
  maxUserZoom: 1.8,
  zoomStep: 0.15,
  defaultUserYOffset: 0.08,
  minUserYOffset: -0.2,
  maxUserYOffset: 0.4,
  positionStep: 0.06,
  targetLostDelayMs: 2500,
  filterMinCF: 0.00001,
  filterBeta: 0.00002,
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
