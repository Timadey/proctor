/**
 * StateManager
 * Centralized state management for all proctoring modules
 */

export class StateManager {
    constructor() {
        // Visual state
        this.visualState = {
            numFaces: 0,
            currentGazeDirection: 'center',
            lastGazeDirection: 'center',
            gazeDirectionDurations: {
                left: 0,
                right: 0,
                down: 0,
                up: 0,
                center: 0
            },
            currentHeadDirection: 'center',
            isMouthMoving: false,
            isMouthCovered: false,
            suspiciousObjectDetected: false,
            lastDetectedObject: null,
            consecutiveNoFaceFrames: 0
        };

        // Audio state
        this.audioState = {
            isTalking: false,
            isWhispering: false,
            currentAudioLevel: -100,
            audioLevelHistory: [],
            totalTalkingDuration: 0,
            totalWhisperingDuration: 0,
            silenceDuration: 0
        };

        // Session state
        this.sessionState = {
            sessionStartTime: null,
            isActive: false,
            isPaused: false
        };

        // Subscribers
        this.subscribers = [];
    }

    /**
     * Set session start time
     */
    setSessionStartTime(time) {
        this.sessionState.sessionStartTime = time;
        this.sessionState.isActive = true;
        this.notifySubscribers();
    }

    /**
     * Update visual state
     */
    updateVisualState(newState) {
        this.visualState = {
            ...this.visualState,
            ...newState
        };
        this.notifySubscribers();
    }

    /**
     * Update audio state
     */
    updateAudioState(newState) {
        this.audioState = {
            ...this.audioState,
            ...newState
        };
        this.notifySubscribers();
    }

    /**
     * Update session state
     */
    updateSessionState(newState) {
        this.sessionState = {
            ...this.sessionState,
            ...newState
        };
        this.notifySubscribers();
    }

    /**
     * Get visual state
     */
    getVisualState() {
        return { ...this.visualState };
    }

    /**
     * Get audio state
     */
    getAudioState() {
        return { ...this.audioState };
    }

    /**
     * Get session state
     */
    getSessionState() {
        return { ...this.sessionState };
    }

    /**
     * Get complete state
     */
    getCompleteState() {
        return {
            visual: this.getVisualState(),
            audio: this.getAudioState(),
            session: this.getSessionState(),
            timestamp: Date.now()
        };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.subscribers.push(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all subscribers
     */
    notifySubscribers() {
        const state = this.getCompleteState();
        this.subscribers.forEach(callback => {
            try {
                callback(state);
            } catch (err) {
                console.error('Error in state subscriber:', err);
            }
        });
    }

    /**
     * Reset state
     */
    reset() {
        this.visualState = {
            numFaces: 0,
            currentGazeDirection: 'center',
            lastGazeDirection: 'center',
            gazeDirectionDurations: {
                left: 0,
                right: 0,
                down: 0,
                up: 0,
                center: 0
            },
            currentHeadDirection: 'center',
            isMouthMoving: false,
            isMouthCovered: false,
            suspiciousObjectDetected: false,
            lastDetectedObject: null,
            consecutiveNoFaceFrames: 0
        };

        this.audioState = {
            isTalking: false,
            isWhispering: false,
            currentAudioLevel: -100,
            audioLevelHistory: [],
            totalTalkingDuration: 0,
            totalWhisperingDuration: 0,
            silenceDuration: 0
        };

        this.sessionState = {
            sessionStartTime: null,
            isActive: false,
            isPaused: false
        };

        this.notifySubscribers();
    }

    /**
     * Pause session
     */
    pause() {
        this.sessionState.isPaused = true;
        this.notifySubscribers();
    }

    /**
     * Resume session
     */
    resume() {
        this.sessionState.isPaused = false;
        this.notifySubscribers();
    }

    /**
     * Get session duration
     */
    getSessionDuration() {
        if (!this.sessionState.sessionStartTime) return 0;
        return Date.now() - this.sessionState.sessionStartTime;
    }

    /**
     * Export state as JSON
     */
    exportState() {
        return {
            ...this.getCompleteState(),
            sessionDuration: this.getSessionDuration()
        };
    }
}