/**
 * Enhanced Audio Monitoring Module
 * Comprehensive audio monitoring with all features from EnhancedProctoringEngine
 * Includes: talking detection, whispering, silence tracking, audio-visual correlation
 */

export class AudioMonitoringModule {
    constructor(options = {}) {
        this.options = {
            talkingThreshold: -40, // More sensitive from EnhancedProctoringEngine
            whisperThreshold: -55,
            audioSampleInterval: 100,
            prolongedTalkingDuration: 1000, // 1 second from EnhancedProctoringEngine
            onEvent: null,
            onStateChange: null,
            ...options
        };

        // Audio context
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.audioMonitorInterval = null;
        this.isSetup = false;

        // Event throttling (per event type)
        this.eventThrottle = {
            lastEmittedAt: Object.create(null),
            intervalMs: 1000 // 1 second
        };

        // State tracking
        this.state = {
            isTalking: false,
            isWhispering: false,
            currentAudioLevel: -100,
            currentFrequencyDb: -100,
            currentRMS: 0,
            audioLevelHistory: [],
            talkingStartTime: null,
            whisperingStartTime: null,
            totalTalkingDuration: 0,
            totalWhisperingDuration: 0,
            silenceDuration: 0,
            lastSoundTime: Date.now(),
            sessionStartTime: Date.now()
        };
    }

    /**
     * Initialize audio context
     */
    async initialize() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                },
                video: false
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.isSetup = true;
            this.state.sessionStartTime = Date.now();
            console.log('✅ AudioMonitoringModule initialized');

        } catch (error) {
            console.warn('⚠️ AudioMonitoringModule not available:', error.message);
            this.isSetup = false;
        }
    }

    /**
     * Start audio monitoring
     */
    start() {
        if (!this.isSetup) {
            console.warn('⚠️ AudioMonitoringModule not initialized');
            return;
        }

        this.audioMonitorInterval = setInterval(() => {
            this.processAudio();
        }, this.options.audioSampleInterval);

        console.log('🎤 Audio monitoring started');
    }

    /**
     * Stop audio monitoring
     */
    stop() {
        if (this.audioMonitorInterval) {
            clearInterval(this.audioMonitorInterval);
            this.audioMonitorInterval = null;
        }
    }

    /**
     * Update options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Process audio (enhanced from EnhancedProctoringEngine)
     */
    processAudio() {
        if (!this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const timeArray = new Uint8Array(this.analyser.fftSize);

        this.analyser.getByteFrequencyData(dataArray);
        this.analyser.getByteTimeDomainData(timeArray);

        // Calculate RMS (Root Mean Square) for better audio detection
        let sum = 0;
        for (let i = 0; i < timeArray.length; i++) {
            const normalized = (timeArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / timeArray.length);
        const decibels = 20 * Math.log10(rms);

        // Calculate average frequency
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const frequencyDb = 20 * Math.log10(average / 255);

        // Update state
        this.state.currentAudioLevel = decibels;
        this.state.currentFrequencyDb = frequencyDb;
        this.state.currentRMS = rms;
        this.state.audioLevelHistory.push({
            decibels,
            frequencyDb,
            average,
            timestamp: Date.now()
        });

        // Keep last 30 samples
        if (this.state.audioLevelHistory.length > 30) {
            this.state.audioLevelHistory.shift();
        }

        const now = Date.now();
        const { talkingThreshold, whisperThreshold, prolongedTalkingDuration } = this.options;

        // Improved talking detection (from EnhancedProctoringEngine)
        const isTalkingByAudio = decibels > talkingThreshold && average > 5;

        // Check for talking
        if (isTalkingByAudio) {
            this.state.lastSoundTime = now;
            this.state.silenceDuration = 0;

            if (!this.state.isTalking) {
                this.state.isTalking = true;
                this.state.talkingStartTime = now;
            }

            const duration = now - this.state.talkingStartTime;
            this.state.totalTalkingDuration += this.options.audioSampleInterval;

            if (duration > prolongedTalkingDuration) {
                this.emitEvent('TALKING_DETECTED', 8, {
                    duration: duration,
                    decibels: decibels.toFixed(2),
                    frequencyDb: frequencyDb.toFixed(2),
                    average: average.toFixed(2),
                    detectionMethod: 'audio',
                    severity: 'high'
                });
            }
        } else {
            // Talking ended
            if (this.state.isTalking && this.state.talkingStartTime) {
                const finalDuration = now - this.state.talkingStartTime;
                if (finalDuration > 500) {
                    this.emitEvent('TALKING_EPISODE', 7, {
                        duration: finalDuration,
                        severity: 'high',
                        detectionMethod: 'audio'
                    });
                }
            }
            this.state.isTalking = false;
            this.state.talkingStartTime = null;
        }

        // Check for whispering
        if (decibels > whisperThreshold && decibels <= talkingThreshold && average > 3) {
            this.state.lastSoundTime = now;
            this.state.silenceDuration = 0;

            if (!this.state.isWhispering) {
                this.state.isWhispering = true;
                this.state.whisperingStartTime = now;
            }

            const duration = now - this.state.whisperingStartTime;
            this.state.totalWhisperingDuration += this.options.audioSampleInterval;

            if (duration > prolongedTalkingDuration) {
                this.emitEvent('WHISPERING_DETECTED', 7, {
                    duration: duration,
                    level: decibels.toFixed(2),
                    frequencyDb: frequencyDb.toFixed(2),
                    severity: 'medium'
                });
            }
        } else {
            this.state.isWhispering = false;
            this.state.whisperingStartTime = null;
        }

        // Track silence duration
        if (decibels <= whisperThreshold) {
            this.state.silenceDuration = now - this.state.lastSoundTime;
        }

        // Emit state change
        this.emitStateChange();
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
     * Emit event with throttling
     */
    emitEvent(type, severity, metadata = {}) {
        if (!this.canEmitEvent(type)) return;

        if (this.options.onEvent) {
            this.options.onEvent({
                event: type,
                lv: severity,
                ts: Date.now(),
                ...metadata
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
     * Get average audio level
     */
    getAverageAudioLevel() {
        if (this.state.audioLevelHistory.length === 0) return -100;
        return this.state.audioLevelHistory.reduce((sum, item) => sum + item.decibels, 0) /
            this.state.audioLevelHistory.length;
    }

    /**
     * Get audio statistics
     */
    getAudioStatistics() {
        const sessionDuration = (Date.now() - this.state.sessionStartTime) / 1000; // seconds

        return {
            sessionDurationSeconds: sessionDuration,
            totalTalkingDuration: this.state.totalTalkingDuration,
            totalWhisperingDuration: this.state.totalWhisperingDuration,
            talkingPercentage: (this.state.totalTalkingDuration / (sessionDuration * 1000)) * 100,
            whisperingPercentage: (this.state.totalWhisperingDuration / (sessionDuration * 1000)) * 100,
            averageAudioLevel: this.getAverageAudioLevel(),
            currentSilenceDuration: this.state.silenceDuration,
            isTalking: this.state.isTalking,
            isWhispering: this.state.isWhispering
        };
    }

    /**
     * Check if currently talking (for audio-visual correlation)
     */
    isTalking() {
        return this.state.isTalking;
    }

    /**
     * Check if currently whispering
     */
    isWhispering() {
        return this.state.isWhispering;
    }

    /**
     * Get talking start time (for audio-visual correlation)
     */
    getTalkingStartTime() {
        return this.state.talkingStartTime;
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.stop();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('🗑️ AudioMonitoringModule destroyed');
    }
}