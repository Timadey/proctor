import {
  LANDMARKS,
  calculateHeadPose,
  calculateHeadPoseOld,
  calculateIrisGaze,
  detectMouthMovement,
  applyStabilityFilter,
  getFaceBoundingBox,
} from '../src/headPoseUtils.js';
import { createLandmarks } from './helpers/landmarks.js';

describe('LANDMARKS', () => {
  test('exposes key landmark indices', () => {
    expect(LANDMARKS.NOSE_TIP).toBe(1);
    expect(LANDMARKS.CHIN).toBe(152);
    expect(LANDMARKS.LEFT_EYE_CORNER).toBe(33);
    expect(LANDMARKS.RIGHT_EYE_CORNER).toBe(263);
    expect(LANDMARKS.LEFT_IRIS_CENTER).toBe(468);
    expect(LANDMARKS.RIGHT_IRIS_CENTER).toBe(473);
  });
});

describe('calculateHeadPose', () => {
  test('returns zero pose for missing landmarks', () => {
    expect(calculateHeadPose(null)).toEqual({ yaw: 0, pitch: 0, roll: 0, confidence: 0 });
    expect(calculateHeadPose([{ x: 0, y: 0, z: 0 }])).toEqual({ yaw: 0, pitch: 0, roll: 0, confidence: 0 });
  });

  test('computes yaw, pitch, roll and confidence for a centered face', () => {
    const landmarks = createLandmarks({
      1: { x: 0.5, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      234: { x: 0.3, y: 0.5, z: 0 },
      454: { x: 0.7, y: 0.5, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
    });

    const pose = calculateHeadPose(landmarks);

    expect(pose.roll).toBe(0);
    expect(pose.yaw).toBe(180);
    expect(pose.pitch).toBe(165);
    expect(pose.confidence).toBe(1);
  });

  test('yaw reflects depth difference between ears', () => {
    const landmarks = createLandmarks({
      1: { x: 0.5, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      234: { x: 0.4, y: 0.5, z: 0.2 },
      454: { x: 0.6, y: 0.5, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
    });

    const pose = calculateHeadPose(landmarks);

    expect(pose.yaw).toBe(135);
  });

  test('roll reflects vertical offset between eyes', () => {
    const landmarks = createLandmarks({
      1: { x: 0.5, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      234: { x: 0.3, y: 0.5, z: 0 },
      454: { x: 0.7, y: 0.5, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.45, z: 0 },
    });

    const pose = calculateHeadPose(landmarks);
    const expectedRoll = Math.round(Math.atan2(0.05, 0.2) * (180 / Math.PI));

    expect(pose.roll).toBe(expectedRoll);
  });

  test('confidence decreases as nose gets closer to camera', () => {
    const far = createLandmarks({
      1: { x: 0.5, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      234: { x: 0.3, y: 0.5, z: 0 },
      454: { x: 0.7, y: 0.5, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
    });
    const near = createLandmarks({
      1: { x: 0.5, y: 0.45, z: -0.5 },
      152: { x: 0.5, y: 0.75, z: 0 },
      234: { x: 0.3, y: 0.5, z: 0 },
      454: { x: 0.7, y: 0.5, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
    });

    expect(calculateHeadPose(far).confidence).toBe(1);
    expect(calculateHeadPose(near).confidence).toBe(0.5);
  });
});

describe('calculateHeadPoseOld', () => {
  test('returns zero pose for missing landmarks', () => {
    expect(calculateHeadPoseOld(null)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    expect(calculateHeadPoseOld([{ x: 0, y: 0, z: 0 }])).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  test('returns 0 yaw for a symmetric centered face', () => {
    const landmarks = createLandmarks({
      1: { x: 0.5, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
      61: { x: 0.45, y: 0.6, z: 0 },
      291: { x: 0.55, y: 0.6, z: 0 },
    });

    const pose = calculateHeadPoseOld(landmarks);

    expect(pose.yaw).toBe(0);
    expect(pose.roll).toBe(0);
  });

  test('yaw is positive when the nose is closer to the left eye', () => {
    const landmarks = createLandmarks({
      1: { x: 0.42, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
      61: { x: 0.45, y: 0.6, z: 0 },
      291: { x: 0.55, y: 0.6, z: 0 },
    });

    const pose = calculateHeadPoseOld(landmarks);

    expect(pose.yaw).toBe(72);
  });

  test('yaw is negative when the nose is closer to the right eye', () => {
    const landmarks = createLandmarks({
      1: { x: 0.58, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.75, z: 0 },
      33: { x: 0.4, y: 0.4, z: 0 },
      263: { x: 0.6, y: 0.4, z: 0 },
      61: { x: 0.45, y: 0.6, z: 0 },
      291: { x: 0.55, y: 0.6, z: 0 },
    });

    const pose = calculateHeadPoseOld(landmarks);

    expect(pose.yaw).toBe(-72);
  });
});

describe('calculateIrisGaze', () => {
  test('returns zero gaze for missing landmarks', () => {
    expect(calculateIrisGaze(null)).toEqual({ x: 0, y: 0 });
    expect(calculateIrisGaze([{ x: 0, y: 0, z: 0 }])).toEqual({ x: 0, y: 0 });
  });

  test('returns near zero for a centered gaze', () => {
    const landmarks = createLandmarks({
      468: { x: 0.45, y: 0.5 },
      33: { x: 0.4, y: 0.5 },
      133: { x: 0.5, y: 0.5 },
      159: { x: 0.45, y: 0.45 },
      145: { x: 0.45, y: 0.55 },
      473: { x: 0.55, y: 0.5 },
      362: { x: 0.5, y: 0.5 },
      263: { x: 0.6, y: 0.5 },
      386: { x: 0.55, y: 0.45 },
      374: { x: 0.55, y: 0.55 },
    });

    const gaze = calculateIrisGaze(landmarks);

    expect(gaze.x).toBeCloseTo(0, 5);
    expect(gaze.y).toBeCloseTo(0, 5);
  });

  test('returns positive x when iris is shifted right', () => {
    const landmarks = createLandmarks({
      468: { x: 0.5, y: 0.5 },
      33: { x: 0.4, y: 0.5 },
      133: { x: 0.5, y: 0.5 },
      159: { x: 0.45, y: 0.45 },
      145: { x: 0.45, y: 0.55 },
      473: { x: 0.6, y: 0.5 },
      362: { x: 0.5, y: 0.5 },
      263: { x: 0.6, y: 0.5 },
      386: { x: 0.55, y: 0.45 },
      374: { x: 0.55, y: 0.55 },
    });

    const gaze = calculateIrisGaze(landmarks);

    expect(gaze.x).toBeCloseTo(1.75, 5);
    expect(gaze.y).toBeCloseTo(0, 5);
  });
});

describe('detectMouthMovement', () => {
  test('returns defaults for missing landmarks', () => {
    expect(detectMouthMovement(null)).toEqual({ isMoving: false, openRatio: 0 });
    expect(detectMouthMovement([])).toEqual({ isMoving: false, openRatio: 0 });
  });

  test('detects a closed mouth', () => {
    const landmarks = createLandmarks({
      13: { x: 0.5, y: 0.5 },
      14: { x: 0.5, y: 0.51 },
      61: { x: 0.3, y: 0.5 },
      291: { x: 0.7, y: 0.5 },
    });

    const result = detectMouthMovement(landmarks);

    expect(result.isMoving).toBe(false);
    expect(result.openRatio).toBe(0.03);
  });

  test('detects an open mouth', () => {
    const landmarks = createLandmarks({
      13: { x: 0.5, y: 0.4 },
      14: { x: 0.5, y: 0.6 },
      61: { x: 0.3, y: 0.5 },
      291: { x: 0.7, y: 0.5 },
    });

    const result = detectMouthMovement(landmarks);

    expect(result.isMoving).toBe(true);
    expect(result.openRatio).toBe(0.5);
  });
});

describe('applyStabilityFilter', () => {
  test('requires consistent detection across frames', () => {
    const stabilityState = {};

    for (let i = 0; i < 14; i++) {
      expect(applyStabilityFilter('GAZE_AWAY', true, stabilityState, 15)).toBe(false);
    }
    expect(applyStabilityFilter('GAZE_AWAY', true, stabilityState, 15)).toBe(true);
  });

  test('decays the counter when condition is not detected', () => {
    const stabilityState = {};

    for (let i = 0; i < 15; i++) {
      applyStabilityFilter('GAZE_AWAY', true, stabilityState, 15);
    }
    expect(applyStabilityFilter('GAZE_AWAY', false, stabilityState, 15)).toBe(false);

    const countAfterDecay = stabilityState.GAZE_AWAY;
    expect(countAfterDecay).toBe(13);
  });

  test('never decays below zero', () => {
    const stabilityState = {};

    for (let i = 0; i < 5; i++) {
      applyStabilityFilter('NO_FACE', false, stabilityState, 15);
    }

    expect(stabilityState.NO_FACE).toBe(0);
  });
});

describe('getFaceBoundingBox', () => {
  test('returns null for empty input', () => {
    expect(getFaceBoundingBox(null)).toBeNull();
    expect(getFaceBoundingBox([])).toBeNull();
  });

  test('computes bounding box from landmarks', () => {
    const landmarks = createLandmarks({
      1: { x: 0.5, y: 0.4 },
      33: { x: 0.3, y: 0.5 },
      263: { x: 0.7, y: 0.6 },
      152: { x: 0.6, y: 0.9 },
    });

    const box = getFaceBoundingBox(landmarks);

    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBeCloseTo(0.7, 5);
    expect(box.height).toBeCloseTo(0.9, 5);
  });
});
