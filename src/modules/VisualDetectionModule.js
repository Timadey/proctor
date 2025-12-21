/**
 * Enhanced VisualDetectionModule
 * Comprehensive visual detection with all methods from EnhancedAIProctoringClient
 * Includes: gaze tracking, head pose, mouth movement, eye state, hand detection
 */

import { FaceLandmarker, HandLandmarker, ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { modelCache } from '../ModelCache.js';
import { FaceFeaturesExtractor} from "../managers/FeaturesManager.js";

export class VisualDetectionModule {
    static sharedModels = {
        vision: null,
        faceLandmarker: null,
        handLandmarker: null,
        objectDetector: null
    };

    constructor(options = {}) {
        this.options = {
            detectionFPS: 30,
            stabilityFrames: 15,
            gazeThreshold: 20,
            yawThreshold: 20,
            pitchThreshold: 15,
            prolongedGazeAwayDuration: 5000,
            mouthOpenRatioThreshold: 0.15,
            mouthMovementThreshold: 0.008,
            earThreshold: 0.22,
            onEvent: null,
            onStateChange: null,
            ...options
        };

        // MediaPipe models
        this.faceLandmarker = null;
        this.handLandmarker = null;
        this.objectDetector = null;

        // Processing state
        this.videoElement = null;
        this.animationFrameId = null;
        this.lastProcessTime = 0;
        this.isRunning = false;
        this.frameCount = 0;
        this.fps = options.detectionFPS || 30;

        // Event stability tracking
        this.eventStability = {
            gazeCounter: 0,
            multipleFaces: 0,
            noFace: 0,
            mouthMoving: 0,
            objectDetected: 0,
            headTurned: 0,
            eyesOffScreen: 0,
            eyesClosed: 0,
            handNearFace: 0,
            handCoveringFace: 0,
            phoneDetected: 0
        };
        // Event throttling (per event type)
        this.eventThrottle = {
            lastEmittedAt: Object.create(null),
            intervalMs: 1000 // 1 second
        };


        // State tracking
        this.state = {
            // Face tracking
            numFaces: 0,
            lastFaceDetectedTime: Date.now(),
            consecutiveNoFaceFrames: 0,
            personLeftStartTime: null,

            // Gaze tracking
            currentGazeDirection: 'center',
            lastGazeDirection: 'center',
            gazeAwayStartTime: null,
            gazeDirectionDurations: {
                left: 0,
                right: 0,
                down: 0,
                up: 0,
                center: 0
            },
            sustainedLookAwayTriggered: false,

            // Head tracking
            currentHeadDirection: 'center',
            headTurnedStartTime: null,
            headDirectionHistory: [],

            // Mouth tracking
            isMouthMoving: false,
            mouthMovingStartTime: null,
            isTalkingByMouth: false,
            talkingByMouthStartTime: null,
            mouthTalkingDuration: 0,
            mouthOpenHistory: [],
            mouthMovementHistory: [],
            lipDistanceHistory: [],
            jawOpenHistory: [],

            // Eye tracking
            eyeAspectRatioHistory: [],
            eyesClosedStartTime: null,
            blinkCount: 0,
            lastBlinkTime: 0,

            // Hand tracking
            handNearFaceStartTime: null,
            lastHandPositions: { left: null, right: null },
            handMovementHistory: [],

            // Object tracking
            suspiciousObjectDetected: false,
            lastDetectedObject: null,

            // Session info
            sessionStartTime: Date.now(),

            // Landmarks
            faceLandmarks: null,
            handResults: null,
        };
    }

    /**
     * Initialize MediaPipe models
     */
    async initialize() {
        try {
            // Reuse shared vision resolver
            if (!VisualDetectionModule.sharedModels.vision) {
                VisualDetectionModule.sharedModels.vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );
            }
            const vision = VisualDetectionModule.sharedModels.vision;

            // Initialize Face Landmarker with iris tracking
            if (!VisualDetectionModule.sharedModels.faceLandmarker) {
                const modelPath = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
                const modelBuffer = await modelCache.getModel(modelPath);

                VisualDetectionModule.sharedModels.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetBuffer: modelBuffer,
                        delegate: 'GPU',
                    },
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: true,
                    runningMode: 'VIDEO',
                    numFaces: 3,
                    refineFaceLandmarks: true, // Enable iris tracking
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
            }
            this.faceLandmarker = VisualDetectionModule.sharedModels.faceLandmarker;

            // Initialize Hand Landmarker
            if (!VisualDetectionModule.sharedModels.handLandmarker) {
                const modelPath = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
                const modelBuffer = await modelCache.getModel(modelPath);

                VisualDetectionModule.sharedModels.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetBuffer: modelBuffer,
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 2,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
            }
            this.handLandmarker = VisualDetectionModule.sharedModels.handLandmarker;

            // Initialize Object Detector
            if (!VisualDetectionModule.sharedModels.objectDetector) {
                const modelPath = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
                const modelBuffer = await modelCache.getModel(modelPath);

                VisualDetectionModule.sharedModels.objectDetector = await ObjectDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetBuffer: modelBuffer,
                        delegate: 'GPU',
                    },
                    scoreThreshold: 0.4,
                    runningMode: 'VIDEO',
                });
            }
            this.objectDetector = VisualDetectionModule.sharedModels.objectDetector;

            console.log('✅ VisualDetectionModule initialized');
        } catch (err) {
            console.error('❌ VisualDetectionModule initialization failed:', err);
            throw err;
        }
    }

    /**
     * Start detection loop
     */
    start(videoElement) {
        if (!this.faceLandmarker) {
            console.warn('⚠️ VisualDetectionModule not initialized');
            return;
        }

        this.videoElement = videoElement;
        this.isRunning = true;
        this.state.sessionStartTime = Date.now();
        this.animationFrameId = requestAnimationFrame((ts) => this.processLoop(ts));
    }

    /**
     * Stop detection loop
     */
    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Update options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Main processing loop
     */
    processLoop(timestamp) {
        if (!this.isRunning || !this.videoElement || !this.faceLandmarker) return;

        const frameInterval = 1000 / this.options.detectionFPS;
        if (timestamp - this.lastProcessTime >= frameInterval) {
            this.lastProcessTime = timestamp;
            this.processFrame(timestamp);
        }

        this.animationFrameId = requestAnimationFrame((ts) => this.processLoop(ts));
    }

    /**
     * Process single frame
     */
    processFrame(timestamp) {
        if (!this.videoElement || this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
            return;
        }

        try {
            this.frameCount++;
            const now = Date.now();

            // Detect faces
            const faceResults = this.faceLandmarker.detectForVideo(this.videoElement, timestamp);

            // console.log('Face results:', faceResults);
            this.state.faceLandmarks = faceResults;
            const numFaces = faceResults.faceLandmarks?.length || 0;

            this.state.numFaces = numFaces;
            this.analyzeFaceCount(numFaces);

            if (numFaces === 1) {
                const landmarks = faceResults.faceLandmarks[0];
                // Enhanced face analysis
                this.analyzeEnhancedGaze(landmarks);
                this.analyzeHeadPose(landmarks);
                this.analyzeEyeState(landmarks);
                this.analyzeMouthMovement(landmarks);
                this.detectMouthCovering(landmarks);

            } else if (numFaces === 0) {
                this.handleNoFaceDetected();
            }

            // Detect hands
            const handResults = this.handLandmarker.detectForVideo(this.videoElement, timestamp);
            this.state.handResults = handResults;

            if (handResults.landmarks && handResults.landmarks.length > 0 && numFaces === 1) {
                this.analyzeHandActivity(
                    handResults.landmarks[0],
                    handResults.landmarks[1],
                    faceResults.faceLandmarks[0]
                );
            }

            // Detect objects
            this.analyzeObjects(timestamp);

            // Emit state changes
            this.emitStateChange();

        } catch (err) {
            console.error('Frame processing error:', err);
        }
    }

    /**
     * Analyze face count
     */
    analyzeFaceCount(numFaces) {
        const { stabilityFrames } = this.options;
        const now = Date.now();

        if (numFaces === 0) {
            this.eventStability.noFace++;
            this.state.consecutiveNoFaceFrames++;

            if (this.eventStability.noFace >= stabilityFrames) {
                this.emitEvent('NO_FACE', 8, {
                    faces: 0,
                    duration: now - this.state.lastFaceDetectedTime,
                    frames: this.state.consecutiveNoFaceFrames
                });
                this.eventStability.noFace = 0;

                // Extended absence - person left
                if (this.state.consecutiveNoFaceFrames > stabilityFrames * 5) {
                    if (!this.state.personLeftStartTime) {
                        this.state.personLeftStartTime = now;
                    }
                    this.emitEvent('PERSON_LEFT', 10, {
                        duration: now - this.state.personLeftStartTime,
                        severity: 'critical'
                    });
                }
            }
        } else if (numFaces > 1) {
            this.eventStability.multipleFaces++;
            if (this.eventStability.multipleFaces >= stabilityFrames) {
                this.emitEvent('MULTIPLE_FACES', 10, {
                    faces: numFaces,
                    severity: 'critical'
                });
                this.eventStability.multipleFaces = 0;
            }
        } else {
            this.eventStability.noFace = 0;
            this.eventStability.multipleFaces = 0;
            this.state.consecutiveNoFaceFrames = 0;
            this.state.lastFaceDetectedTime = now;
            this.state.personLeftStartTime = null;
        }
    }

    /**
     * Handle no face detected
     */
    handleNoFaceDetected() {
        this.state.isMouthMoving = false;
        this.state.mouthMovingStartTime = null;
        this.state.currentGazeDirection = 'unknown';
        this.state.isTalkingByMouth = false;
    }

    /**
     * Enhanced gaze analysis with iris tracking
     */
    analyzeEnhancedGaze(landmarks) {
        // Left eye landmarks
        const leftEyeInner = landmarks[133];
        const leftEyeOuter = landmarks[33];
        const leftEyeTop = landmarks[159];
        const leftEyeBottom = landmarks[145];

        // Right eye landmarks
        const rightEyeInner = landmarks[362];
        const rightEyeOuter = landmarks[263];
        const rightEyeTop = landmarks[386];
        const rightEyeBottom = landmarks[374];

        // Iris landmarks (available with refineFaceLandmarks)
        const leftIris = landmarks[468]; // Center of left iris
        const rightIris = landmarks[473]; // Center of right iris

        if (!leftIris || !rightIris) return;

        // Calculate horizontal gaze
        const leftGazeX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);
        const rightGazeX = (rightIris.x - rightEyeInner.x) / (rightEyeOuter.x - rightEyeInner.x);
        const avgGazeX = (leftGazeX + rightGazeX) / 2;

        // Calculate vertical gaze
        const leftGazeY = (leftIris.y - leftEyeTop.y) / (leftEyeBottom.y - leftEyeTop.y);
        const rightGazeY = (rightIris.y - rightEyeTop.y) / (rightEyeBottom.y - rightEyeTop.y);
        const avgGazeY = (leftGazeY + rightGazeY) / 2;

        let gazeDirection = 'center';
        let severity = 'medium';

        // Determine gaze direction with stricter thresholds
        if (avgGazeX < 0.35) {
            gazeDirection = 'left';
            severity = avgGazeX < 0.25 ? 'high' : 'medium';
            this.emitEvent('LOOKING_LEFT', 6, {
                direction: 'left',
                gazeX: avgGazeX.toFixed(3),
                severity
            });
        } else if (avgGazeX > 0.65) {
            gazeDirection = 'right';
            severity = avgGazeX > 0.75 ? 'high' : 'medium';
            this.emitEvent('LOOKING_RIGHT', 6, {
                direction: 'right',
                gazeX: avgGazeX.toFixed(3),
                severity
            });
        } else if (avgGazeY > 0.65) {
            gazeDirection = 'down';
            severity = avgGazeY > 0.75 ? 'high' : 'medium';
            this.emitEvent('LOOKING_DOWN', 6, {
                direction: 'down',
                gazeY: avgGazeY.toFixed(3),
                severity
            });
        } else if (avgGazeY < 0.35) {
            gazeDirection = 'up';
            severity = avgGazeY < 0.25 ? 'high' : 'medium';
            this.emitEvent('LOOKING_UP', 6, {
                direction: 'up',
                gazeY: avgGazeY.toFixed(3),
                severity
            });
        }

        // Track gaze duration
        const now = Date.now();
        if (gazeDirection !== this.state.currentGazeDirection) {
            this.state.currentGazeDirection = gazeDirection;
            this.state.gazeAwayStartTime = now;
            this.state.sustainedLookAwayTriggered = false;
        } else if (gazeDirection !== 'center') {
            const duration = now - this.state.gazeAwayStartTime;
            const frameDuration = 1000 / this.fps;
            this.state.gazeDirectionDurations[gazeDirection] += frameDuration;

            // Alert if looking away for more than 3 seconds
            if (duration > 3000) {
                this.emitEvent('LOOKING_AWAY_EXTENDED', 7, {
                    direction: gazeDirection,
                    duration: duration,
                    gazeX: avgGazeX.toFixed(3),
                    gazeY: avgGazeY.toFixed(3),
                    severity: 'high'
                });
            }

            // Sustained look away (5+ seconds)
            if (duration > 5000 && !this.state.sustainedLookAwayTriggered) {
                this.state.sustainedLookAwayTriggered = true;
                this.emitEvent('SUSTAINED_LOOK_AWAY', 9, {
                    direction: gazeDirection,
                    duration: duration,
                    severity: 'critical',
                    note: 'User has been looking away for a sustained period'
                });
            }
        }

        // Update last direction
        this.state.lastGazeDirection = gazeDirection;
    }

    /**
     * Enhanced head pose estimation
     */
    analyzeHeadPose(landmarks) {
        const noseTip = landmarks[1];
        const noseBridge = landmarks[6];
        const forehead = landmarks[10];
        const chin = landmarks[152];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];

        // Calculate horizontal rotation (yaw)
        const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
        const noseCenterOffset = noseTip.x - ((leftCheek.x + rightCheek.x) / 2);
        const yawRatio = Math.abs(noseCenterOffset) / faceWidth;

        // Calculate vertical rotation (pitch)
        const faceHeight = Math.abs(chin.y - forehead.y);
        const noseVerticalOffset = noseTip.y - ((forehead.y + chin.y) / 2);
        const pitchRatio = Math.abs(noseVerticalOffset) / faceHeight;

        // Head turned significantly (yaw)
        if (yawRatio > 0.25) {
            const direction = noseCenterOffset > 0 ? 'right' : 'left';
            const severity = yawRatio > 0.35 ? 'critical' : 'high';
            this.emitEvent('HEAD_TURNED', 7, {
                direction: direction,
                yawRatio: yawRatio.toFixed(3),
                severity: severity
            });
        }

        // Head tilted up/down significantly (pitch)
        if (pitchRatio > 0.15) {
            const direction = noseVerticalOffset > 0 ? 'down' : 'up';
            const severity = pitchRatio > 0.25 ? 'high' : 'medium';
            this.emitEvent('HEAD_TILTED', 7, {
                direction: direction,
                pitchRatio: pitchRatio.toFixed(3),
                severity: severity
            });
        }
    }

    /**
     * Eye state analysis (blink detection, eye closure)
     */
    analyzeEyeState(landmarks) {
        // Calculate Eye Aspect Ratio (EAR) for blink detection
        const leftEyeTop = landmarks[159];
        const leftEyeBottom = landmarks[145];
        const leftEyeLeft = landmarks[133];
        const leftEyeRight = landmarks[33];

        const rightEyeTop = landmarks[386];
        const rightEyeBottom = landmarks[374];
        const rightEyeLeft = landmarks[362];
        const rightEyeRight = landmarks[263];

        // Calculate vertical and horizontal distances
        const leftVertical = this.calculateDistance(leftEyeTop, leftEyeBottom);
        const leftHorizontal = this.calculateDistance(leftEyeLeft, leftEyeRight);
        const leftEAR = leftVertical / leftHorizontal;

        const rightVertical = this.calculateDistance(rightEyeTop, rightEyeBottom);
        const rightHorizontal = this.calculateDistance(rightEyeLeft, rightEyeRight);
        const rightEAR = rightVertical / rightHorizontal;

        const avgEAR = (leftEAR + rightEAR) / 2;
        this.state.eyeAspectRatioHistory.push(avgEAR);

        // Keep last 30 frames
        if (this.state.eyeAspectRatioHistory.length > 30) {
            this.state.eyeAspectRatioHistory.shift();
        }

        // Detect eyes closed (EAR threshold typically around 0.2-0.25)
        const EAR_THRESHOLD = this.options.earThreshold || 0.22;
        const now = Date.now();

        if (avgEAR < EAR_THRESHOLD) {
            if (!this.state.eyesClosedStartTime) {
                this.state.eyesClosedStartTime = now;
            }

            const closedDuration = now - this.state.eyesClosedStartTime;

            // Alert if eyes closed for more than 2 seconds (not just blinking)
            if (closedDuration > 2000) {
                this.emitEvent('EYES_CLOSED', 7, {
                    duration: closedDuration,
                    ear: avgEAR.toFixed(3),
                    severity: 'high'
                });
            }
        } else {
            // Eyes opened
            if (this.state.eyesClosedStartTime) {
                const closedDuration = now - this.state.eyesClosedStartTime;

                // Detect blink (closed for 100-400ms)
                if (closedDuration > 100 && closedDuration < 400) {
                    this.state.blinkCount++;
                    this.state.lastBlinkTime = now;
                }

                this.state.eyesClosedStartTime = null;
            }
        }

        // Analyze blink rate
        const sessionDuration = (now - this.state.sessionStartTime) / 1000 / 60; // minutes

        if (sessionDuration > 1 && this.state.currentGazeDirection !== 'center') {
            const blinksPerMinute = this.state.blinkCount / sessionDuration;

            // // Abnormally low blink rate while looking away
            // if (blinksPerMinute < 8) {
            //     this.emitEvent('ABNORMAL_BLINK_RATE', 7, {
            //         blinksPerMinute: blinksPerMinute.toFixed(1),
            //         gazeDirection: this.state.currentGazeDirection,
            //         severity: 'high',
            //         note: 'Unusually low blink rate while looking away'
            //     });
            // }

            // No blink detection while looking away (suggests focused reading)
            const timeSinceLastBlink = now - this.state.lastBlinkTime;
            if (timeSinceLastBlink > 10000) { // 10 seconds without blinking
                this.emitEvent('SUSPICIOUS_GAZE_READING', 8, {
                    durationSinceBlink: timeSinceLastBlink,
                    direction: this.state.currentGazeDirection,
                    severity: 'critical',
                    note: 'Focused reading detected while looking away (no blinks for 10s+)'
                });
            }
        }
    }

    /**
     * Comprehensive mouth movement analysis
     */
    analyzeMouthMovement(landmarks) {
        // Upper and lower lip landmarks
        const upperLipTop = landmarks[13];
        const lowerLipBottom = landmarks[14];
        const upperLipCenter = landmarks[0];
        const lowerLipCenter = landmarks[17];

        // Mouth corners
        const leftMouthCorner = landmarks[61];
        const rightMouthCorner = landmarks[291];

        // Inner lips
        const upperInnerLip = landmarks[13];
        const lowerInnerLip = landmarks[14];

        // Calculate mouth openness (vertical distance)
        const mouthOpenness = this.calculateDistance(upperLipTop, lowerLipBottom);

        // Calculate mouth width (horizontal distance)
        const mouthWidth = this.calculateDistance(leftMouthCorner, rightMouthCorner);

        // Calculate lip distance (inner lips)
        const lipDistance = this.calculateDistance(upperInnerLip, lowerInnerLip);

        // Calculate mouth aspect ratio
        const mouthAspectRatio = mouthOpenness / mouthWidth;

        // Store history
        this.state.mouthOpenHistory.push(mouthOpenness);
        this.state.lipDistanceHistory.push(lipDistance);

        if (this.state.mouthOpenHistory.length > 30) {
            this.state.mouthOpenHistory.shift();
            this.state.lipDistanceHistory.shift();
        }

        // Calculate mouth movement (variance in recent frames)
        if (this.state.mouthOpenHistory.length >= 10) {
            const recentMouth = this.state.mouthOpenHistory.slice(-10);
            const mouthVariance = this.calculateVariance(recentMouth);
            const mouthMovement = Math.sqrt(mouthVariance);

            this.state.mouthMovementHistory.push(mouthMovement);
            if (this.state.mouthMovementHistory.length > 30) {
                this.state.mouthMovementHistory.shift();
            }

            // Detect talking based on mouth movement patterns
            const MOVEMENT_THRESHOLD = this.options.mouthMovementThreshold || 0.008;
            const OPENNESS_THRESHOLD = 0.015;

            const isMouthMoving = mouthMovement > MOVEMENT_THRESHOLD;
            const isMouthOpen = mouthOpenness > OPENNESS_THRESHOLD;

            const now = Date.now();

            // Talking is detected when mouth is both moving and open
            if (isMouthMoving && isMouthOpen) {
                if (!this.state.talkingByMouthStartTime) {
                    this.state.talkingByMouthStartTime = now;
                    this.state.isTalkingByMouth = true;
                }

                const talkingDuration = now - this.state.talkingByMouthStartTime;
                this.state.mouthTalkingDuration += 1000 / this.fps;

                // Alert if talking detected by mouth movement for more than 3 second
                if (talkingDuration > 3000) {
                    this.emitEvent('TALKING_DETECTED', 8, {
                        duration: talkingDuration,
                        mouthOpenness: mouthOpenness.toFixed(4),
                        mouthMovement: mouthMovement.toFixed(4),
                        mouthAspectRatio: mouthAspectRatio.toFixed(3),
                        detectionMethod: 'visual',
                        severity: 'high'
                    });
                }
            } else {
                if (this.state.talkingByMouthStartTime) {
                    const finalDuration = now - this.state.talkingByMouthStartTime;
                    if (finalDuration > 500) {
                        // Log talking episode
                        this.emitEvent('TALKING_EPISODE', 7, {
                            duration: finalDuration,
                            severity: 'high',
                            detectionMethod: 'visual'
                        });
                    }
                }
                this.state.talkingByMouthStartTime = null;
                this.state.isTalkingByMouth = false;
            }

            // // Also detect general mouth movement (could be mouthing words)
            // if (mouthMovement > MOVEMENT_THRESHOLD * 0.5) {
            //     this.emitEvent('MOUTH_MOVEMENT', 5, {
            //         movement: mouthMovement.toFixed(4),
            //         openness: mouthOpenness.toFixed(4),
            //         severity: 'medium'
            //     });
            // }
        }
    }

    /**
     * Detect mouth covering or obscuring
     */
    detectMouthCovering(landmarks) {
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const leftMouth = landmarks[61];
        const rightMouth = landmarks[291];

        const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
        const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);

        // Check for visibility if available
        if (upperLip.visibility !== undefined && lowerLip.visibility !== undefined) {
            const avgVisibility = (upperLip.visibility + lowerLip.visibility) / 2;
            if (avgVisibility < 0.3) {
                this.emitEvent('MOUTH_OBSCURED', 6, {
                    visibility: avgVisibility.toFixed(3),
                    severity: 'high'
                });
            }
        }
    }

    /**
     * Analyze hand activity
     */
    analyzeHandActivity(leftHand, rightHand, faceLandmarks) {
        const now = Date.now();

        let handNearFace = false;
        let handCoveringFace = false;

        // Analyze left hand
        if (leftHand && leftHand.length > 0) {
            const handAnalysis = this.analyzeHandProximity(leftHand, faceLandmarks, 'left');
            if (handAnalysis.nearFace) handNearFace = true;
            if (handAnalysis.covering) handCoveringFace = true;
        }

        // Analyze right hand
        if (rightHand && rightHand.length > 0) {
            const handAnalysis = this.analyzeHandProximity(rightHand, faceLandmarks, 'right');
            if (handAnalysis.nearFace) handNearFace = true;
            if (handAnalysis.covering) handCoveringFace = true;
        }

        // Record alerts
        if (handCoveringFace) {
            this.emitEvent('HAND_COVERING_FACE', 9, {
                timestamp: now,
                severity: 'critical'
            });
        } else if (handNearFace) {
            if (!this.state.handNearFaceStartTime) {
                this.state.handNearFaceStartTime = now;
            }

            const duration = now - this.state.handNearFaceStartTime;
            if (duration > 2000) { // Hand near face for 2+ seconds
                this.emitEvent('HAND_NEAR_FACE', 7, {
                    duration: duration,
                    severity: 'medium'
                });
            }
        } else {
            this.state.handNearFaceStartTime = null;
        }

        // Detect suspicious gestures (phone-holding gesture)
        this.detectPhoneGesture(leftHand, rightHand, faceLandmarks);

        // Store hand positions for movement tracking
        this.state.lastHandPositions = {
            left: leftHand,
            right: rightHand
        };
    }

    /**
     * Analyze hand proximity to face
     */
    analyzeHandProximity(hand, faceLandmarks, handSide) {
        // Get face boundaries
        const faceBounds = this.getFaceBounds(faceLandmarks);

        // Key hand landmarks
        const wrist = hand[0];
        const indexTip = hand[8];
        const middleTip = hand[12];
        const ringTip = hand[16];
        const pinkyTip = hand[20];
        const thumbTip = hand[4];
        const palm = hand[9]; // Middle of palm

        let nearFace = false;
        let covering = false;

        // Check if any hand part is near face
        const handPoints = [wrist, indexTip, middleTip, ringTip, pinkyTip, thumbTip, palm];

        for (const point of handPoints) {
            const distanceToFace = this.calculateDistance(point, faceBounds.center);

            // Near face threshold
            if (distanceToFace < 0.15) {
                nearFace = true;
            }

            // Covering face threshold (very close)
            if (distanceToFace < 0.08) {
                covering = true;
            }
        }

        return { nearFace, covering };
    }

    /**
     * Detect phone gesture
     */
    detectPhoneGesture(leftHand, rightHand, faceLandmarks) {
        const checkPhonePose = (hand, handSide) => {
            if (!hand || hand.length < 21) return false;

            const wrist = hand[0];
            const indexTip = hand[8];
            const pinkyTip = hand[20];
            const thumbTip = hand[4];
            const palm = hand[9];

            // Check if hand is near ear
            const leftEar = faceLandmarks[234];
            const rightEar = faceLandmarks[454];
            const ear = handSide === 'left' ? leftEar : rightEar;

            const distanceToEar = this.calculateDistance(palm, ear);

            // Check finger extension (phone holding has extended fingers)
            const fingerSpread = this.calculateDistance(indexTip, pinkyTip);

            // Phone gesture: hand near ear, fingers extended
            if (distanceToEar < 0.12 && fingerSpread > 0.08) {
                return true;
            }

            return false;
        };

        const leftPhone = leftHand ? checkPhonePose(leftHand, 'left') : false;
        const rightPhone = rightHand ? checkPhonePose(rightHand, 'right') : false;

        if (leftPhone || rightPhone) {
            this.emitEvent('PHONE_DETECTED', 10, {
                hand: leftPhone ? 'left' : 'right',
                severity: 'critical',
                note: 'Hand pose suggests phone usage'
            });
        }
    }

    /**
     * Get face bounds
     */
    getFaceBounds(landmarks) {
        const xs = landmarks.map(lm => lm.x);
        const ys = landmarks.map(lm => lm.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            center: {
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2
            },
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    /**
     * Analyze objects
     */
    analyzeObjects(timestamp) {
        if (!this.objectDetector) return;

        const { stabilityFrames } = this.options;
        const results = this.objectDetector.detectForVideo(this.videoElement, timestamp);

        if (results.detections && results.detections.length > 0) {
            const suspicious = results.detections.filter(det => {
                const label = det.categories[0]?.categoryName?.toLowerCase() || '';
                return label.includes('cell phone') ||
                    label.includes('book') ||
                    label.includes('laptop') ||
                    label.includes('tablet') ||
                    label.includes('mouse') ||
                    label.includes('keyboard');
            });

            if (suspicious.length > 0) {
                this.eventStability.objectDetected++;
                this.state.suspiciousObjectDetected = true;
                this.state.lastDetectedObject = suspicious[0].categories[0].categoryName;

                if (this.eventStability.objectDetected >= stabilityFrames) {
                    this.emitEvent('SUSPICIOUS_OBJECT', 9, {
                        object: suspicious[0].categories[0].categoryName,
                        confidence: suspicious[0].categories[0].score,
                        severity: 'high'
                    });
                    this.eventStability.objectDetected = 0;
                }
            } else {
                this.eventStability.objectDetected = 0;
                this.state.suspiciousObjectDetected = false;
            }
        }
    }

    /**
     * Helper: Calculate distance between two points
     */
    calculateDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = (point1.z && point2.z) ? point1.z - point2.z : 0;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Helper: Calculate variance
     */
    calculateVariance(arr) {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        return arr.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / arr.length;
    }

    /**
     * Check if an event can be emitted based on throttle rules
     */
    canEmitEvent(eventType) {
        const now = Date.now();
        const last = this.eventThrottle.lastEmittedAt[eventType] || 0;

        if (now - last < this.eventThrottle.intervalMs) {
            return false;
        }

        this.eventThrottle.lastEmittedAt[eventType] = now;
        return true;
    }


    /**
     * Emit event
     */
    emitEvent(type, severity, metadata = {}) {
        if (!this.canEmitEvent(type)) return;
        const featuresExtractor = new FaceFeaturesExtractor(
            this.videoElement.videoWidth, this.videoElement.videoHeight, this.state.faceLandmarks, this.state.handResults
        );
        if (this.options.onEvent) {
            this.options.onEvent({
                event: type,
                lv: severity,
                ts: Date.now(),
                frameNumber: this.frameCount,
                ...metadata,
                extractedFeatures: featuresExtractor.extractAllFeatures()
            });
        }
    }



    /**
     * Emit state change
     */
    emitStateChange() {
        if (this.options.onStateChange) {
            this.options.onStateChange({ ...this.state });
        }
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get detailed statistics
     */
    getDetailedStatistics() {
        const sessionDuration = (Date.now() - this.state.sessionStartTime) / 1000; // seconds

        return {
            sessionDurationSeconds: sessionDuration,
            framesProcessed: this.frameCount,
            averageFps: this.frameCount / sessionDuration,
            blinkRate: (this.state.blinkCount / sessionDuration) * 60, // blinks per minute
            gazeAwayPercentage: {
                left: (this.state.gazeDirectionDurations.left / (sessionDuration * 1000)) * 100,
                right: (this.state.gazeDirectionDurations.right / (sessionDuration * 1000)) * 100,
                down: (this.state.gazeDirectionDurations.down / (sessionDuration * 1000)) * 100,
                up: (this.state.gazeDirectionDurations.up / (sessionDuration * 1000)) * 100,
                center: (this.state.gazeDirectionDurations.center / (sessionDuration * 1000)) * 100
            },
            talkingPercentage: {
                visual: (this.state.mouthTalkingDuration / (sessionDuration * 1000)) * 100
            }
        };
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.stop();
        console.log('🗑️ VisualDetectionModule destroyed');
    }
}