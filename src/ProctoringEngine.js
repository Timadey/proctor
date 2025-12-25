/**
 * ProctoringEngine - Core Orchestrator
 * Decoupled architecture with separate modules for each concern
 */

import { VisualDetectionModule } from './modules/VisualDetectionModule.js';
import { AudioMonitoringModule } from './modules/AudioMonitoringModule.js';
import { PatternDetectionModule } from './modules/PatternDetectionModule.js';
import { BrowserTelemetryModule } from './modules/BrowserTelemetryModule.js';
import { EventManager } from './managers/EventManager.js';
import { StateManager } from './managers/StateManager.js';

export class ProctoringEngine {
    static instance = null;

    static getInstance(options = {}) {
        if (!ProctoringEngine.instance) {
            ProctoringEngine.instance = new ProctoringEngine(options);
        } else if (Object.keys(options).length > 0) {
            ProctoringEngine.instance.updateOptions(options);
        }
        return ProctoringEngine.instance;
    }

    constructor(options = {}) {
        this.options = {
            // Module toggles
            enableVisualDetection: true,
            enableAudioMonitoring: true,
            enablePatternDetection: true,
            enableBrowserTelemetry: true,

            // Callbacks
            onEvent: null,
            onStatusChange: null,
            onError: null,
            onBehavioralPattern: null,

            ...options
        };

        // Core components
        this.eventManager = new EventManager({
            onEvent: this.options.onEvent,
            onBehavioralPattern: this.options.onBehavioralPattern
        });

        this.stateManager = new StateManager();

        // Detection modules (initialized later)
        this.visualModule = null;
        this.audioModule = null;
        this.patternModule = null;
        this.telemetryModule = null;

        // Core state
        this.status = 'initializing';
        this.isInitialized = false;
        this.isRunning = false;
        this.sessionStartTime = null;
    }

    /**
     * Initialize all enabled modules
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            this.updateStatus('loading-modules');

            // Initialize Visual Detection Module
            if (this.options.enableVisualDetection) {
                this.visualModule = new VisualDetectionModule({
                    detectionFPS: this.options.detectionFPS || 10,
                    stabilityFrames: this.options.stabilityFrames || 15,
                    gazeThreshold: this.options.gazeThreshold || 20,
                    yawThreshold: this.options.yawThreshold || 25,
                    pitchThreshold: this.options.pitchThreshold || 20,
                    onEvent: (event) => this.handleModuleEvent('visual', event),
                    onStateChange: (state) => this.stateManager.updateVisualState(state)
                });
                await this.visualModule.initialize();
            }

            // Initialize Audio Monitoring Module
            if (this.options.enableAudioMonitoring) {
                this.audioModule = new AudioMonitoringModule({
                    talkingThreshold: this.options.talkingThreshold || -45,
                    whisperThreshold: this.options.whisperThreshold || -55,
                    audioSampleInterval: this.options.audioSampleInterval || 100,
                    onEvent: (event) => this.handleModuleEvent('audio', event),
                    onStateChange: (state) => this.stateManager.updateAudioState(state)
                });
                await this.audioModule.initialize();
            }

            // Initialize Pattern Detection Module
            if (this.options.enablePatternDetection) {
                this.patternModule = new PatternDetectionModule({
                    suspiciousPatternThreshold: this.options.suspiciousPatternThreshold || 3,
                    patternDetectionWindow: this.options.patternDetectionWindow || 10000,
                    onPattern: (pattern) => this.handlePattern(pattern)
                });
                this.patternModule.initialize();
            }

            // Initialize Browser Telemetry Module
            if (this.options.enableBrowserTelemetry) {
                this.telemetryModule = new BrowserTelemetryModule({
                    onEvent: (event) => this.handleModuleEvent('telemetry', event)
                });
                this.telemetryModule.initialize();
            }

            this.isInitialized = true;
            this.updateStatus('ready');
            console.log('✅ ProctoringEngine initialized (decoupled architecture)');

        } catch (err) {
            console.error('❌ Failed to initialize engine:', err);
            this.handleError(err.message);
        }
    }

    /**
     * Start proctoring
     */
    start(videoElement) {
        if (!this.isInitialized) {
            console.warn('⚠️ Engine not initialized yet');
            return;
        }

        this.isRunning = true;
        this.sessionStartTime = Date.now();
        this.stateManager.setSessionStartTime(this.sessionStartTime);

        // Start each module
        if (this.visualModule) {
            this.visualModule.start(videoElement);
        }

        if (this.audioModule) {
            this.audioModule.start();
        }

        if (this.patternModule) {
            this.patternModule.start(this.stateManager);
        }

        if (this.telemetryModule) {
            this.telemetryModule.start();
        }

        console.log('🚀 ProctoringEngine started');
    }

    /**
     * Stop proctoring
     */
    stop() {
        this.isRunning = false;

        // Stop each module
        if (this.visualModule) this.visualModule.stop();
        if (this.audioModule) this.audioModule.stop();
        if (this.patternModule) this.patternModule.stop();
        if (this.telemetryModule) this.telemetryModule.stop();

        console.log('🛑 ProctoringEngine stopped');
    }

    /**
     * Handle events from modules
     */
    handleModuleEvent(source, event) {
        // Add source metadata
        event.source = source;
        event.sessionDuration = Date.now() - this.sessionStartTime;

        // Pass to event manager
        this.eventManager.recordEvent(event);

        // Feed to pattern detection
        if (this.patternModule) {
            this.patternModule.addEvent(event);
        }
    }

    /**
     * Handle detected patterns
     */
    handlePattern(pattern) {
        this.eventManager.recordPattern(pattern);
    }

    /**
     * Update options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };

        // Update module options
        if (this.visualModule && newOptions.detectionFPS) {
            this.visualModule.updateOptions({ detectionFPS: newOptions.detectionFPS });
        }
        if (this.audioModule && newOptions.talkingThreshold) {
            this.audioModule.updateOptions({ talkingThreshold: newOptions.talkingThreshold });
        }
        if (this.patternModule && newOptions.suspiciousPatternThreshold) {
            this.patternModule.updateOptions({
                suspiciousPatternThreshold: newOptions.suspiciousPatternThreshold
            });
        }
    }

    /**
     * Get session summary
     */
    getSessionSummary() {
        return {
            sessionDuration: Date.now() - this.sessionStartTime,
            sessionStartTime: this.sessionStartTime,
            sessionEndTime: Date.now(),

            // Event data
            ...this.eventManager.getSummary(),

            // State data
            visualState: this.stateManager.getVisualState(),
            audioState: this.stateManager.getAudioState(),

            // Patterns
            patterns: this.patternModule ? this.patternModule.getPatternSummary() : {},

            // Suspicious score
            suspiciousScore: this.calculateSuspiciousScore()
        };
    }

    /**
     * Calculate suspicious score
     */
    calculateSuspiciousScore() {
        const summary = this.eventManager.getSummary();
        let score = 0;

        // High severity events
        const highSeverity = summary.eventsBySeverity?.high || 0;
        score += highSeverity * 10;

        // Medium severity
        const mediumSeverity = summary.eventsBySeverity?.medium || 0;
        score += mediumSeverity * 5;

        // Patterns (very suspicious)
        const patternCount = this.patternModule ?
            Object.values(this.patternModule.getPatternSummary()).reduce((a, b) => a + b.count, 0) : 0;
        score += patternCount * 15;

        return Math.min(score, 1000);
    }

    /**
     * Get all logs
     */
    getLogs() {
        return this.eventManager.getAllEvents();
    }

    /**
     * Clear logs
     */
    clearLogs() {
        this.eventManager.clearEvents();
        if (this.patternModule) this.patternModule.clearPatterns();
    }

    /**
     * Update status
     */
    updateStatus(status) {
        this.status = status;
        if (this.options.onStatusChange) {
            this.options.onStatusChange(status);
        }
    }

    /**
     * Handle error
     */
    handleError(msg) {
        this.status = 'error';
        if (this.options.onError) {
            this.options.onError(msg);
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.stop();

        if (this.visualModule) this.visualModule.destroy();
        if (this.audioModule) this.audioModule.destroy();
        if (this.patternModule) this.patternModule.destroy();
        if (this.telemetryModule) this.telemetryModule.destroy();

        console.log('🗑️ ProctoringEngine destroyed');
    }
}