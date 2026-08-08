import { VisualDetectionModule } from '../src/modules/VisualDetectionModule.js';
import {
  createLandmarks,
  makeForwardFaceLandmarks,
  makeFaceRegionLandmarks,
  makeHandNearPoint,
} from './helpers/landmarks.js';

jest.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: {},
  HandLandmarker: {},
  ObjectDetector: {},
  FilesetResolver: {},
}));

describe('VisualDetectionModule', () => {
  let module;
  let onEvent;
  let onStateChange;

  beforeEach(() => {
    onEvent = jest.fn();
    onStateChange = jest.fn();
    module = new VisualDetectionModule({ onEvent, onStateChange });
    module.videoElement = { videoWidth: 640, videoHeight: 480 };
  });

  const emittedEvents = () => onEvent.mock.calls.map(([event]) => event.event);
  const eventFor = (type) => onEvent.mock.calls.map(([event]) => event).find(e => e.event === type);

  describe('constructor', () => {
    test('applies default options', () => {
      expect(module.options.stabilityFrames).toBe(15);
      expect(module.options.gazeThreshold).toBe(20);
      expect(module.options.mouthOpenRatioThreshold).toBe(0.15);
      expect(module.options.mouthMovementThreshold).toBe(0.008);
      expect(module.options.earThreshold).toBe(0.22);
    });

    test('initializes state defaults', () => {
      const state = module.getState();

      expect(state.numFaces).toBe(0);
      expect(state.currentGazeDirection).toBe('center');
      expect(state.isMouthMoving).toBe(false);
      expect(state.suspiciousObjectDetected).toBe(false);
      expect(state.faceLandmarks).toBeNull();
    });
  });

  describe('updateOptions', () => {
    test('merges new options', () => {
      module.updateOptions({ detectionFPS: 5 });

      expect(module.options.detectionFPS).toBe(5);
      expect(module.options.stabilityFrames).toBe(15);
    });
  });

  describe('analyzeFaceCount', () => {
    test('emits NO_FACE after sustained absence and PERSON_LEFT after extended absence', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      module.updateOptions({ stabilityFrames: 3 });

      for (let i = 0; i < 20; i++) {
        module.analyzeFaceCount(0);
      }

      expect(emittedEvents()).toContain('NO_FACE');
      expect(eventFor('NO_FACE')).toEqual(expect.objectContaining({ faces: 0 }));
      expect(emittedEvents()).toContain('PERSON_LEFT');
    });

    test('emits MULTIPLE_FACES when more than one face is present', () => {
      module.analyzeFaceCount(2);

      expect(eventFor('MULTIPLE_FACES')).toEqual(expect.objectContaining({
        lv: 10,
        faces: 2,
      }));
    });

    test('resets absence tracking when a single face is detected', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      module.updateOptions({ stabilityFrames: 3 });

      for (let i = 0; i < 10; i++) {
        module.analyzeFaceCount(0);
      }

      module.analyzeFaceCount(1);

      expect(module.state.consecutiveNoFaceFrames).toBe(0);
      expect(module.state.personLeftStartTime).toBeNull();
    });
  });

  describe('analyzeHeadPose', () => {
    test('emits HEAD_TURNED and HEAD_TILTED for a turned face', () => {
      const landmarks = createLandmarks({
        1: { x: 0.78, y: 0.85 },
        6: { x: 0.5, y: 0.4 },
        10: { x: 0.5, y: 0.2 },
        152: { x: 0.5, y: 0.9 },
        234: { x: 0.2, y: 0.5 },
        454: { x: 0.9, y: 0.5 },
      });

      module.analyzeHeadPose(landmarks);

      expect(eventFor('HEAD_TURNED')).toEqual(expect.objectContaining({
        lv: 7,
        direction: 'right',
        severity: 'high',
      }));
      expect(eventFor('HEAD_TILTED')).toEqual(expect.objectContaining({
        lv: 7,
        direction: 'down',
      }));
    });

    test('does not emit events for a centered face', () => {
      const landmarks = createLandmarks({
        1: { x: 0.5, y: 0.55 },
        6: { x: 0.5, y: 0.4 },
        10: { x: 0.5, y: 0.2 },
        152: { x: 0.5, y: 0.9 },
        234: { x: 0.2, y: 0.5 },
        454: { x: 0.8, y: 0.5 },
      });

      module.analyzeHeadPose(landmarks);

      expect(emittedEvents()).toEqual([]);
    });
  });

  describe('analyzeMouthMovement', () => {
    test('emits TALKING_DETECTED when the mouth is moving and open', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.mouthOpenHistory = Array(9).fill(0.01);
      module.state.talkingByMouthStartTime = 2000000 - 2000;

      const landmarks = createLandmarks({
        0: { x: 0.5, y: 0.5 },
        13: { x: 0.5, y: 0.4 },
        14: { x: 0.5, y: 0.8 },
        17: { x: 0.5, y: 0.9 },
        61: { x: 0.3, y: 0.6 },
        291: { x: 0.7, y: 0.6 },
      });

      module.analyzeMouthMovement(landmarks);

      expect(eventFor('TALKING_DETECTED')).toEqual(expect.objectContaining({
        lv: 9,
        detectionMethod: 'visual',
        severity: 'high',
      }));
    });

    test('emits TALKING_EPISODE when talking stops', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.mouthOpenHistory = Array(9).fill(0.01);
      module.state.talkingByMouthStartTime = 2000000 - 2000;
      module.state.isTalkingByMouth = true;

      const landmarks = createLandmarks({
        0: { x: 0.5, y: 0.5 },
        13: { x: 0.5, y: 0.5 },
        14: { x: 0.5, y: 0.51 },
        17: { x: 0.5, y: 0.6 },
        61: { x: 0.3, y: 0.5 },
        291: { x: 0.7, y: 0.5 },
      });

      module.analyzeMouthMovement(landmarks);

      expect(eventFor('TALKING_EPISODE')).toEqual(expect.objectContaining({
        lv: 7,
        detectionMethod: 'visual',
      }));
      expect(module.state.talkingByMouthStartTime).toBeNull();
    });

    test('does not emit while the mouth is still', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.mouthOpenHistory = Array(9).fill(0.01);

      const landmarks = createLandmarks({
        0: { x: 0.5, y: 0.5 },
        13: { x: 0.5, y: 0.5 },
        14: { x: 0.5, y: 0.51 },
        17: { x: 0.5, y: 0.6 },
        61: { x: 0.3, y: 0.5 },
        291: { x: 0.7, y: 0.5 },
      });

      module.analyzeMouthMovement(landmarks);

      expect(emittedEvents()).toEqual([]);
    });
  });

  describe('analyzeEyeState', () => {
    test('emits EYES_CLOSED when eyes stay closed for over two seconds', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.eyesClosedStartTime = 2000000 - 2500;

      const landmarks = createLandmarks({
        159: { x: 0.4, y: 0.5 },
        145: { x: 0.4, y: 0.51 },
        133: { x: 0.4, y: 0.5 },
        33: { x: 0.5, y: 0.5 },
        386: { x: 0.6, y: 0.5 },
        374: { x: 0.6, y: 0.51 },
        362: { x: 0.6, y: 0.5 },
        263: { x: 0.7, y: 0.5 },
      });

      module.analyzeEyeState(landmarks);

      expect(eventFor('EYES_CLOSED')).toEqual(expect.objectContaining({
        lv: 7,
        severity: 'high',
      }));
    });

    test('counts a blink for a brief eye closure', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.eyesClosedStartTime = 2000000 - 200;

      const landmarks = createLandmarks({
        159: { x: 0.4, y: 0.5 },
        145: { x: 0.4, y: 0.54 },
        133: { x: 0.4, y: 0.5 },
        33: { x: 0.5, y: 0.5 },
        386: { x: 0.6, y: 0.5 },
        374: { x: 0.6, y: 0.54 },
        362: { x: 0.6, y: 0.5 },
        263: { x: 0.7, y: 0.5 },
      });

      module.analyzeEyeState(landmarks);

      expect(module.state.blinkCount).toBe(1);
      expect(module.state.eyesClosedStartTime).toBeNull();
    });

    test('emits SUSPICIOUS_GAZE_READING when not blinking while looking away', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.sessionStartTime = 2000000 - 120000;
      module.state.currentGazeDirection = 'left';
      module.state.lastBlinkTime = 2000000 - 15000;

      const landmarks = createLandmarks({
        159: { x: 0.4, y: 0.5 },
        145: { x: 0.4, y: 0.54 },
        133: { x: 0.4, y: 0.5 },
        33: { x: 0.5, y: 0.5 },
        386: { x: 0.6, y: 0.5 },
        374: { x: 0.6, y: 0.54 },
        362: { x: 0.6, y: 0.5 },
        263: { x: 0.7, y: 0.5 },
      });

      module.analyzeEyeState(landmarks);

      expect(eventFor('SUSPICIOUS_GAZE_READING')).toEqual(expect.objectContaining({
        lv: 9,
        severity: 'critical',
      }));
    });
  });

  describe('hand analysis', () => {
    test('getFaceBounds computes face bounds', () => {
      const landmarks = makeFaceRegionLandmarks();

      const bounds = module.getFaceBounds(landmarks);

      expect(bounds.center).toBeDefined();
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    });

    test('analyzeHandProximity detects a hand covering the face', () => {
      const face = makeFaceRegionLandmarks();
      const hand = makeHandNearPoint({ x: 0.5, y: 0.5 });

      const result = module.analyzeHandProximity(hand, face, 'left');

      expect(result.covering).toBe(true);
      expect(result.nearFace).toBe(true);
    });

    test('analyzeHandProximity returns false for a distant hand', () => {
      const face = makeFaceRegionLandmarks();
      const hand = makeHandNearPoint({ x: 0.9, y: 0.9 });

      const result = module.analyzeHandProximity(hand, face, 'left');

      expect(result.covering).toBe(false);
      expect(result.nearFace).toBe(false);
    });

    test('detectPhoneGesture emits PHONE_DETECTED for a hand near the ear', () => {
      const face = makeFaceRegionLandmarks();
      const hand = makeHandNearPoint({ x: 0.3, y: 0.5 });

      module.detectPhoneGesture(hand, null, face);

      expect(eventFor('PHONE_DETECTED')).toEqual(expect.objectContaining({
        lv: 9,
        hand: 'left',
        severity: 'critical',
      }));
    });
  });

  describe('analyzeObjects', () => {
    test('emits SUSPICIOUS_OBJECT for a detected cell phone', () => {
      module.updateOptions({ stabilityFrames: 3 });
      module.videoElement = { videoWidth: 640, videoHeight: 480 };
      module.state.faceLandmarks = null;
      module.state.handResults = null;
      module.objectDetector = {
        detectForVideo: jest.fn(() => ({
          detections: [{
            categories: [{ categoryName: 'cell phone', score: 0.9 }],
          }],
        })),
      };

      for (let i = 0; i < 3; i++) {
        module.analyzeObjects(1000 + i);
      }

      expect(eventFor('SUSPICIOUS_OBJECT')).toEqual(expect.objectContaining({
        lv: 9,
        object: 'cell phone',
        confidence: 0.9,
      }));
    });

    test('ignores non-suspicious objects', () => {
      module.updateOptions({ stabilityFrames: 3 });
      module.objectDetector = {
        detectForVideo: jest.fn(() => ({
          detections: [{
            categories: [{ categoryName: 'person', score: 0.9 }],
          }],
        })),
      };

      for (let i = 0; i < 5; i++) {
        module.analyzeObjects(1000 + i);
      }

      expect(emittedEvents()).toEqual([]);
    });
  });

  describe('canEmitEvent', () => {
    test('throttles events within the interval', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      expect(module.canEmitEvent('TALKING_DETECTED')).toBe(true);
      expect(module.canEmitEvent('TALKING_DETECTED')).toBe(false);

      Date.now.mockReturnValue(1001001);
      expect(module.canEmitEvent('TALKING_DETECTED')).toBe(true);
    });
  });

  describe('emitEvent', () => {
    test('emits an event with extracted features', () => {
      module.videoElement = { videoWidth: 640, videoHeight: 480 };
      module.state.faceLandmarks = { faceLandmarks: [makeForwardFaceLandmarks()] };
      module.state.handResults = null;

      module.emitEvent('NO_FACE', 8, { frames: 5 });

      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        event: 'NO_FACE',
        lv: 8,
        frames: 5,
        frameNumber: expect.any(Number),
        ts: expect.any(Number),
        extractedFeatures: expect.objectContaining({ face_present: 1 }),
      }));
    });
  });

  describe('start/stop', () => {
    test('start schedules the loop and stop cancels it', () => {
      jest.useFakeTimers();
      module.faceLandmarker = {};
      const videoElement = { videoWidth: 640, videoHeight: 480 };

      module.start(videoElement);

      expect(module.isRunning).toBe(true);
      expect(module.videoElement).toBe(videoElement);
      expect(module.animationFrameId).not.toBeNull();

      module.stop();
      expect(module.isRunning).toBe(false);
      expect(module.animationFrameId).toBeNull();

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('start warns when the module is not initialized', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      module.start({});

      expect(consoleWarn).toHaveBeenCalled();
      expect(module.isRunning).toBe(false);
    });
  });

  describe('helpers and statistics', () => {
    test('calculateDistance computes 3D distance', () => {
      expect(module.calculateDistance({ x: 0, y: 0, z: 1 }, { x: 1, y: 2, z: 2 })).toBeCloseTo(Math.sqrt(6), 5);
    });

    test('calculateDistance treats a zero z as missing', () => {
      expect(module.calculateDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBeCloseTo(Math.sqrt(5), 5);
    });

    test('calculateDistance ignores missing z values', () => {
      expect(module.calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    test('calculateVariance computes variance of a list', () => {
      expect(module.calculateVariance([1, 2, 3])).toBeCloseTo(0.6667, 3);
      expect(module.calculateVariance([])).toBe(0);
    });

    test('getDetailedStatistics returns computed metrics', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.sessionStartTime = 2000000 - 10000;
      module.frameCount = 10;
      module.state.blinkCount = 5;
      module.state.gazeDirectionDurations.left = 5000;
      module.state.mouthTalkingDuration = 2500;

      const stats = module.getDetailedStatistics();

      expect(stats.sessionDurationSeconds).toBe(10);
      expect(stats.framesProcessed).toBe(10);
      expect(stats.averageFps).toBe(1);
      expect(stats.blinkRate).toBe(30);
      expect(stats.gazeAwayPercentage.left).toBe(50);
      expect(stats.talkingPercentage.visual).toBe(25);
    });

    test('getState returns a copy of the state', () => {
      const state = module.getState();
      state.numFaces = 99;

      expect(module.state.numFaces).toBe(0);
    });
  });
});
