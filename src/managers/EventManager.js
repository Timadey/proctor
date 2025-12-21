/**
 * EventManager
 * Centralized event recording, throttling, and management
 */

export class EventManager {
    constructor(options = {}) {
        this.options = {
            onEvent: null,
            onBehavioralPattern: null,
            eventThrottleMs: 1000,
            ...options
        };

        // Event storage
        this.events = [];
        this.patterns = [];

        // Throttling
        this.lastSentEvents = {};

        // Event categorization
        this.eventCategories = {
            critical: ['NO_FACE', 'MULTIPLE_FACES', 'PERSON_LEFT', 'TAB_SWITCHED', 'PASTE_ATTEMPT', 'SUSPICIOUS_OBJECT'],
            high: ['PROLONGED_GAZE_AWAY', 'TALKING_DETECTED', 'WINDOW_FOCUS_LOST', 'EXITED_FULLSCREEN', 'HEAD_TURNED'],
            medium: ['GAZE_AWAY', 'PROLONGED_MOUTH_MOVEMENT', 'WHISPERING_DETECTED', 'MOUTH_COVERED', 'COPY_ATTEMPT'],
            low: ['MOUTH_MOVING', 'RIGHT_CLICK', 'SUSPICIOUS_KEY_PRESS', 'MOUSE_LEFT_WINDOW']
        };
    }

    /**
     * Record an event
     */
    recordEvent(event) {
        const now = Date.now();

        // Throttle events
        const lastSent = this.lastSentEvents[event.event] || 0;
        const shouldThrottle = event.lv < 9 && (now - lastSent < this.options.eventThrottleMs);

        if (shouldThrottle) {
            return;
        }

        this.lastSentEvents[event.event] = now;

        // Add to storage
        this.events.push({
            ...event,
            id: `evt_${now}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Emit event
        if (this.options.onEvent) {
            this.options.onEvent(event);
        }
    }

    /**
     * Record a pattern
     */
    recordPattern(pattern) {
        this.patterns.push({
            ...pattern,
            id: `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Emit pattern
        if (this.options.onBehavioralPattern) {
            this.options.onBehavioralPattern(pattern);
        }
    }

    /**
     * Get all events
     */
    getAllEvents() {
        return [...this.events];
    }

    /**
     * Get all patterns
     */
    getAllPatterns() {
        return [...this.patterns];
    }

    /**
     * Get events by type
     */
    getEventsByType(type) {
        return this.events.filter(e => e.event === type);
    }

    /**
     * Get events by severity
     */
    getEventsBySeverity(minSeverity) {
        return this.events.filter(e => e.lv >= minSeverity);
    }

    /**
     * Get events in time range
     */
    getEventsInRange(startTime, endTime) {
        return this.events.filter(e => e.ts >= startTime && e.ts <= endTime);
    }

    /**
     * Get summary
     */
    getSummary() {
        const eventCounts = {};
        const eventsBySeverity = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };

        this.events.forEach(event => {
            // Count by type
            eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;

            // Count by severity
            if (event.lv >= 9) {
                eventsBySeverity.critical++;
            } else if (event.lv >= 7) {
                eventsBySeverity.high++;
            } else if (event.lv >= 5) {
                eventsBySeverity.medium++;
            } else {
                eventsBySeverity.low++;
            }
        });

        return {
            totalEvents: this.events.length,
            totalPatterns: this.patterns.length,
            eventCounts,
            eventsBySeverity,
            patternCounts: this.getPatternCounts(),
            mostFrequentEvent: this.getMostFrequentEvent(),
            averageSeverity: this.getAverageSeverity()
        };
    }

    /**
     * Get pattern counts
     */
    getPatternCounts() {
        const counts = {};
        this.patterns.forEach(pattern => {
            counts[pattern.pattern] = (counts[pattern.pattern] || 0) + 1;
        });
        return counts;
    }

    /**
     * Get most frequent event
     */
    getMostFrequentEvent() {
        if (this.events.length === 0) return null;

        const counts = {};
        this.events.forEach(event => {
            counts[event.event] = (counts[event.event] || 0) + 1;
        });

        let maxCount = 0;
        let mostFrequent = null;

        Object.entries(counts).forEach(([event, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = event;
            }
        });

        return { event: mostFrequent, count: maxCount };
    }

    /**
     * Get average severity
     */
    getAverageSeverity() {
        if (this.events.length === 0) return 0;
        const total = this.events.reduce((sum, event) => sum + event.lv, 0);
        return total / this.events.length;
    }

    /**
     * Get event timeline
     */
    getTimeline(intervalMs = 60000) {
        if (this.events.length === 0) return [];

        const firstEvent = this.events[0].ts;
        const lastEvent = this.events[this.events.length - 1].ts;

        const timeline = [];
        let currentTime = firstEvent;

        while (currentTime <= lastEvent) {
            const endTime = currentTime + intervalMs;
            const eventsInInterval = this.events.filter(
                e => e.ts >= currentTime && e.ts < endTime
            );

            timeline.push({
                startTime: currentTime,
                endTime: endTime,
                eventCount: eventsInInterval.length,
                events: eventsInInterval
            });

            currentTime = endTime;
        }

        return timeline;
    }

    /**
     * Clear all events
     */
    clearEvents() {
        this.events = [];
        this.patterns = [];
        this.lastSentEvents = {};
    }

    /**
     * Export events as JSON
     */
    exportEvents() {
        return {
            events: this.events,
            patterns: this.patterns,
            summary: this.getSummary(),
            exportTime: Date.now()
        };
    }

    /**
     * Import events from JSON
     */
    importEvents(data) {
        if (data.events) {
            this.events = data.events;
        }
        if (data.patterns) {
            this.patterns = data.patterns;
        }
    }
}