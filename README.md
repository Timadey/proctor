# 🎓 AI Proctoring Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Powered-green.svg)](https://mediapipe.dev/)

A comprehensive, modular, and production-ready AI-powered exam proctoring system with advanced behavioral pattern detection. Built with a decoupled architecture for maximum flexibility and extensibility.

## 🌟 Features

### Visual Monitoring
- ✅ **Face Detection** - Detect no face, single face, or multiple faces
- ✅ **Gaze Tracking** - Iris-based eye tracking to detect looking away
- ✅ **Head Pose Estimation** - Track head rotation (yaw, pitch, roll)
- ✅ **Mouth Movement Detection** - Detect talking and whispering
- ✅ **Mouth Covering Detection** - Identify attempts to hide mouth
- ✅ **Suspicious Object Detection** - Detect phones, books, laptops, tablets

### Audio Monitoring
- ✅ **Talking Detection** - Identify normal speech above threshold
- ✅ **Whispering Detection** - Detect subtle audio below talking threshold
- ✅ **Audio Level Tracking** - Continuous audio level monitoring
- ✅ **Silence Detection** - Track periods of silence
- ✅ **Duration Tracking** - Measure total talking/whispering time

### Behavioral Pattern Detection
- ✅ **Multi-Modal Analysis** - Correlate visual + audio events
- ✅ **Time-Windowed Patterns** - Detect patterns within configurable windows
- ✅ **Suspicious Correlations** - Identify cheating behaviors:
    - Looking away + talking + mouth moving
    - Looking left/right + whispering
    - Mouth covered + audio detected
    - Suspicious object + looking away
    - Multiple faces + audio detected
    - Rapid eye movements (reading notes)
    - Repeated tab switches

### Browser Telemetry
- ✅ **Tab Switch Detection** - Monitor when student leaves exam tab
- ✅ **Focus Tracking** - Detect window focus loss/gain
- ✅ **Clipboard Monitoring** - Track copy/paste/cut attempts
- ✅ **Key Press Detection** - Identify suspicious keyboard shortcuts
- ✅ **Fullscreen Monitoring** - Detect fullscreen exit
- ✅ **Mouse Tracking** - Monitor mouse leaving window

### Architecture
- ✅ **Modular Design** - Independent, swappable modules
- ✅ **Event-Driven** - Reactive architecture with event system
- ✅ **State Management** - Centralized state with subscription system
- ✅ **Configurable** - Extensive configuration options
- ✅ **Extensible** - Easy to add custom patterns and modules
- ✅ **Model Cache** - Models are cached for faster loading

## 📦 Installation

```bash
npm install @timadey/proctor
```

Or with yarn:

```bash
yarn add @timadey/proctor
```

## 🚀 Quick Start

```javascript
import { ProctoringEngine } from '@timadey/proctor';

// 1. Initialize the engine
const engine = ProctoringEngine.getInstance({
    // Enable/disable modules
    enableVisualDetection: true,
    enableAudioMonitoring: true,
    enablePatternDetection: true,
    enableBrowserTelemetry: true,
    
    // Callbacks
    onEvent: (event) => {
        console.log('Proctoring event:', event);
        // Send to your backend
    },
    
    onBehavioralPattern: (pattern) => {
        console.warn('Suspicious pattern detected:', pattern);
        // Alert supervisor
    }
});

// 2. Initialize modules
await engine.initialize();

// 3. Start proctoring
const videoElement = document.getElementById('webcam');
engine.start(videoElement);

// 4. Get session summary anytime
const summary = engine.getSessionSummary();
console.log('Suspicious score:', summary.suspiciousScore);

// 5. Stop when exam ends
engine.stop();
```

## 📚 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Modules](#-modules)
- [Configuration](#-configuration)
- [Events](#-events)
- [Patterns](#-behavioral-patterns)
- [API Reference](#-api-reference)
- [Examples](#-examples)
- [Browser Support](#-browser-support)
- [Performance](#-performance)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

## 🏗️ Architecture

The system uses a **decoupled, modular architecture** where each component operates independently:

```
┌────────────────────────────────────────┐
│      ProctoringEngine (Orchestrator)    │
│  ┌─────────────┐  ┌──────────────┐    │
│  │EventManager │  │StateManager  │    │
│  └─────────────┘  └──────────────┘    │
└────────────┬───────────────────────────┘
             │
    ┌────────┼────────┬────────┐
    ▼        ▼        ▼        ▼
┌────────┐ ┌────┐ ┌────┐ ┌────────┐
│Visual  │ │Audio│ │Pat │ │Browser │
│Module  │ │Mod  │ │Mod │ │Telemetry│
└────────┘ └────┘ └────┘ └────────┘
```

### Core Components

1. **ProctoringEngine** - Main orchestrator coordinating all modules
2. **VisualDetectionModule** - Computer vision and face tracking
3. **AudioMonitoringModule** - Audio analysis and detection
4. **PatternDetectionModule** - Behavioral pattern recognition
5. **BrowserTelemetryModule** - Browser interaction monitoring
6. **EventManager** - Centralized event handling and logging
7. **StateManager** - Application state management

## 🧩 Modules

### VisualDetectionModule

Handles all computer vision tasks using MediaPipe.

```javascript
// Access directly if needed
const visualState = engine.visualModule.getState();
console.log('Current gaze:', visualState.currentGazeDirection);
console.log('Number of faces:', visualState.numFaces);
console.log('Mouth moving:', visualState.isMouthMoving);
console.log('Object detected:', visualState.suspiciousObjectDetected);
```

**Features:**
- Face landmarking with 468 facial points
- Real-time gaze direction (left, right, up, down, center)
- Head pose angles (yaw, pitch, roll)
- Mouth aspect ratio for speech detection
- Object detection for unauthorized materials

### AudioMonitoringModule

Monitors audio using Web Audio API.

```javascript
// Access audio state
const audioState = engine.audioModule.getState();
console.log('Is talking:', audioState.isTalking);
console.log('Is whispering:', audioState.isWhispering);
console.log('Audio level:', audioState.currentAudioLevel, 'dB');
console.log('Total talking time:', audioState.totalTalkingDuration, 'ms');
```

**Features:**
- RMS (Root Mean Square) audio level calculation
- Talking detection (configurable threshold)
- Whispering detection (lower threshold)
- Audio level history tracking
- Silence duration tracking

### PatternDetectionModule

Detects suspicious behavioral patterns through correlation.

```javascript
// Get pattern summary
const patterns = engine.patternModule.getPatternSummary();
console.log('Suspicious patterns detected:', patterns);
```

**Detected Patterns:**
- `suspiciousTriplePattern` - Looking away + talking + mouth moving
- `lookingLeftWhispering` - Looking left while whispering
- `lookingRightWhispering` - Looking right while whispering
- `mouthCoveredWithAudio` - Mouth covered while audio detected
- `lookingAwayAndTalking` - Looking away while talking
- `objectAndLookingAway` - Suspicious object + looking away
- `multipleFacesWithAudio` - Multiple people + audio
- `headTurnedTalking` - Head turned + talking

### BrowserTelemetryModule

Monitors all browser interactions.

```javascript
// Get telemetry summary
const telemetry = engine.telemetryModule.getSummary();
console.log('Tab switches:', telemetry.tabSwitches);
console.log('Copy attempts:', telemetry.copyAttempts);
console.log('Paste attempts:', telemetry.pasteAttempts);
```

**Monitored Actions:**
- Tab visibility changes
- Window focus/blur events
- Copy/paste/cut operations
- Suspicious keyboard shortcuts (F12, Ctrl+C, etc.)
- Fullscreen changes
- Right-click attempts
- Mouse leaving window

## ⚙️ Configuration

### Complete Configuration Example

```javascript
const engine = ProctoringEngine.getInstance({
    // ===== Module Toggles =====
    enableVisualDetection: true,
    enableAudioMonitoring: true,
    enablePatternDetection: true,
    enableBrowserTelemetry: true,
    
    // ===== Visual Detection Options =====
    detectionFPS: 10,                     // Frame processing rate (5-30)
    stabilityFrames: 15,                  // Frames before event triggers
    gazeThreshold: 20,                    // Degrees for gaze deviation
    yawThreshold: 25,                     // Degrees for head rotation
    pitchThreshold: 20,                   // Degrees for head tilt
    prolongedGazeAwayDuration: 5000,      // ms for prolonged gaze
    mouthOpenRatioThreshold: 0.15,        // Mouth aspect ratio threshold
    
    // ===== Audio Monitoring Options =====
    talkingThreshold: -45,                // dB for talking detection
    whisperThreshold: -55,                // dB for whisper detection
    audioSampleInterval: 100,             // Audio check interval (ms)
    prolongedTalkingDuration: 3000,       // ms for prolonged talking
    
    // ===== Pattern Detection Options =====
    suspiciousPatternThreshold: 3,        // Events to trigger pattern
    patternDetectionWindow: 10000,        // Time window (ms)
    
    // ===== Callbacks =====
    onEvent: (event) => {
        // Handle individual events
        console.log('Event:', event);
    },
    
    onBehavioralPattern: (pattern) => {
        // Handle detected patterns (critical)
        console.warn('Pattern:', pattern);
    },
    
    onStatusChange: (status) => {
        // Engine status: 'initializing', 'loading-models', 'ready', 'error'
        console.log('Status:', status);
    },
    
    onError: (error) => {
        // Handle errors
        console.error('Error:', error);
    }
});
```

### Selective Module Configuration

```javascript
// Lightweight mode - only browser telemetry
const lightEngine = ProctoringEngine.getInstance({
    enableVisualDetection: false,
    enableAudioMonitoring: false,
    enablePatternDetection: false,
    enableBrowserTelemetry: true
});

// Heavy mode - full monitoring
const heavyEngine = ProctoringEngine.getInstance({
    enableVisualDetection: true,
    enableAudioMonitoring: true,
    enablePatternDetection: true,
    enableBrowserTelemetry: true,
    detectionFPS: 15  // Higher FPS for more accuracy
});

// Custom mode - visual + patterns only
const customEngine = ProctoringEngine.getInstance({
    enableVisualDetection: true,
    enableAudioMonitoring: false,
    enablePatternDetection: true,
    enableBrowserTelemetry: true
});
```

### Runtime Configuration Updates

```javascript
// Update configuration during session
engine.updateOptions({
    gazeThreshold: 30,        // More lenient
    detectionFPS: 5           // Reduce CPU usage
});

// Update individual modules
engine.visualModule.updateOptions({
    detectionFPS: 8
});

engine.audioModule.updateOptions({
    talkingThreshold: -40
});
```

## 📡 Events

### Event Structure

```javascript
{
    event: 'TALKING_DETECTED',      // Event type
    lv: 8,                          // Severity level (1-10)
    ts: 1703098765432,              // Timestamp (Unix ms)
    source: 'audio',                // Module source
    sessionDuration: 123456,        // Time since session start (ms)
    
    // Event-specific metadata
    duration: 5000,                 // Duration of behavior (ms)
    level: -40,                     // Audio level (dB)
    direction: 'left',              // Direction (for gaze/head)
    severity: 'high',               // Human-readable severity
    extractedFeatures: {}           // The face and hand features extracted from the frame
}
```

### Event Types by Severity

#### Critical (9-10)
- `NO_FACE` - No face detected
- `MULTIPLE_FACES` - Multiple people in frame
- `PERSON_LEFT` - Student left for extended period
- `SUSPICIOUS_OBJECT` - Unauthorized object detected
- `TAB_SWITCHED` - Tab switch detected
- `PASTE_ATTEMPT` - Paste operation
- `PATTERN_*` - Behavioral pattern detected

#### High (7-8)
- `GAZE_AWAY` - Looking away from screen
- `PROLONGED_GAZE_AWAY` - Extended gaze away
- `HEAD_TURNED` - Head significantly rotated
- `PROLONGED_MOUTH_MOVEMENT` - Extended mouth movement
- `TALKING_DETECTED` - Speech detected
- `WHISPERING_DETECTED` - Whispering detected
- `WINDOW_FOCUS_LOST` - Window lost focus
- `EXITED_FULLSCREEN` - Fullscreen exited
- `COPY_ATTEMPT` - Copy operation

#### Medium (5-6)
- `MOUTH_MOVING` - Mouth movement detected
- `MOUTH_COVERED` - Mouth appears covered
- `EYES_OFF_SCREEN` - Eyes looking off-screen
- `RIGHT_CLICK` - Right-click attempt
- `SUSPICIOUS_KEY_PRESS` - Suspicious keyboard shortcut

#### Low (1-4)
- `MOUSE_LEFT_WINDOW` - Mouse left window
- `WINDOW_FOCUS_RESTORED` - Focus restored
- `TAB_RETURNED` - Returned to tab

## 🎯 Behavioral Patterns

Patterns are **critical alerts** indicating high probability of cheating.

### Pattern: Suspicious Triple Pattern
**When:** Student is looking away + talking + mouth moving simultaneously  
**Severity:** 10 (Critical)  
**Interpretation:** Likely communicating with someone off-screen

```javascript
onBehavioralPattern: (pattern) => {
    if (pattern.pattern === 'suspiciousTriplePattern') {
        // This is extremely suspicious
        alertSupervisor('Student likely cheating');
        flagExamForReview();
    }
}
```

### Pattern: Looking Left/Right + Whispering
**When:** Student looking to side while whispering  
**Severity:** 8 (High)  
**Interpretation:** Possibly communicating with nearby person

### Pattern: Mouth Covered + Audio
**When:** Mouth covered but audio detected  
**Severity:** 9 (High)  
**Interpretation:** Attempting to hide speaking

### Pattern: Object + Looking Away
**When:** Suspicious object detected + looking away from screen  
**Severity:** 9 (High)  
**Interpretation:** Using unauthorized materials

### Pattern: Multiple Faces + Audio
**When:** Multiple people + audio detected  
**Severity:** 10 (Critical)  
**Interpretation:** Multiple people taking exam together

### Custom Pattern Detection

Add your own patterns:

```javascript
// Add custom pattern
engine.patternModule.patterns.myCustomPattern = {
    name: 'myCustomPattern',
    severity: 8,
    events: [],
    count: 0,
    lastTriggered: 0,
    check: (visualState, audioState) => {
        // Your custom logic
        return visualState.numFaces === 0 && 
               audioState.isTalking;
    }
};
```

## 📖 API Reference

### ProctoringEngine

#### `getInstance(options)`
Get singleton instance.

```javascript
const engine = ProctoringEngine.getInstance(options);
```

#### `async initialize()`
Initialize all enabled modules.

```javascript
await engine.initialize();
```

#### `start(videoElement)`
Start proctoring with video element.

```javascript
const video = document.getElementById('webcam');
engine.start(video);
```

#### `stop()`
Stop proctoring.

```javascript
engine.stop();
```

#### `updateOptions(options)`
Update configuration at runtime.

```javascript
engine.updateOptions({ detectionFPS: 5 });
```

#### `getSessionSummary()`
Get comprehensive session summary.

```javascript
const summary = engine.getSessionSummary();
/*
{
    sessionDuration: 1800000,
    sessionStartTime: 1703098765432,
    sessionEndTime: 1703100565432,
    totalEvents: 45,
    eventCounts: {...},
    eventsBySeverity: {...},
    patterns: {...},
    visualState: {...},
    audioState: {...},
    suspiciousScore: 127
}
*/
```

#### `getLogs()`
Get all event logs.

```javascript
const logs = engine.getLogs();
```

#### `clearLogs()`
Clear all logs and patterns.

```javascript
engine.clearLogs();
```

#### `calculateSuspiciousScore()`
Calculate overall suspicious score (0-1000).

```javascript
const score = engine.calculateSuspiciousScore();
// 0-50: Normal
// 51-100: Some suspicious activity
// 101-200: Concerning behavior
// 201+: High probability of cheating
```

#### `destroy()`
Cleanup and destroy engine.

```javascript
engine.destroy();
```

### StateManager

#### `subscribe(callback)`
Subscribe to state changes.

```javascript
const unsubscribe = engine.stateManager.subscribe((state) => {
    console.log('State updated:', state);
});

// Unsubscribe later
unsubscribe();
```

#### `getCompleteState()`
Get complete current state.

```javascript
const state = engine.stateManager.getCompleteState();
```

#### `getVisualState()`
Get visual detection state.

```javascript
const visual = engine.stateManager.getVisualState();
```

#### `getAudioState()`
Get audio monitoring state.

```javascript
const audio = engine.stateManager.getAudioState();
```

### EventManager

#### `getAllEvents()`
Get all recorded events.

```javascript
const events = engine.eventManager.getAllEvents();
```

#### `getEventsByType(type)`
Get events of specific type.

```javascript
const tabSwitches = engine.eventManager.getEventsByType('TAB_SWITCHED');
```

#### `getEventsBySeverity(minSeverity)`
Get events above severity threshold.

```javascript
const critical = engine.eventManager.getEventsBySeverity(9);
```

#### `getSummary()`
Get event summary statistics.

```javascript
const summary = engine.eventManager.getSummary();
```

## 💡 Examples

### Basic Exam Proctoring

```javascript
import { ProctoringEngine } from './ProctoringEngine.js';

class SimpleProctor {
    constructor() {
        this.engine = ProctoringEngine.getInstance({
            onEvent: (e) => console.log('Event:', e.event),
            onBehavioralPattern: (p) => alert(`Warning: ${p.pattern}`)
        });
    }

    async start() {
        // Get camera
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        const video = document.getElementById('video');
        video.srcObject = stream;
        await video.play();

        // Start proctoring
        await this.engine.initialize();
        this.engine.start(video);
    }

    stop() {
        const summary = this.engine.getSessionSummary();
        console.log('Final score:', summary.suspiciousScore);
        this.engine.stop();
    }
}

const proctor = new SimpleProctor();
await proctor.start();
```

### Advanced Integration with Backend

```javascript
class AdvancedProctor {
    constructor(examId, studentId) {
        this.examId = examId;
        this.studentId = studentId;
        this.ws = null;  // WebSocket connection
        
        this.engine = ProctoringEngine.getInstance({
            onEvent: (event) => this.handleEvent(event),
            onBehavioralPattern: (pattern) => this.handlePattern(pattern)
        });
    }

    async start() {
        // Connect to backend via WebSocket
        this.ws = new WebSocket('wss://api.example.com/proctoring');
        
        // Setup camera
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }
        });
        const video = document.getElementById('video');
        video.srcObject = stream;
        await video.play();

        // Initialize and start
        await this.engine.initialize();
        this.engine.start(video);

        // Subscribe to state for real-time updates
        this.engine.stateManager.subscribe((state) => {
            this.sendStateUpdate(state);
        });

        // Periodic summaries
        this.summaryInterval = setInterval(() => {
            this.sendSummary();
        }, 30000);  // Every 30 seconds
    }

    handleEvent(event) {
        // Send event to backend via REST
        fetch('/api/proctoring/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examId: this.examId,
                studentId: this.studentId,
                event: event
            })
        });

        // Send via WebSocket for real-time monitoring
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'EVENT',
                data: event
            }));
        }

        // Show to student if critical
        if (event.lv >= 8) {
            this.showWarning(event.event);
        }
    }

    handlePattern(pattern) {
        // Critical alert - send immediately
        fetch('/api/proctoring/critical', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examId: this.examId,
                studentId: this.studentId,
                pattern: pattern,
                timestamp: Date.now()
            }),
            keepalive: true  // Ensure delivery
        });

        // Alert supervisor via WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'CRITICAL_PATTERN',
                data: pattern
            }));
        }

        // Show strong warning to student
        this.showCriticalWarning(pattern.pattern);
    }

    sendStateUpdate(state) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'STATE_UPDATE',
                data: {
                    examId: this.examId,
                    studentId: this.studentId,
                    state: state
                }
            }));
        }
    }

    sendSummary() {
        const summary = this.engine.getSessionSummary();
        
        fetch('/api/proctoring/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examId: this.examId,
                studentId: this.studentId,
                summary: summary
            })
        });
    }

    showWarning(eventType) {
        const warnings = {
            'TALKING_DETECTED': 'Please remain quiet during the exam.',
            'TAB_SWITCHED': 'Do not switch tabs during the exam.',
            'MULTIPLE_FACES': 'Multiple people detected. Only you should be visible.',
            'PERSON_LEFT': 'You have left the exam area.',
        };

        const message = warnings[eventType] || 'Suspicious activity detected.';
        const warning = document.getElementById('warning');
        warning.textContent = message;
        warning.classList.add('show');
        
        setTimeout(() => {
            warning.classList.remove('show');
        }, 5000);
    }

    showCriticalWarning(patternName) {
        const modal = document.getElementById('critical-modal');
        modal.querySelector('.message').textContent = 
            `Critical violation detected: ${patternName}. This exam may be flagged for review.`;
        modal.classList.add('show');
        
        setTimeout(() => {
            modal.classList.remove('show');
        }, 10000);
    }

    async stop() {
        // Clear interval
        if (this.summaryInterval) {
            clearInterval(this.summaryInterval);
        }

        // Get final data
        const summary = this.engine.getSessionSummary();
        const logs = this.engine.getLogs();

        // Send final report
        const finalData = {
            examId: this.examId,
            studentId: this.studentId,
            summary: summary,
            logs: logs,
            endTime: Date.now()
        };

        // Use sendBeacon for reliability during unload
        const blob = new Blob([JSON.stringify(finalData)], {
            type: 'application/json'
        });
        navigator.sendBeacon('/api/proctoring/finalize', blob);

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }

        // Destroy engine
        this.engine.destroy();
    }
}

// Usage
const proctor = new AdvancedProctor('exam-123', 'student-456');
await proctor.start();

// On exam submit
document.getElementById('submit-btn').addEventListener('click', async () => {
    await proctor.stop();
    // Submit exam answers...
});

// On page unload
window.addEventListener('beforeunload', () => {
    proctor.stop();
});
```

### React Integration

```javascript
import React, { useEffect, useRef, useState } from 'react';
import { ProctoringEngine } from './ProctoringEngine';

function ExamProctoring({ examId, studentId }) {
    const videoRef = useRef(null);
    const engineRef = useRef(null);
    
    const [status, setStatus] = useState('initializing');
    const [events, setEvents] = useState([]);
    const [score, setScore] = useState(0);
    const [warning, setWarning] = useState('');

    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            try {
                // Setup camera
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 }
                });
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                // Initialize engine
                const engine = ProctoringEngine.getInstance({
                    onEvent: (event) => {
                        if (mounted) {
                            setEvents(prev => [event, ...prev].slice(0, 20));
                        }
                    },
                    onBehavioralPattern: (pattern) => {
                        if (mounted) {
                            setWarning(`⚠️ ${pattern.pattern} detected`);
                            setTimeout(() => setWarning(''), 5000);
                        }
                    },
                    onStatusChange: (newStatus) => {
                        if (mounted) setStatus(newStatus);
                    }
                });

                engineRef.current = engine;
                await engine.initialize();
                
                if (videoRef.current) {
                    engine.start(videoRef.current);
                }

                // Update score periodically
                const interval = setInterval(() => {
                    if (engineRef.current && mounted) {
                        const summary = engineRef.current.getSessionSummary();
                        setScore(summary.suspiciousScore);
                    }
                }, 5000);

                return () => {
                    clearInterval(interval);
                };

            } catch (error) {
                console.error('Initialization failed:', error);
                if (mounted) setStatus('error');
            }
        };

        initialize();

        return () => {
            mounted = false;
            if (engineRef.current) {
                engineRef.current.stop();
                engineRef.current.destroy();
            }
        };
    }, [examId, studentId]);

    return (
        <div className="proctoring-container">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="proctoring-video"
            />
            
            <div className="proctoring-info">
                <div className="status">
                    Status: <span className={status}>{status}</span>
                </div>
                <div className="score">
                    Suspicious Score: <span>{score}</span>
                </div>
            </div>

            {warning && (
                <div className="warning-banner">
                    {warning}
                </div>
            )}

            <div className="event-log">
                <h3>Recent Events</h3>
                {events.map((event, i) => (
                    <div key={i} className={`event severity-${event.lv}`}>
                        {new Date(event.ts).toLocaleTimeString()} - {event.event}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ExamProctoring;
```

## 🌐 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Opera | 76+ | ✅ Full |

### Requirements

- **WebRTC** - For camera access
- **Web Audio API** - For microphone access
- **WebGL** - For MediaPipe GPU acceleration
- **ES6+** - Modern JavaScript features

### Permissions Required

```javascript
// Camera permission
await navigator.mediaDevices.getUserMedia({ video: true });

// Microphone permission (handled internally)
// Requested automatically by AudioMonitoringModule
```

## ⚡ Performance

### Optimization Tips

1. **Adjust Detection FPS**
```javascript
// Lower FPS for better performance
engine.updateOptions({ detectionFPS: 5 });
```

2. **Increase Stability Frames**
```javascript
// Fewer false positives, better performance
engine.updateOptions({ stabilityFrames: 20 });
```

3. **Selective Modules**
```javascript
// Only enable what you need
ProctoringEngine.getInstance({
    enableVisualDetection: true,
    enableAudioMonitoring: false,  // Disable if not needed
    enablePatternDetection: true,
    enableBrowserTelemetry: true
});
```

4. **GPU Acceleration**
   Ensure WebGL is enabled for MediaPipe GPU acceleration.

### Performance Metrics

| Configuration | CPU Usage | Memory | Accuracy |
|---------------|-----------|---------|----------|
| Low (5 FPS) | ~10% | ~150MB | Good |
| Medium (10 FPS) | ~20% | ~200MB | Better |
| High (15 FPS) | ~30% | ~250MB | Best |

*Tested on Intel i5, 8GB RAM, Chrome 120*

## 🔒 Security

### Data Privacy

- ✅ **Client-Side Processing** - All detection runs in browser
- ✅ **No Cloud Dependencies** - MediaPipe models loaded from CDN
- ✅ **Secure Transmission** - Use HTTPS for backend communication
- ✅ **No Recording** - Video/audio analyzed in real-time, not stored
- ✅ **Configurable** - Choose which data to send to backend

### Best Practices

1. **Obtain Explicit Consent**
```javascript
// Show consent dialog before starting
const consent = await showConsentDialog();
if (consent) {
    await proctor.start();
}
```

2. **Use HTTPS**
```javascript
// Always use secure connections
fetch('https://api.example.com/proctoring/event', {
    method: 'POST',
    // ...
});
```

3. **Implement Data Retention Policies**
```javascript
// Clear logs after exam
window.addEventListener('beforeunload', () => {
    engine.clearLogs();
});
```

4. **Provide Accommodations**
```javascript
// Adjust for students with disabilities
engine.updateOptions({
    gazeThreshold: 35,  // More lenient
    prolongedGazeAwayDuration: 10000
});
```

## 🐛 Troubleshooting

### Camera Not Working

```javascript
// Check permission
navigator.permissions.query({ name: 'camera' })
    .then(result => {
        console.log('Camera permission:', result.state);
        if (result.state === 'denied') {
            alert('Please allow camera access');
        }
    });
```

### Audio Not Detected

```javascript
// Check microphone permission
navigator.permissions.query({ name: 'microphone' })
    .then(result => {
        console.log('Microphone permission:', result.state);
    });

// Check if audio module initialized
if (!engine.audioModule.isSetup) {
    console.warn('Audio monitoring not available');
}
```

### High CPU Usage

```javascript
// Reduce detection FPS
engine.updateOptions({ detectionFPS: 5 });

// Disable unnecessary modules
engine.updateOptions({
    enableAudioMonitoring: false
});
```

### Models Not Loading

```javascript
// Check network connection
// MediaPipe models loaded from CDN
// Ensure CDN is accessible: https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/ai-proctoring-engine.git

# Install dependencies
cd ai-proctoring-engine
npm install

# Run tests
npm test

# Build
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) - Computer vision framework
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Audio processing

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-proctoring-engine/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-proctoring-engine/discussions)
- **Email**: support@example.com

## 🗺️ Roadmap

- [ ] TypeScript support
- [ ] Hand tracking for gesture detection
- [ ] Mobile support
- [ ] Offline mode with model caching
- [ ] Dashboard for supervisors
- [ ] API for third-party integrations
- [ ] Automated report generation
- [ ] Multi-language support

---

Made with ❤️ for fair and secure online examinations