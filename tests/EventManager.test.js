import { EventManager } from '../src/managers/EventManager.js';

describe('EventManager', () => {
  let manager;

  beforeEach(() => {
    manager = new EventManager();
  });

  describe('recordEvent', () => {
    test('stores events with unique ids', () => {
      const now = Date.now();
      manager.recordEvent({ event: 'TAB_SWITCHED', lv: 10, ts: now });

      const events = manager.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('TAB_SWITCHED');
      expect(events[0].id).toMatch(/^evt_/);
      expect(events[0]).toEqual(expect.objectContaining({ event: 'TAB_SWITCHED', lv: 10, ts: now }));
    });

    test('invokes onEvent callback', () => {
      const onEvent = jest.fn();
      manager = new EventManager({ onEvent });

      manager.recordEvent({ event: 'GAZE_AWAY', lv: 7, ts: Date.now() });

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent.mock.calls[0][0].event).toBe('GAZE_AWAY');
    });

    test('throttles non-critical events within the throttle window', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      manager.recordEvent({ event: 'GAZE_AWAY', lv: 7, ts: 1000000 });
      manager.recordEvent({ event: 'GAZE_AWAY', lv: 7, ts: 1000000 });

      expect(manager.getAllEvents()).toHaveLength(1);

      Date.now.mockReturnValue(1001001);
      manager.recordEvent({ event: 'GAZE_AWAY', lv: 7, ts: 1001001 });

      expect(manager.getAllEvents()).toHaveLength(2);
    });

    test('does not throttle critical events (lv >= 9)', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      manager.recordEvent({ event: 'TAB_SWITCHED', lv: 10, ts: 1000000 });
      manager.recordEvent({ event: 'TAB_SWITCHED', lv: 10, ts: 1000000 });

      expect(manager.getAllEvents()).toHaveLength(2);
    });
  });

  describe('recordPattern', () => {
    test('stores patterns and invokes onBehavioralPattern', () => {
      const onBehavioralPattern = jest.fn();
      manager = new EventManager({ onBehavioralPattern });

      manager.recordPattern({ pattern: 'suspiciousTriplePattern', severity: 10 });

      expect(manager.getAllPatterns()).toHaveLength(1);
      expect(manager.getAllPatterns()[0].id).toMatch(/^pat_/);
      expect(onBehavioralPattern).toHaveBeenCalledWith(
        expect.objectContaining({ pattern: 'suspiciousTriplePattern' })
      );
    });
  });

  describe('query methods', () => {
    beforeEach(() => {
      manager.events = [
        { event: 'TAB_SWITCHED', lv: 10, ts: 1000 },
        { event: 'GAZE_AWAY', lv: 7, ts: 2000 },
        { event: 'MOUSE_LEFT_WINDOW', lv: 4, ts: 3000 },
        { event: 'TAB_SWITCHED', lv: 10, ts: 4000 },
      ];
    });

    test('getEventsByType filters by event type', () => {
      const tabSwitches = manager.getEventsByType('TAB_SWITCHED');
      expect(tabSwitches).toHaveLength(2);
    });

    test('getEventsBySeverity filters by minimum severity', () => {
      const severe = manager.getEventsBySeverity(7);
      expect(severe).toHaveLength(3);
    });

    test('getEventsInRange filters by timestamp', () => {
      const inRange = manager.getEventsInRange(1500, 3500);
      expect(inRange).toHaveLength(2);
    });
  });

  describe('getSummary', () => {
    test('returns zeroed summary for no events', () => {
      const summary = manager.getSummary();

      expect(summary.totalEvents).toBe(0);
      expect(summary.totalPatterns).toBe(0);
      expect(summary.eventsBySeverity).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
      expect(summary.eventCounts).toEqual({});
      expect(summary.mostFrequentEvent).toBeNull();
      expect(summary.averageSeverity).toBe(0);
    });

    test('computes event counts and severity buckets', () => {
      manager.events = [
        { event: 'TAB_SWITCHED', lv: 10 },
        { event: 'TAB_SWITCHED', lv: 10 },
        { event: 'GAZE_AWAY', lv: 7 },
        { event: 'MOUSE_LEFT_WINDOW', lv: 4 },
      ];

      const summary = manager.getSummary();

      expect(summary.totalEvents).toBe(4);
      expect(summary.eventCounts).toEqual({ TAB_SWITCHED: 2, GAZE_AWAY: 1, MOUSE_LEFT_WINDOW: 1 });
      expect(summary.eventsBySeverity).toEqual({ critical: 2, high: 1, medium: 0, low: 1 });
      expect(summary.mostFrequentEvent).toEqual({ event: 'TAB_SWITCHED', count: 2 });
      expect(summary.averageSeverity).toBeCloseTo(7.75, 5);
    });
  });

  describe('getPatternCounts', () => {
    test('counts patterns by name', () => {
      manager.patterns = [
        { pattern: 'suspiciousTriplePattern' },
        { pattern: 'suspiciousTriplePattern' },
        { pattern: 'headTurnedTalking' },
      ];

      expect(manager.getPatternCounts()).toEqual({
        suspiciousTriplePattern: 2,
        headTurnedTalking: 1,
      });
    });
  });

  describe('getTimeline', () => {
    test('returns an empty timeline when there are no events', () => {
      expect(manager.getTimeline()).toEqual([]);
    });

    test('groups events into intervals', () => {
      manager.events = [
        { event: 'A', lv: 5, ts: 1000 },
        { event: 'B', lv: 5, ts: 2000 },
        { event: 'C', lv: 5, ts: 61000 },
      ];

      const timeline = manager.getTimeline(60000);

      expect(timeline).toHaveLength(2);
      expect(timeline[0].eventCount).toBe(2);
      expect(timeline[1].eventCount).toBe(1);
    });
  });

  describe('clearEvents', () => {
    test('clears events, patterns and throttle state', () => {
      manager.recordEvent({ event: 'TAB_SWITCHED', lv: 10, ts: Date.now() });
      manager.recordPattern({ pattern: 'x' });

      manager.clearEvents();

      expect(manager.getAllEvents()).toEqual([]);
      expect(manager.getAllPatterns()).toEqual([]);
      expect(manager.lastSentEvents).toEqual({});
    });
  });

  describe('export/import', () => {
    test('exports events, patterns and summary', () => {
      manager.recordEvent({ event: 'TAB_SWITCHED', lv: 10, ts: 1000 });
      manager.recordPattern({ pattern: 'x' });

      const exported = manager.exportEvents();

      expect(exported.events).toHaveLength(1);
      expect(exported.patterns).toHaveLength(1);
      expect(exported.summary.totalEvents).toBe(1);
      expect(typeof exported.exportTime).toBe('number');
    });

    test('imports previously exported data', () => {
      const data = {
        events: [{ event: 'GAZE_AWAY', lv: 7, ts: 500 }],
        patterns: [{ pattern: 'x' }],
      };

      manager.importEvents(data);

      expect(manager.getAllEvents()).toHaveLength(1);
      expect(manager.getAllPatterns()).toHaveLength(1);
    });
  });
});
