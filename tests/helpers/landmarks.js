export const NUM_LANDMARKS = 478;

export function createLandmarks(overrides = {}) {
  const landmarks = [];
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    landmarks.push({ x: 0, y: 0, z: 0 });
  }

  Object.entries(overrides).forEach(([index, point]) => {
    landmarks[Number(index)] = { x: 0, y: 0, z: 0, ...point };
  });

  return landmarks;
}

export function createFaceResults(faceArrays = []) {
  return { faceLandmarks: faceArrays };
}

export function createHandResults(handArrays = [], handednesses = []) {
  return { landmarks: handArrays, handednesses };
}

const CONTOUR_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 144, 145, 153];
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 373, 374, 380];

export function makeForwardFaceLandmarks() {
  const landmarks = [];
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    landmarks.push({ x: 0.5, y: 0.55, z: 0 });
  }

  CONTOUR_INDICES.forEach((index, i) => {
    const angle = (i / CONTOUR_INDICES.length) * Math.PI * 2;
    landmarks[index] = {
      x: 0.5 + Math.cos(angle) * 0.3,
      y: 0.55 + Math.sin(angle) * 0.3,
      z: 0,
    };
  });

  const set = (index, x, y) => { landmarks[index] = { x, y, z: 0 }; };

  set(1, 0.5, 0.55);
  set(168, 0.5, 0.5);
  set(152, 0.5, 0.8);
  set(234, 0.2, 0.5);
  set(454, 0.8, 0.5);
  set(61, 0.45, 0.6);
  set(291, 0.55, 0.6);

  const leftEye = [
    [0.3, 0.45], [0.4, 0.45], [0.35, 0.44], [0.35, 0.44],
    [0.35, 0.44], [0.35, 0.46], [0.35, 0.46], [0.35, 0.46],
  ];
  LEFT_EYE_INDICES.forEach((index, i) => set(index, leftEye[i][0], leftEye[i][1]));

  const rightEye = [
    [0.6, 0.45], [0.7, 0.45], [0.65, 0.44], [0.65, 0.44],
    [0.65, 0.44], [0.65, 0.46], [0.65, 0.46], [0.65, 0.46],
  ];
  RIGHT_EYE_INDICES.forEach((index, i) => set(index, rightEye[i][0], rightEye[i][1]));

  set(468, 0.35, 0.45);
  set(473, 0.65, 0.45);

  return landmarks;
}

export function makeFaceRegionLandmarks() {
  const landmarks = [];
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    landmarks.push({ x: 0.3 + (i % 40) / 100, y: 0.3 + ((i * 3) % 40) / 100, z: 0 });
  }
  landmarks[234] = { x: 0.3, y: 0.5, z: 0 };
  landmarks[454] = { x: 0.7, y: 0.5, z: 0 };
  return landmarks;
}

export function makeHandNearPoint(point, spread = 0.12) {
  const hand = [];
  for (let i = 0; i < 21; i++) {
    hand.push({ x: point.x, y: point.y, z: 0 });
  }
  hand[8] = { x: point.x - spread / 2, y: point.y, z: 0 };
  hand[20] = { x: point.x + spread / 2, y: point.y, z: 0 };
  return hand;
}
