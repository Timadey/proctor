/**
 * PatternDetectionModule
 * Detects correlated behavioral patterns that indicate cheating
 */

export class PatternDetectionModule {
    constructor(options = {}) {
        this.options = {
            suspiciousPatternThreshold: 3,
            patternDetectionWindow: 10000,
            onPattern: null,
            ...options
        };

        // State manager reference
        this.stateManager = null;

        // Pattern definitions
        this.patterns = {
            // Looking away + talking + mouth moving
            suspiciousTriplePattern: {
                name: 'suspiciousTriplePattern',
                severity: 10,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.currentGazeDirection !== 'center' &&
                        visualState.isMouthMoving &&
                        (audioState.isTalking || audioState.isWhispering)
                    );
                }
            },

            // Looking left + whispering
            lookingLeftWhispering: {
                name: 'lookingLeftWhispering',
                severity: 8,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.currentGazeDirection === 'left' &&
                        audioState.isWhispering
                    );
                }
            },

            // Looking right + whispering
            lookingRightWhispering: {
                name: 'lookingRightWhispering',
                severity: 8,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.currentGazeDirection === 'right' &&
                        audioState.isWhispering
                    );
                }
            },

            // Mouth covered + audio detected
            mouthCoveredWithAudio: {
                name: 'mouthCoveredWithAudio',
                severity: 9,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.isMouthCovered &&
                        (audioState.isTalking || audioState.isWhispering)
                    );
                }
            },

            // Looking away + talking
            lookingAwayAndTalking: {
                name: 'lookingAwayAndTalking',
                severity: 8,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.currentGazeDirection !== 'center' &&
                        audioState.isTalking
                    );
                }
            },

            // Suspicious object + looking away
            objectAndLookingAway: {
                name: 'objectAndLookingAway',
                severity: 9,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.suspiciousObjectDetected &&
                        visualState.currentGazeDirection !== 'center'
                    );
                }
            },

            // Multiple faces + audio
            multipleFacesWithAudio: {
                name: 'multipleFacesWithAudio',
                severity: 10,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.numFaces > 1 &&
                        (audioState.isTalking || audioState.isWhispering)
                    );
                }
            },

            // Head turned + talking
            headTurnedTalking: {
                name: 'headTurnedTalking',
                severity: 8,
                events: [],
                count: 0,
                lastTriggered: 0,
                check: (visualState, audioState) => {
                    return (
                        visualState.currentHeadDirection !== 'center' &&
                        audioState.isTalking
                    );
                }
            }
        };

        // Event history for pattern matching
        this.eventHistory = [];
        this.maxEventHistorySize = 100;

        // Pattern detection interval
        this.patternCheckInterval = null;
        this.isRunning = false;
    }

    /**
     * Initialize module
     */
    initialize() {
        console.log('✅ PatternDetectionModule initialized');
    }

    /**
     * Start pattern detection
     */
    start(stateManager) {
        this.stateManager = stateManager;
        this.isRunning = true;

        // Check patterns every 500ms
        this.patternCheckInterval = setInterval(() => {
            this.checkAllPatterns();
        }, 500);
    }

    /**
     * Stop pattern detection
     */
    stop() {
        this.isRunning = false;
        if (this.patternCheckInterval) {
            clearInterval(this.patternCheckInterval);
            this.patternCheckInterval = null;
        }
    }

    /**
     * Update options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Add event to history
     */
    addEvent(event) {
        this.eventHistory.push(event);

        if (this.eventHistory.length > this.maxEventHistorySize) {
            this.eventHistory.shift();
        }

        // Check for event-based patterns
        this.checkEventPatterns(event);
    }

    /**
     * Check all state-based patterns
     */
    checkAllPatterns() {
        if (!this.stateManager) return;

        const visualState = this.stateManager.getVisualState();
        const audioState = this.stateManager.getAudioState();

        const now = Date.now();

        Object.values(this.patterns).forEach(pattern => {
            // Check if pattern condition is met
            if (pattern.check(visualState, audioState)) {
                // Add to pattern events
                pattern.events.push({
                    timestamp: now,
                    visualState: { ...visualState },
                    audioState: { ...audioState }
                });

                // Remove old events outside detection window
                const windowStart = now - this.options.patternDetectionWindow;
                pattern.events = pattern.events.filter(e => e.timestamp > windowStart);

                // Check if threshold is met
                if (pattern.events.length >= this.options.suspiciousPatternThreshold) {
                    // Avoid spamming - throttle alerts
                    if (now - pattern.lastTriggered > 5000) {
                        pattern.count++;
                        pattern.lastTriggered = now;

                        this.triggerPattern(pattern);
                    }
                }
            } else {
                // Pattern condition not met - clear old events
                const windowStart = now - this.options.patternDetectionWindow;
                pattern.events = pattern.events.filter(e => e.timestamp > windowStart);
            }
        });
    }

    /**
     * Check event-based patterns
     */
    checkEventPatterns(event) {
        const now = Date.now();
        const windowStart = now - this.options.patternDetectionWindow;

        // Get recent events
        const recentEvents = this.eventHistory.filter(e => e.ts > windowStart);

        // Pattern: Repeated tab switches
        const tabSwitches = recentEvents.filter(e => e.event === 'TAB_SWITCHED');
        if (tabSwitches.length >= 3) {
            this.triggerCustomPattern('repeatedTabSwitches', {
                count: tabSwitches.length,
                timestamps: tabSwitches.map(e => e.ts)
            }, 10);
        }

        // Pattern: Rapid eye movements
        const eyeMovements = recentEvents.filter(e => e.event === 'GAZE_AWAY');
        if (eyeMovements.length >= 5) {
            const directions = eyeMovements.map(e => e.direction);
            const uniqueDirections = new Set(directions);
            if (uniqueDirections.size >= 3) {
                this.triggerCustomPattern('abnormalEyeMovement', {
                    count: eyeMovements.length,
                    pattern: 'rapid_scanning'
                }, 7);
            }
        }

        // Pattern: Multiple suspicious objects
        const objectEvents = recentEvents.filter(e => e.event === 'SUSPICIOUS_OBJECT');
        if (objectEvents.length >= 2) {
            this.triggerCustomPattern('multipleObjects', {
                count: objectEvents.length,
                objects: objectEvents.map(e => e.object)
            }, 9);
        }
    }

    /**
     * Trigger pattern alert
     */
    triggerPattern(pattern) {
        if (this.options.onPattern) {
            this.options.onPattern({
                pattern: pattern.name,
                severity: pattern.severity,
                count: pattern.count,
                eventsInWindow: pattern.events.length,
                timestamp: Date.now(),
                recentEvents: pattern.events.slice(-5) // Last 5 events
            });
        }
    }

    /**
     * Trigger custom pattern
     */
    triggerCustomPattern(name, metadata, severity) {
        if (this.options.onPattern) {
            this.options.onPattern({
                pattern: name,
                severity: severity,
                count: 1,
                metadata: metadata,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Get pattern summary
     */
    getPatternSummary() {
        const summary = {};
        Object.entries(this.patterns).forEach(([key, pattern]) => {
            summary[key] = {
                count: pattern.count,
                lastTriggered: pattern.lastTriggered,
                eventsInWindow: pattern.events.length
            };
        });
        return summary;
    }

    /**
     * Clear patterns
     */
    clearPatterns() {
        Object.values(this.patterns).forEach(pattern => {
            pattern.events = [];
            pattern.count = 0;
            pattern.lastTriggered = 0;
        });
        this.eventHistory = [];
    }

    /**
     * Destroy module
     */
    destroy() {
        this.stop();
        console.log('🗑️ PatternDetectionModule destroyed');
    }
}