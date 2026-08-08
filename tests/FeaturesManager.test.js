import FaceFeaturesExtractor, { default as DefaultExport } from '../src/managers/FeaturesManager.js';

const CONTOUR_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 144, 145, 153];
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 373, 374, 380];

function makeForwardFace() {
  const landmarks = [];
  for (let i = 0; i < 478; i++) {
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

function makeWritingHand() {
  const hand = [];
  for (let i = 0; i < 21; i++) {
    hand.push({ x: 0.5, y: 0.65, z: 0 });
  }
  hand[0] = { x: 0.5, y: 0.7, z: 0 };
  hand[8] = { x: 0.52, y: 0.62, z: 0 };
  hand[12] = { x: 0.52, y: 0.62, z: 0 };
  hand[4] = { x: 0.53, y: 0.62, z: 0 };
  return hand;
}

describe('FaceFeaturesExtractor', () => {
  const IMAGE_WIDTH = 640;
  const IMAGE_HEIGHT = 480;

  test('is exported as default', () => {
    expect(DefaultExport).toBe(FaceFeaturesExtractor);
  });

  describe('initializeFeatures', () => {
    test('returns default feature values', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);
      const features = extractor.initializeFeatures();

      expect(features.face_present).toBe(0);
      expect(features.no_of_face).toBe(0);
      expect(features.hand_count).toBe(0);
      expect(features.head_pose).toBe('None');
      expect(features.gaze_direction).toBe('None');
      expect(features.timestamp).toEqual(expect.any(Number));
    });
  });

  describe('extractFaceFeatures', () => {
    test('returns zeroed features when no faces are present', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, { faceLandmarks: [] }, null);

      const features = extractor.extractFaceFeatures();

      expect(features.face_present).toBe(0);
      expect(features.no_of_face).toBe(0);
    });

    test('extracts face features from landmarks', () => {
      const faceResults = { faceLandmarks: [makeForwardFace()] };
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, faceResults, null);

      const features = extractor.extractFaceFeatures();

      expect(features.face_present).toBe(1);
      expect(features.no_of_face).toBe(1);
      expect(features.face_w).toBeGreaterThan(0);
      expect(features.face_h).toBeGreaterThan(0);
      expect(features.face_conf).toBe(100);
      expect(features.head_pose).toBe('forward');
      expect(features.gaze_direction).toBe('center');
      expect(features.gaze_on_script).toBe(1);
      expect(features.nose_tip_x).toBe(320);
      expect(features.nose_tip_y).toBe(264);
    });
  });

  describe('extractHandFeatures', () => {
    test('returns zeroed hand features when no hands are present', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, { landmarks: [], handednesses: [] });

      const features = extractor.extractHandFeatures();

      expect(features.hand_count).toBe(0);
      expect(features.left_hand_x).toBe(0);
      expect(features.right_hand_x).toBe(0);
      expect(features.hand_obj_interaction).toBe(0);
    });

    test('extracts a left hand and mirrors it to the right side', () => {
      const handResults = {
        landmarks: [makeWritingHand()],
        handednesses: [[{ categoryName: 'Left' }]],
      };
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, handResults);

      const features = extractor.extractHandFeatures();

      expect(features.hand_count).toBe(1);
      expect(features.right_hand_x).toBe(320);
      expect(features.right_hand_y).toBe(336);
      expect(features.left_hand_x).toBe(0);
    });
  });

  describe('detectHandObjectInteraction', () => {
    test('flags a writing gesture as suspicious', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);

      expect(extractor.detectHandObjectInteraction([makeWritingHand()])).toBe(1);
    });

    test('returns 0 for a neutral hand position', () => {
      const hand = makeWritingHand();
      hand.forEach(point => { point.x = 0.5; point.y = 0.5; });
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);

      expect(extractor.detectHandObjectInteraction([hand])).toBe(0);
    });
  });

  describe('helpers', () => {
    test('denormalizeLandmark scales to pixel coordinates', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);

      expect(extractor.denormalizeLandmark({ x: 0.5, y: 0.5, z: 0.1 })).toEqual({ x: 320, y: 240, z: 64 });
    });

    test('euclideanDistance computes distance between points', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);

      expect(extractor.euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
  });

  describe('validateFeatures', () => {
    test('validates a fully extracted feature set', () => {
      const faceResults = { faceLandmarks: [makeForwardFace()] };
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, faceResults, null);
      const features = extractor.extractAllFeatures();

      const result = extractor.validateFeatures(features);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('reports out-of-range coordinates', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);
      const features = extractor.initializeFeatures();
      features.face_x = IMAGE_WIDTH + 100;
      features.head_yaw = Math.PI * 2;

      const result = extractor.validateFeatures(features);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('export helpers', () => {
    test('exportToJSON produces valid JSON', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);
      const json = extractor.exportToJSON(extractor.initializeFeatures());

      expect(JSON.parse(json)).toEqual(expect.objectContaining({ face_present: 0 }));
    });

    test('exportToCSV joins feature values with commas', () => {
      const extractor = new FaceFeaturesExtractor(IMAGE_WIDTH, IMAGE_HEIGHT, null, null);
      const csv = extractor.exportToCSV(extractor.initializeFeatures());

      expect(csv.split(',')).toHaveLength(FaceFeaturesExtractor.getCSVHeader().split(',').length);
    });

    test('getCSVHeader returns the header row', () => {
      const header = FaceFeaturesExtractor.getCSVHeader();

      expect(header).toContain('timestamp');
      expect(header).toContain('face_present');
      expect(header).toContain('hand_count');
    });
  });
});
