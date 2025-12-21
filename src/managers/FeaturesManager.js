/**
 * MediaPipe Task Vision Feature Extraction for Exam Proctoring
 * =============================================================
 *
 * Compatible with @mediapipe/tasks-vision (FaceLandmarker & HandLandmarker)
 *
 * Installation:
 * npm install @mediapipe/tasks-vision
 *
 * Key differences from legacy API:
 * - Uses faceLandmarks instead of multiFaceLandmarks
 * - Uses landmarks instead of multiHandLandmarks
 * - Uses handedness instead of multiHandedness
 * - Result structure is slightly different
 */

export class FaceFeaturesExtractor {
    constructor(imageWidth, imageHeight, faceResults, handResults = null) {
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;

        // Task Vision API returns results with different structure
        // faceResults has: { faceLandmarks: [...], faceBlendshapes: [...], facialTransformationMatrixes: [...] }
        // handResults has: { landmarks: [...], worldLandmarks: [...], handedness: [...] }
        this.faceResults = faceResults;
        this.handResults = handResults;

        // MediaPipe Face Mesh landmark indices (same as before - 478 landmarks)
        this.LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 144, 145, 153];
        this.RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 373, 374, 380];

        this.NOSE_TIP_INDEX = 1;
        this.NOSE_BRIDGE_INDEX = 168;
        this.CHIN_INDEX = 152;

        this.MOUTH_LEFT_INDEX = 61;
        this.MOUTH_RIGHT_INDEX = 291;

        this.LEFT_EYE_OUTER = 33;
        this.LEFT_EYE_INNER = 133;
        this.RIGHT_EYE_OUTER = 263;
        this.RIGHT_EYE_INNER = 362;

        // Iris centers (landmarks 468-477 for refined landmarks)
        this.LEFT_IRIS_CENTER = 468;
        this.RIGHT_IRIS_CENTER = 473;

        this.LEFT_TEMPLE = 234;
        this.RIGHT_TEMPLE = 454;
    }

    /**
     * Main extraction function
     */
    extractAllFeatures() {
        const features = this.initializeFeatures();

        // Extract face features from Task Vision results
        if (this.faceResults && this.faceResults.faceLandmarks &&
            this.faceResults.faceLandmarks.length > 0) {
            Object.assign(features, this.extractFaceFeatures());
        }

        // Extract hand features from Task Vision results
        if (this.handResults && this.handResults.landmarks &&
            this.handResults.landmarks.length > 0) {
            Object.assign(features, this.extractHandFeatures());
        }

        return features;
    }

    /**
     * Initialize all features with default values
     */
    initializeFeatures() {
        return {
            face_present: 0,
            no_of_face: 0,
            face_x: 0,
            face_y: 0,
            face_w: 0,
            face_h: 0,
            face_conf: 0,
            left_eye_x: 0,
            left_eye_y: 0,
            right_eye_x: 0,
            right_eye_y: 0,
            nose_tip_x: 0,
            nose_tip_y: 0,
            mouth_x: 0,
            mouth_y: 0,
            head_pose: 'None',
            head_pitch: 0,
            head_yaw: 0,
            head_roll: 0,
            gaze_on_script: 0,
            gaze_direction: 'None',
            gazePoint_x: 0,
            gazePoint_y: 0,
            pupil_left_x: 0,
            pupil_left_y: 0,
            pupil_right_x: 0,
            pupil_right_y: 0,
            hand_count: 0,
            left_hand_x: 0,
            left_hand_y: 0,
            right_hand_x: 0,
            right_hand_y: 0,
            hand_obj_interaction: 0,
            phone_present: 0,
            phone_loc_x: 0,
            phone_loc_y: 0,
            phone_conf: 0,
            timestamp: Date.now()
        };
    }

    /**
     * Extract face features from Task Vision FaceLandmarker results
     */
    extractFaceFeatures() {
        const features = {};

        // Task Vision API: faceLandmarks is an array of face landmark arrays
        const faces = this.faceResults.faceLandmarks;

        features.face_present = faces.length > 0 ? 1 : 0;
        features.no_of_face = faces.length;

        if (faces.length === 0) {
            return features;
        }

        // Use first face
        const landmarks = faces[0]; // Array of {x, y, z} objects

        // Face bounding box
        const bbox = this.calculateFaceBoundingBox(landmarks);
        features.face_x = bbox.x;
        features.face_y = bbox.y;
        features.face_w = bbox.w;
        features.face_h = bbox.h;
        features.face_conf = bbox.confidence;

        // Eye centers
        const leftEyeCenter = this.calculateEyeCenter(landmarks, this.LEFT_EYE_INDICES);
        const rightEyeCenter = this.calculateEyeCenter(landmarks, this.RIGHT_EYE_INDICES);
        features.left_eye_x = leftEyeCenter.x;
        features.left_eye_y = leftEyeCenter.y;
        features.right_eye_x = rightEyeCenter.x;
        features.right_eye_y = rightEyeCenter.y;

        // Nose tip
        const noseTip = this.denormalizeLandmark(landmarks[this.NOSE_TIP_INDEX]);
        features.nose_tip_x = noseTip.x;
        features.nose_tip_y = noseTip.y;

        // Mouth center
        const mouthCenter = this.calculateMouthCenter(landmarks);
        features.mouth_x = mouthCenter.x;
        features.mouth_y = mouthCenter.y;

        // Head pose
        const headPose = this.calculateHeadPose(landmarks);
        features.head_pitch = headPose.pitch;
        features.head_yaw = headPose.yaw;
        features.head_roll = headPose.roll;
        features.head_pose = this.classifyHeadPose(headPose);

        // Pupil/iris positions
        const pupils = this.extractPupilPositions(landmarks);
        features.pupil_left_x = pupils.left.x;
        features.pupil_left_y = pupils.left.y;
        features.pupil_right_x = pupils.right.x;
        features.pupil_right_y = pupils.right.y;

        // Gaze estimation
        const gaze = this.estimateGazeDirection(landmarks, leftEyeCenter, rightEyeCenter,
            pupils, headPose);
        features.gaze_on_script = gaze.onScreen;
        features.gaze_direction = gaze.direction;
        features.gazePoint_x = gaze.pointX;
        features.gazePoint_y = gaze.pointY;

        return features;
    }

    /**
     * Extract hand features from Task Vision HandLandmarker results
     */
    extractHandFeatures() {
        const features = {
            hand_count: 0,
            left_hand_x: 0,
            left_hand_y: 0,
            right_hand_x: 0,
            right_hand_y: 0,
            hand_obj_interaction: 0
        };

        // Task Vision API: landmarks is an array of hand landmark arrays
        const hands = this.handResults.landmarks;
        const handedness = this.handResults.handednesses;

        if (!hands || hands.length === 0) {
            return features;
        }

        features.hand_count = hands.length;

        // Process each detected hand
        for (let i = 0; i < hands.length && i < 2; i++) {
            const handLandmarks = hands[i]; // Array of {x, y, z} objects

            // Task Vision API: handedness[i] is an array of categories
            // Get the label from the first (highest confidence) category
            const handLabel = handedness[i][0].categoryName; // "Left" or "Right"

            // Get wrist position (landmark 0)
            const wrist = this.denormalizeLandmark(handLandmarks[0]);

            // MediaPipe returns hand label from person's perspective
            // Need to mirror for screen coordinates
            if (handLabel === 'Left') {
                // Person's left hand appears on right side of screen
                features.right_hand_x = wrist.x;
                features.right_hand_y = wrist.y;
            } else {
                // Person's right hand appears on left side of screen
                features.left_hand_x = wrist.x;
                features.left_hand_y = wrist.y;
            }
        }

        // Detect suspicious hand-object interactions
        features.hand_obj_interaction = this.detectHandObjectInteraction(hands);

        return features;
    }

    /**
     * Calculate face bounding box
     */
    calculateFaceBoundingBox(landmarks) {
        const xCoords = [];
        const yCoords = [];

        // Use face contour landmarks
        const contourIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

        for (const idx of contourIndices) {
            if (idx < landmarks.length) {
                xCoords.push(landmarks[idx].x * this.imageWidth);
                yCoords.push(landmarks[idx].y * this.imageHeight);
            }
        }

        const xMin = Math.min(...xCoords);
        const xMax = Math.max(...xCoords);
        const yMin = Math.min(...yCoords);
        const yMax = Math.max(...yCoords);

        const width = xMax - xMin;
        const height = yMax - yMin;
        const centerX = (xMin + xMax) / 2;
        const centerY = (yMin + yMax) / 2;

        // Calculate confidence based on face size
        const faceArea = width * height;
        const imageArea = this.imageWidth * this.imageHeight;
        const sizeRatio = faceArea / imageArea;

        let confidence = 100;
        if (sizeRatio < 0.05) {
            confidence = sizeRatio * 2000;
        } else if (sizeRatio > 0.5) {
            confidence = 100 - (sizeRatio - 0.5) * 200;
        }

        return {
            x: Math.round(centerX),
            y: Math.round(centerY),
            w: Math.round(width),
            h: Math.round(height),
            confidence: Math.max(0, Math.min(100, confidence))
        };
    }

    /**
     * Calculate eye center
     */
    calculateEyeCenter(landmarks, eyeIndices) {
        let sumX = 0, sumY = 0;

        for (const idx of eyeIndices) {
            sumX += landmarks[idx].x * this.imageWidth;
            sumY += landmarks[idx].y * this.imageHeight;
        }

        return {
            x: Math.round(sumX / eyeIndices.length),
            y: Math.round(sumY / eyeIndices.length)
        };
    }

    /**
     * Calculate mouth center
     */
    calculateMouthCenter(landmarks) {
        const leftCorner = this.denormalizeLandmark(landmarks[this.MOUTH_LEFT_INDEX]);
        const rightCorner = this.denormalizeLandmark(landmarks[this.MOUTH_RIGHT_INDEX]);

        return {
            x: Math.round((leftCorner.x + rightCorner.x) / 2),
            y: Math.round((leftCorner.y + rightCorner.y) / 2)
        };
    }

    /**
     * Calculate head pose angles
     */
    calculateHeadPose(landmarks) {
        // YAW (left-right rotation)
        const leftTemple = this.denormalizeLandmark(landmarks[this.LEFT_TEMPLE]);
        const rightTemple = this.denormalizeLandmark(landmarks[this.RIGHT_TEMPLE]);
        const noseTip = this.denormalizeLandmark(landmarks[this.NOSE_TIP_INDEX]);

        const faceWidth = Math.abs(rightTemple.x - leftTemple.x);
        const faceCenterX = (leftTemple.x + rightTemple.x) / 2;
        const noseOffsetX = noseTip.x - faceCenterX;

        const yaw = (noseOffsetX / faceWidth) * 1.5;

        // PITCH (up-down rotation)
        const noseBridge = this.denormalizeLandmark(landmarks[this.NOSE_BRIDGE_INDEX]);
        const chin = this.denormalizeLandmark(landmarks[this.CHIN_INDEX]);

        const faceHeight = Math.abs(chin.y - noseBridge.y);
        const leftEye = this.denormalizeLandmark(landmarks[this.LEFT_EYE_OUTER]);
        const rightEye = this.denormalizeLandmark(landmarks[this.RIGHT_EYE_OUTER]);
        const eyeLineY = (leftEye.y + rightEye.y) / 2;
        const noseOffsetY = noseTip.y - eyeLineY;

        const pitch = (noseOffsetY / faceHeight - 0.4) * 2;

        // ROLL (tilt rotation)
        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

        return { pitch, yaw, roll };
    }

    /**
     * Classify head pose into discrete categories
     */
    classifyHeadPose(headPose) {
        const { yaw, pitch } = headPose;

        const YAW_THRESHOLD = 0.25;
        const PITCH_THRESHOLD = 0.20;

        if (Math.abs(yaw) > YAW_THRESHOLD) {
            return yaw > 0 ? 'right' : 'left';
        } else if (Math.abs(pitch) > PITCH_THRESHOLD) {
            return pitch > 0 ? 'down' : 'up';
        } else {
            return 'forward';
        }
    }

    /**
     * Extract pupil/iris positions
     */
    extractPupilPositions(landmarks) {
        // Check if refined iris landmarks are available (478 landmarks)
        if (landmarks.length > 473) {
            const leftIris = this.denormalizeLandmark(landmarks[this.LEFT_IRIS_CENTER]);
            const rightIris = this.denormalizeLandmark(landmarks[this.RIGHT_IRIS_CENTER]);

            return { left: leftIris, right: rightIris };
        } else {
            // Fallback to eye centers
            const leftEye = this.calculateEyeCenter(landmarks, this.LEFT_EYE_INDICES);
            const rightEye = this.calculateEyeCenter(landmarks, this.RIGHT_EYE_INDICES);

            return { left: leftEye, right: rightEye };
        }
    }

    /**
     * Estimate gaze direction
     */
    estimateGazeDirection(landmarks, leftEyeCenter, rightEyeCenter, pupils, headPose) {
        let gazeX = this.imageWidth / 2;
        let gazeY = this.imageHeight / 2;
        let direction = 'center';
        let onScreen = 1;

        // Calculate iris displacement from eye center
        const leftDisplacementX = pupils.left.x - leftEyeCenter.x;
        const leftDisplacementY = pupils.left.y - leftEyeCenter.y;
        const rightDisplacementX = pupils.right.x - rightEyeCenter.x;
        const rightDisplacementY = pupils.right.y - rightEyeCenter.y;

        // Average displacements
        const avgDisplacementX = (leftDisplacementX + rightDisplacementX) / 2;
        const avgDisplacementY = (leftDisplacementY + rightDisplacementY) / 2;

        // Normalize by eye width
        const eyeWidth = Math.abs(rightEyeCenter.x - leftEyeCenter.x) / 2;
        const normalizedX = avgDisplacementX / eyeWidth;
        const normalizedY = avgDisplacementY / eyeWidth;

        // Combine head pose and eye movement
        const gazeYaw = headPose.yaw + normalizedX * 0.5;
        const gazePitch = headPose.pitch + normalizedY * 0.5;

        // Map to screen coordinates
        gazeX = this.imageWidth / 2 + gazeYaw * this.imageWidth * 0.5;
        gazeY = this.imageHeight / 2 + gazePitch * this.imageHeight * 0.5;

        // Determine if looking at screen
        const SCREEN_THRESHOLD = 0.35;

        if (Math.abs(gazeYaw) > SCREEN_THRESHOLD || Math.abs(gazePitch) > SCREEN_THRESHOLD) {
            onScreen = 0;

            const absYaw = Math.abs(gazeYaw);
            const absPitch = Math.abs(gazePitch);

            if (absYaw > absPitch) {
                if (gazeYaw > 0) {
                    direction = gazePitch > 0.15 ? 'bottom_right' :
                        gazePitch < -0.15 ? 'top_right' : 'right';
                } else {
                    direction = gazePitch > 0.15 ? 'bottom_left' :
                        gazePitch < -0.15 ? 'top_left' : 'left';
                }
            } else {
                direction = gazePitch > 0 ? 'down' : 'up';
            }
        } else {
            direction = 'center';
            onScreen = 1;
        }

        return {
            onScreen: onScreen,
            direction: direction,
            pointX: Math.round(Math.max(0, Math.min(this.imageWidth, gazeX))),
            pointY: Math.round(Math.max(0, Math.min(this.imageHeight, gazeY)))
        };
    }

    /**
     * Detect suspicious hand-object interactions
     */
    detectHandObjectInteraction(hands) {
        let suspiciousCount = 0;

        for (const handLandmarks of hands) {
            const wrist = this.denormalizeLandmark(handLandmarks[0]);
            const indexTip = this.denormalizeLandmark(handLandmarks[8]);
            const middleTip = this.denormalizeLandmark(handLandmarks[12]);
            const thumbTip = this.denormalizeLandmark(handLandmarks[4]);

            // Check if hand is in upper region (near face/ear)
            if (wrist.y < this.imageHeight * 0.6) {
                const thumbIndexDist = this.euclideanDistance(thumbTip, indexTip);
                const wristMiddleDist = this.euclideanDistance(wrist, middleTip);

                // Phone holding gesture
                if (thumbIndexDist > wristMiddleDist * 0.3) {
                    suspiciousCount++;
                    continue;
                }

                // Hand near ear
                if (wrist.x < this.imageWidth * 0.3 || wrist.x > this.imageWidth * 0.7) {
                    if (wrist.y < this.imageHeight * 0.4) {
                        suspiciousCount++;
                    }
                }
            }

            // Writing gesture
            if (wrist.y > this.imageHeight * 0.6 &&
                wrist.x > this.imageWidth * 0.3 &&
                wrist.x < this.imageWidth * 0.7) {
                const fingersTogether = this.euclideanDistance(indexTip, thumbTip) < 50;
                if (fingersTogether) {
                    suspiciousCount++;
                }
            }
        }

        return suspiciousCount > 0 ? 1 : 0;
    }

    /**
     * Helper: Denormalize landmark coordinates
     */
    denormalizeLandmark(landmark) {
        return {
            x: Math.round(landmark.x * this.imageWidth),
            y: Math.round(landmark.y * this.imageHeight),
            z: landmark.z ? landmark.z * this.imageWidth : 0
        };
    }

    /**
     * Helper: Calculate Euclidean distance
     */
    euclideanDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Display features for debugging
     */
    displayFeatures(features, containerId = 'features-display') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div style="font-family: monospace; font-size: 12px; padding: 10px; 
                        background: #f5f5f5; border-radius: 5px;">
                <h3 style="margin-top: 0;">Frame Features</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <strong>Face Detection:</strong><br>
                        Faces: ${features.no_of_face}<br>
                        Position: (${features.face_x}, ${features.face_y})<br>
                        Size: ${features.face_w}x${features.face_h}<br>
                        Confidence: ${features.face_conf.toFixed(1)}%
                    </div>
                    <div>
                        <strong>Head Pose:</strong><br>
                        Direction: ${features.head_pose}<br>
                        Yaw: ${(features.head_yaw * 57.3).toFixed(1)}°<br>
                        Pitch: ${(features.head_pitch * 57.3).toFixed(1)}°<br>
                        Roll: ${(features.head_roll * 57.3).toFixed(1)}°
                    </div>
                    <div>
                        <strong>Gaze:</strong><br>
                        Direction: ${features.gaze_direction}<br>
                        On Screen: ${features.gaze_on_script ? 'Yes' : 'No'}<br>
                        Point: (${features.gazePoint_x}, ${features.gazePoint_y})
                    </div>
                    <div>
                        <strong>Hands:</strong><br>
                        Count: ${features.hand_count}<br>
                        Left: (${features.left_hand_x}, ${features.left_hand_y})<br>
                        Right: (${features.right_hand_x}, ${features.right_hand_y})<br>
                        Suspicious: ${features.hand_obj_interaction ? 'Yes' : 'No'}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Validate extracted features
     */
    validateFeatures(features) {
        const errors = [];

        if (features.face_x < 0 || features.face_x > this.imageWidth) {
            errors.push('Face X coordinate out of bounds');
        }
        if (features.face_y < 0 || features.face_y > this.imageHeight) {
            errors.push('Face Y coordinate out of bounds');
        }
        if (Math.abs(features.head_yaw) > Math.PI) {
            errors.push('Head yaw angle out of range');
        }
        if (features.face_conf < 0 || features.face_conf > 100) {
            errors.push('Face confidence out of range');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Export to JSON
     */
    exportToJSON(features) {
        return JSON.stringify(features, null, 2);
    }

    /**
     * Export to CSV row
     */
    exportToCSV(features) {
        const values = [
            features.timestamp, features.face_present, features.no_of_face,
            features.face_x, features.face_y, features.face_w, features.face_h,
            features.face_conf, features.left_eye_x, features.left_eye_y,
            features.right_eye_x, features.right_eye_y, features.nose_tip_x,
            features.nose_tip_y, features.mouth_x, features.mouth_y,
            features.head_pose, features.head_pitch, features.head_yaw,
            features.head_roll, features.gaze_on_script, features.gaze_direction,
            features.gazePoint_x, features.gazePoint_y, features.pupil_left_x,
            features.pupil_left_y, features.pupil_right_x, features.pupil_right_y,
            features.hand_count, features.left_hand_x, features.left_hand_y,
            features.right_hand_x, features.right_hand_y,
            features.hand_obj_interaction, features.phone_present,
            features.phone_loc_x, features.phone_loc_y, features.phone_conf
        ];
        return values.join(',');
    }

    /**
     * Get CSV header
     */
    static getCSVHeader() {
        return [
            'timestamp', 'face_present', 'no_of_face', 'face_x', 'face_y',
            'face_w', 'face_h', 'face_conf', 'left_eye_x', 'left_eye_y',
            'right_eye_x', 'right_eye_y', 'nose_tip_x', 'nose_tip_y',
            'mouth_x', 'mouth_y', 'head_pose', 'head_pitch', 'head_yaw',
            'head_roll', 'gaze_on_script', 'gaze_direction', 'gazePoint_x',
            'gazePoint_y', 'pupil_left_x', 'pupil_left_y', 'pupil_right_x',
            'pupil_right_y', 'hand_count', 'left_hand_x', 'left_hand_y',
            'right_hand_x', 'right_hand_y', 'hand_obj_interaction',
            'phone_present', 'phone_loc_x', 'phone_loc_y', 'phone_conf'
        ].join(',');
    }
}

export default FaceFeaturesExtractor;