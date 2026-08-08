import { PatternDetectionModule } from '../src/modules/PatternDetectionModule.js';

describe('PatternDetectionModule', () => {
  let module;
  let onPattern;

  const suspiciousVisual = {
    numFaces: 1,
    currentGazeDirection: 'left',
    currentHeadDirection: 'center',
    isMouthMoving: true,
    isMouthCovered: false,
    suspiciousObjectDetected: false,
  };
  const suspiciousAudio = { isTalking: true, isWhispering: false };

  const callsFor = (patternName) =>
    onPattern.mock.calls.filter(([call]) => call.pattern === patternName);

  const createStateManager = (visualState, audioState) => ({
    getVisualState: jest.fn(() => visualState),
    getAudioState: jest.fn(() => audioState),
  });

  beforeEach(() => {
    onPattern = jest.fn();
    module = new PatternDetectionModule({ onPattern });
  });

  describe('constructor', () => {
    test('applies default options', () => {
      expect(module.options.suspiciousPatternThreshold).toBe(3);
      expect(module.options.patternDetectionWindow).toBe(10000);
      expect(module.options.onPattern).toBe(onPattern);
    });

    test('defines the built-in suspicious patterns', () => {
      const names = Object.keys(module.patterns);
      expect(names).toEqual(expect.arrayContaining([
        'suspiciousTriplePattern',
        'lookingLeftWhispering',
        'lookingRightWhispering',
        'mouthCoveredWithAudio',
        'lookingAwayAndTalking',
        'objectAndLookingAway',
        'multipleFacesWithAudio',
        'headTurnedTalking',
      ]));
    });
  });

  describe('checkAllPatterns', () => {
    test('triggers a pattern once the event threshold is reached', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const stateManager = createStateManager(suspiciousVisual, suspiciousAudio);
      module.stateManager = stateManager;

      for (let i = 0; i < 3; i++) {
        module.checkAllPatterns();
      }

      expect(callsFor('suspiciousTriplePattern')).toHaveLength(1);
      expect(callsFor('suspiciousTriplePattern')[0][0]).toEqual(expect.objectContaining({
        pattern: 'suspiciousTriplePattern',
        severity: 10,
        count: 1,
        eventsInWindow: 3,
      }));
    });

    test('does not trigger when the condition is never met', () => {
      const stateManager = createStateManager(
        { currentGazeDirection: 'center', isMouthMoving: false, currentHeadDirection: 'center' },
        { isTalking: false, isWhispering: false }
      );
      module.stateManager = stateManager;

      for (let i = 0; i < 10; i++) {
        module.checkAllPatterns();
      }

      expect(onPattern).not.toHaveBeenCalled();
    });

    test('throttles repeated triggers', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const stateManager = createStateManager(suspiciousVisual, suspiciousAudio);
      module.stateManager = stateManager;

      for (let i = 0; i < 6; i++) {
        module.checkAllPatterns();
      }

      expect(callsFor('suspiciousTriplePattern')).toHaveLength(1);
    });

    test('does nothing when there is no state manager', () => {
      expect(() => module.checkAllPatterns()).not.toThrow();
      expect(onPattern).not.toHaveBeenCalled();
    });

    test('triggers custom registered patterns', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const customCheck = jest.fn(() => true);
      module.patterns.myCustomPattern = {
        name: 'myCustomPattern',
        severity: 8,
        events: [],
        count: 0,
        lastTriggered: 0,
        check: customCheck,
      };

      const stateManager = createStateManager({}, {});
      module.stateManager = stateManager;

      for (let i = 0; i < 3; i++) {
        module.checkAllPatterns();
      }

      expect(customCheck).toHaveBeenCalled();
      expect(onPattern).toHaveBeenCalledWith(expect.objectContaining({
        pattern: 'myCustomPattern',
        severity: 8,
      }));
    });
  });

  describe('addEvent / checkEventPatterns', () => {
    test('triggers repeatedTabSwitches after 3 tab switches', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      for (let i = 0; i < 3; i++) {
        module.addEvent({ event: 'TAB_SWITCHED', ts: 1000000 - i });
      }

      expect(onPattern).toHaveBeenCalledWith(expect.objectContaining({
        pattern: 'repeatedTabSwitches',
        severity: 10,
        metadata: expect.objectContaining({ count: 3 }),
      }));
    });

    test('triggers abnormalEyeMovement for rapid multi-direction gaze', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const directions = ['left', 'right', 'up', 'left', 'right'];

      directions.forEach((direction, i) => {
        module.addEvent({ event: 'GAZE_AWAY', direction, ts: 1000000 - i });
      });

      expect(onPattern).toHaveBeenCalledWith(expect.objectContaining({
        pattern: 'abnormalEyeMovement',
        severity: 7,
        metadata: expect.objectContaining({ pattern: 'rapid_scanning' }),
      }));
    });

    test('triggers multipleObjects after 2 suspicious objects', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      module.addEvent({ event: 'SUSPICIOUS_OBJECT', object: 'cell phone', ts: 1000000 });
      module.addEvent({ event: 'SUSPICIOUS_OBJECT', object: 'book', ts: 1000000 });

      expect(onPattern).toHaveBeenCalledWith(expect.objectContaining({
        pattern: 'multipleObjects',
        severity: 9,
        metadata: expect.objectContaining({ objects: ['cell phone', 'book'] }),
      }));
    });

    test('does not trigger patterns from stale events outside the window', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      module.addEvent({ event: 'TAB_SWITCHED', ts: 1 });
      module.addEvent({ event: 'TAB_SWITCHED', ts: 2 });
      module.addEvent({ event: 'TAB_SWITCHED', ts: 3 });

      expect(onPattern).not.toHaveBeenCalled();
    });

    test('bounds the event history size', () => {
      module.maxEventHistorySize = 100;

      for (let i = 0; i < 150; i++) {
        module.addEvent({ event: 'NO_FACE', ts: 1000000 - i });
      }

      expect(module.eventHistory.length).toBeLessThanOrEqual(100);
    });
  });

  describe('start/stop', () => {
    test('start sets up a state manager and stop clears the interval', () => {
      jest.useFakeTimers();
      const stateManager = createStateManager({}, {});
      module.start(stateManager);

      expect(module.isRunning).toBe(true);
      expect(module.stateManager).toBe(stateManager);

      module.stop();
      expect(module.isRunning).toBe(false);
      expect(module.patternCheckInterval).toBeNull();

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });
  });

  describe('getPatternSummary', () => {
    test('returns count, lastTriggered and eventsInWindow for each pattern', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const stateManager = createStateManager(suspiciousVisual, suspiciousAudio);
      module.stateManager = stateManager;

      for (let i = 0; i < 3; i++) {
        module.checkAllPatterns();
      }

      const summary = module.getPatternSummary();
      expect(summary.suspiciousTriplePattern.count).toBe(1);
      expect(summary.suspiciousTriplePattern.eventsInWindow).toBe(3);
      expect(summary.headTurnedTalking.count).toBe(0);
    });
  });

  describe('clearPatterns', () => {
    test('resets all pattern state', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      const stateManager = createStateManager(suspiciousVisual, suspiciousAudio);
      module.stateManager = stateManager;

      for (let i = 0; i < 3; i++) {
        module.checkAllPatterns();
      }
      module.addEvent({ event: 'TAB_SWITCHED', ts: 1000000 });

      module.clearPatterns();

      Object.values(module.patterns).forEach(pattern => {
        expect(pattern.events).toEqual([]);
        expect(pattern.count).toBe(0);
        expect(pattern.lastTriggered).toBe(0);
      });
      expect(module.eventHistory).toEqual([]);
    });
  });
});
