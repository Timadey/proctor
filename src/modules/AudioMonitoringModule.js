/**
 * AudioMonitoringModule
 * Handles audio monitoring: talking, whispering, silence detection
 */

export class AudioMonitoringModule {
    constructor(options = {}) {
        this.options = {
            talkingThreshold: -45,
            whisperThreshold: -55,
            audioSampleInterval: 100,
            prolongedTalkingDuration: 3000,
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

        // State tracking
        this.state = {
            isTalking: false,
            isWhispering: false,
            currentAudioLevel: -100,
            audioLevelHistory: [],
            talkingStartTime: null,
            whisperingStartTime: null,
            totalTalkingDuration: 0,
            totalWhisperingDuration: 0,
            silenceDuration: 0,
            lastSoundTime: Date.now()
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
     * Process audio
     */
    processAudio() {
        if (!this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate RMS
        const rms = Math.sqrt(
            dataArray.reduce((sum, val) => sum + val * val, 0) / dataArray.length
        );
        const decibels = 20 * Math.log10(rms / 255);

        // Update state
        this.state.currentAudioLevel = decibels;
        this.state.audioLevelHistory.push(decibels);
        if (this.state.audioLevelHistory.length > 10) {
            this.state.audioLevelHistory.shift();
        }

        const now = Date.now();
        const { talkingThreshold, whisperThreshold, prolongedTalkingDuration } = this.options;

        // Check for talking
        if (decibels > talkingThreshold) {
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
                    level: decibels,
                    severity: 'high'
                });
                // Reset to avoid spam
                this.state.talkingStartTime = now;
            }
        } else {
            this.state.isTalking = false;
            this.state.talkingStartTime = null;
        }

        // Check for whispering
        if (decibels > whisperThreshold && decibels <= talkingThreshold) {
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
                    level: decibels,
                    severity: 'medium'
                });
                // Reset to avoid spam
                this.state.whisperingStartTime = now;
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
     * Emit event
     */
    emitEvent(type, severity, metadata = {}) {
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
        return this.state.audioLevelHistory.reduce((a, b) => a + b, 0) /
            this.state.audioLevelHistory.length;
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