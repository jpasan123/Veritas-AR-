/**
 * Veritas AR — scan Veritas logo on banner to play 3D model.
 */
const LOCATIONS = {
  'veritas-ar': {
    id: 'veritas-ar',
    targetIndices: [0],
    modelSrc: 'assets/veritas-ar-fast.glb',
    modelScale: 0.72,
    modelOffset: { x: 0, y: 0.03, z: 0.05 },
    fitMode: 'ground',
    fitLift: 0.35,
    preloadRequired: true,
    playAnimation: false,
    skipMaterialLite: true,
    defaultUserZoom: 1,
    defaultUserYOffset: 0,
    landscape: {
      modelOffset: { x: 0, y: 0.03, z: 0.05 },
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
  posSmooth: 0.02,
  rotSmooth: 0.02,
  scaleSmooth: 0.03,
  scaleCalibrateFrames: 18,
  defaultUserZoom: 1,
  minUserZoom: 0.55,
  maxUserZoom: 1.8,
  zoomStep: 0.15,
  defaultUserYOffset: 0,
  minUserYOffset: -0.3,
  maxUserYOffset: 0.35,
  positionStep: 0.06,
  targetLostDelayMs: 1800,
  filterMinCF: 0.00005,
  filterBeta: 0.00005,
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
