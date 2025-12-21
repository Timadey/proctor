/**
 * Head Pose Estimation and Gaze Tracking Utilities
 * Implements geometric calculations for MediaPipe Face Landmarker
 */

/**
 * Key landmark indices for face pose estimation
 */
export const LANDMARKS = {
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_EYE_CORNER: 33,
  RIGHT_EYE_CORNER: 263,
  LEFT_MOUTH_CORNER: 61,
  RIGHT_MOUTH_CORNER: 291,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  // Iris landmarks (468-477)
  LEFT_IRIS_CENTER: 468,
  LEFT_IRIS_RIGHT: 469,
  LEFT_IRIS_TOP: 470,
  LEFT_IRIS_LEFT: 471,
  LEFT_IRIS_BOTTOM: 472,
  RIGHT_IRIS_CENTER: 473,
  RIGHT_IRIS_RIGHT: 474,
  RIGHT_IRIS_TOP: 475,
  RIGHT_IRIS_LEFT: 476,
  RIGHT_IRIS_BOTTOM: 477,
};

/**
 * Calculate head pose angles (Yaw, Pitch, Roll) from face landmarks
 * Uses normalized 3D coordinates for resolution-independent calculation
 * 
 * @param {Array} landmarks - Array of normalized face landmarks from MediaPipe
 * @returns {Object} - { yaw, pitch, roll } in degrees
 */
export const calculateHeadPoseOld = (landmarks) => {
  if (!landmarks || landmarks.length < 478) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Extract key points (normalized coordinates: x, y, z)
  const noseTip = landmarks[LANDMARKS.NOSE_TIP];
  const chin = landmarks[LANDMARKS.CHIN];
  const leftEye = landmarks[LANDMARKS.LEFT_EYE_CORNER];
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE_CORNER];
  const leftMouth = landmarks[LANDMARKS.LEFT_MOUTH_CORNER];
  const rightMouth = landmarks[LANDMARKS.RIGHT_MOUTH_CORNER];

  // Calculate Yaw (horizontal head rotation)
  // Yaw is based on the asymmetry of eye-to-nose distances
  const leftEyeToNose = Math.abs(leftEye.x - noseTip.x);
  const rightEyeToNose = Math.abs(rightEye.x - noseTip.x);
  const eyeWidth = Math.abs(leftEye.x - rightEye.x);
  
  // Normalized difference (-1 to 1, where 0 is centered)
  const yawRatio = (rightEyeToNose - leftEyeToNose) / eyeWidth;
  const yaw = yawRatio * 90; // Convert to degrees (-90 to +90)

  // Calculate Pitch (vertical head rotation)
  // Pitch is based on nose position relative to eye line
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const noseToChin = Math.abs(noseTip.y - chin.y);
  const pitchRatio = (noseTip.y - eyeCenterY) / noseToChin;
  const pitch = pitchRatio * 60; // Convert to degrees

  // Calculate Roll (head tilt)
  // Roll is based on the angle of the line connecting the eyes
  const eyeDeltaY = rightEye.y - leftEye.y;
  const eyeDeltaX = rightEye.x - leftEye.x;
  const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

  return {
    yaw: Math.round(yaw * 10) / 10,
    pitch: Math.round(pitch * 10) / 10,
    roll: Math.round(roll * 10) / 10,
  };
};

/**
 * Calculates the relative position of the iris within the eye socket.
 * Returns values from -1.0 (Left/Up) to 1.0 (Right/Down), where 0.0 is Center.
 */
export const calculateIrisGaze = (landmarks) => {
    if (!landmarks || landmarks.length < 478) return { x: 0, y: 0 };

    // --- Landmarks Indices (MediaPipe Face Mesh) ---
    // Left Eye
    const L_Iris = landmarks[468];
    const L_Inner = landmarks[33];
    const L_Outer = landmarks[133];
    const L_Top = landmarks[159];
    const L_Bottom = landmarks[145];

    // Right Eye
    const R_Iris = landmarks[473];
    const R_Inner = landmarks[362];
    const R_Outer = landmarks[263];
    const R_Top = landmarks[386];
    const R_Bottom = landmarks[374];

    // Center X of eye
    const l_center_x = (L_Inner.x + L_Outer.x) / 2;
    const r_center_x = (R_Inner.x + R_Outer.x) / 2;

    // Iris X deviation (Positive = Right, Negative = Left)
    const l_dx = L_Iris.x - l_center_x;
    const r_dx = R_Iris.x - r_center_x;

    // Normalize by eye width
    const l_width = Math.abs(L_Outer.x - L_Inner.x);
    const r_width = Math.abs(R_Outer.x - R_Inner.x);

    // 3.5 is a sensitivity factor (eyes move less pixels than head)
    const gazeX = ((l_dx / l_width) + (r_dx / r_width)) * 0.5 * 3.5;

    // --- Vertical Gaze ---
    const l_center_y = (L_Top.y + L_Bottom.y) / 2;
    const r_center_y = (R_Top.y + R_Bottom.y) / 2;

    const l_dy = L_Iris.y - l_center_y;
    const r_dy = R_Iris.y - r_center_y;

    const l_height = Math.abs(L_Top.y - L_Bottom.y);
    const r_height = Math.abs(R_Top.y - R_Bottom.y);

    // Y increases downwards. Positive = Down.
    const gazeY = ((l_dy / l_height) + (r_dy / r_height)) * 0.5 * 3.0;

    return { x: gazeX, y: gazeY };
};

/**
 * Detect mouth movement (talking without audio)
 * Calculates mouth open/close ratio from landmarks
 * 
 * @param {Array} landmarks - Array of normalized face landmarks
 * @returns {Object} - { isMoving, openRatio }
 */
export const detectMouthMovement = (landmarks) => {
  if (!landmarks || landmarks.length < 478) {
    return { isMoving: false, openRatio: 0 };
  }

  // Upper and lower lip landmarks
  const upperLip = landmarks[13]; // Upper lip center
  const lowerLip = landmarks[14]; // Lower lip center
  const leftMouth = landmarks[LANDMARKS.LEFT_MOUTH_CORNER];
  const rightMouth = landmarks[LANDMARKS.RIGHT_MOUTH_CORNER];

  // Calculate mouth dimensions
  const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
  const mouthWidth = Math.abs(leftMouth.x - rightMouth.x);

  // Mouth aspect ratio (height / width)
  const openRatio = mouthHeight / mouthWidth;

  // Threshold for detecting open mouth (typically > 0.3 indicates talking)
  const isMoving = openRatio > 0.3;

  // console.log("mouth movement:");
  // console.log(isMoving, openRatio);

  return {
    isMoving,
    openRatio: Math.round(openRatio * 100) / 100,
  };
};

/**
 * Advanced head pose estimation using Perspective-n-Point (PnP) approximation
 * This is a more accurate but computationally intensive method
 * 
 * @param {Array} landmarks - Array of normalized face landmarks
 * @returns {Object} - { yaw, pitch, roll, confidence }
 */
/**
 * Calculates Yaw, Pitch, and Roll using the 3D geometry of MediaPipe landmarks.
 * * MediaPipe Landmarks used:
 * - 33: Left Eye Inner
 * - 263: Right Eye Inner
 * - 1: Nose Tip
 * - 152: Chin
 * - 234: Left Ear (Tragion)
 * - 454: Right Ear (Tragion)
 */
export const calculateHeadPose = (landmarks) => {
    if (!landmarks || landmarks.length < 478) {
        return { yaw: 0, pitch: 0, roll: 0, confidence: 0 };
    }

    // --- 1. Get Key Landmarks ---
    // We use the ear tragions (234, 454) for Yaw stability,
    // as they are further apart than eyes, reducing jitter.
    const nose = landmarks[1];
    const chin = landmarks[152];
    const leftEar = landmarks[234];
    const rightEar = landmarks[454];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    // --- 2. Calculate Roll (Tilt) ---
    // Angle of the line connecting the eyes in the 2D plane
    const eyeDeltaY = rightEye.y - leftEye.y;
    const eyeDeltaX = rightEye.x - leftEye.x;
    let roll = Math.atan2(eyeDeltaY, eyeDeltaX);

    // --- 3. Calculate Yaw (Left/Right Turn) ---
    // Angle of the line connecting the ears in the X-Z plane.
    // If one ear is "deeper" (larger Z) than the other, the head is turned.
    // MediaPipe Z is normalized by image width (roughly).
    const earDeltaZ = leftEar.z - rightEar.z;
    const earDeltaX = leftEar.x - rightEar.x;
    let yaw = Math.atan2(earDeltaZ, earDeltaX);

    // --- 4. Calculate Pitch (Up/Down Tilt) ---
    // Angle of the line connecting Nose and Chin in the Y-Z plane.
    // Note: We might need to adjust for aspect ratio if the image is non-square,
    // but usually assuming 1:1 for normalized coordinates is "good enough" for gesture detection.
    const faceVerticalDeltaZ = nose.z - chin.z;
    const faceVerticalDeltaY = nose.y - chin.y;
    let pitch = Math.atan2(faceVerticalDeltaZ, faceVerticalDeltaY);

    // --- 5. Conversions and Normalization ---

    // Convert Radians to Degrees
    roll = roll * (180 / Math.PI);
    yaw = yaw * (180 / Math.PI);
    pitch = pitch * (180 / Math.PI);

    // Adjust Pitch Offset
    // The vector from Nose to Chin is naturally slanted even when looking straight.
    // We subtract a "bias" angle to zero it out (roughly -15 to -20 degrees usually).
    const PITCH_OFFSET = -15;
    pitch += PITCH_OFFSET;

    // Simple confidence check (checking if face is too close/far or distorted)
    const confidence = 1.0 - Math.min(Math.abs(landmarks[1].z), 1);

    return {
        yaw: Math.round(yaw),
        pitch: Math.round(pitch),
        roll: Math.round(roll),
        confidence: Number(confidence.toFixed(2))
    };
};

/**
 * Stability filter for events
 * Prevents flickering by requiring consistent detection over multiple frames
 * 
 * @param {string} eventType - Type of event to track
 * @param {boolean} detected - Whether the condition is currently detected
 * @param {Object} stabilityState - Mutable state object tracking frame counts
 * @param {number} threshold - Number of frames required for stability
 * @returns {boolean} - Whether the event should be triggered
 */
export const applyStabilityFilter = (
  eventType,
  detected,
  stabilityState,
  threshold = 15
) => {
  if (!stabilityState[eventType]) {
    stabilityState[eventType] = 0;
  }

  if (detected) {
    stabilityState[eventType]++;
    if (stabilityState[eventType] >= threshold) {
      return true;
    }
  } else {
    stabilityState[eventType] = Math.max(0, stabilityState[eventType] - 2);
  }

  return false;
};

/**
 * Calculate bounding box from face landmarks
 * Useful for visualization and object detection correlation
 * 
 * @param {Array} landmarks - Array of normalized face landmarks
 * @returns {Object} - { x, y, width, height }
 */
export const getFaceBoundingBox = (landmarks) => {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  let minX = 1, minY = 1, maxX = 0, maxY = 0;

  landmarks.forEach(landmark => {
    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};
