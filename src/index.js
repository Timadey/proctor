// Vanilla Engine
export { ProctoringEngine } from './ProctoringEngine.js';

// Utility Functions
export {
  calculateHeadPose,
  calculateIrisGaze,
  detectMouthMovement,
  applyStabilityFilter,
  getFaceBoundingBox,
  LANDMARKS,
} from './headPoseUtils.js';

// WebRTC Utilities
export {
  createPeerConnection,
  createProctoringDataChannel,
  setupStudentPeerConnection,
  setupProctorPeerConnection,
  MockSignalingServer,
  EventBatcher,
  monitorDataChannelStats,
} from './webrtcUtils.js';

// Types and Constants
export const EVENT_TYPES = {
  GAZE_AWAY: 'GAZE_AWAY',
  EYES_OFF_SCREEN: 'EYES_OFF_SCREEN',
  NO_FACE: 'NO_FACE',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  MOUTH_MOVING: 'MOUTH_MOVING',
  SUSPICIOUS_OBJECT: 'SUSPICIOUS_OBJECT',
  TAB_SWITCHED: 'TAB_SWITCHED',
  WINDOW_FOCUS_LOST: 'WINDOW_FOCUS_LOST',
  WINDOW_FOCUS_RESTORED: 'WINDOW_FOCUS_RESTORED',
};

export const SEVERITY_LEVELS = {
  LOW: 1,
  MEDIUM: 5,
  HIGH: 8,
  CRITICAL: 10,
};

// Default Configuration
export const DEFAULT_CONFIG = {
  detectionFPS: 5,
  stabilityFrames: 15,
  gazeThreshold: 20,
  yawThreshold: 25,
  pitchThreshold: 20,
};
