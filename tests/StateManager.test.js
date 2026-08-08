import { StateManager } from '../src/managers/StateManager.js';

describe('StateManager', () => {
  let manager;

  beforeEach(() => {
    manager = new StateManager();
  });

  describe('initial state', () => {
    test('visual state has default values', () => {
      const visual = manager.getVisualState();

      expect(visual.numFaces).toBe(0);
      expect(visual.currentGazeDirection).toBe('center');
      expect(visual.isMouthMoving).toBe(false);
      expect(visual.suspiciousObjectDetected).toBe(false);
    });

    test('audio state has default values', () => {
      const audio = manager.getAudioState();

      expect(audio.isTalking).toBe(false);
      expect(audio.isWhispering).toBe(false);
      expect(audio.currentAudioLevel).toBe(-100);
      expect(audio.audioLevelHistory).toEqual([]);
    });

    test('session state is inactive', () => {
      expect(manager.getSessionState()).toEqual({
        sessionStartTime: null,
        isActive: false,
        isPaused: false,
      });
    });
  });

  describe('setSessionStartTime', () => {
    test('activates the session', () => {
      manager.setSessionStartTime(123456);

      const session = manager.getSessionState();
      expect(session.sessionStartTime).toBe(123456);
      expect(session.isActive).toBe(true);
    });
  });

  describe('update methods', () => {
    test('updateVisualState merges new values', () => {
      manager.updateVisualState({ numFaces: 1, currentGazeDirection: 'left' });

      const visual = manager.getVisualState();
      expect(visual.numFaces).toBe(1);
      expect(visual.currentGazeDirection).toBe('left');
      expect(visual.suspiciousObjectDetected).toBe(false);
    });

    test('updateAudioState merges new values', () => {
      manager.updateAudioState({ isTalking: true, currentAudioLevel: -30 });

      const audio = manager.getAudioState();
      expect(audio.isTalking).toBe(true);
      expect(audio.currentAudioLevel).toBe(-30);
      expect(audio.isWhispering).toBe(false);
    });

    test('updateSessionState merges new values', () => {
      manager.updateSessionState({ isPaused: true });

      expect(manager.getSessionState().isPaused).toBe(true);
    });
  });

  describe('subscriptions', () => {
    test('notifies subscribers on state changes', () => {
      const callback = jest.fn();
      manager.subscribe(callback);

      manager.updateVisualState({ numFaces: 2 });

      expect(callback).toHaveBeenCalledTimes(1);
      const state = callback.mock.calls[0][0];
      expect(state.visual.numFaces).toBe(2);
      expect(state.timestamp).toEqual(expect.any(Number));
    });

    test('unsubscribe stops notifications', () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribe(callback);

      unsubscribe();
      manager.updateVisualState({ numFaces: 1 });

      expect(callback).not.toHaveBeenCalled();
    });

    test('a failing subscriber does not prevent others from running', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const bad = jest.fn(() => { throw new Error('boom'); });
      const good = jest.fn();

      manager.subscribe(bad);
      manager.subscribe(good);

      manager.updateVisualState({ numFaces: 1 });

      expect(bad).toHaveBeenCalled();
      expect(good).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Error in state subscriber:', expect.any(Error));
    });
  });

  describe('getCompleteState', () => {
    test('returns a snapshot with timestamp', () => {
      const state = manager.getCompleteState();

      expect(state).toEqual(expect.objectContaining({
        visual: expect.any(Object),
        audio: expect.any(Object),
        session: expect.any(Object),
      }));
      expect(state.timestamp).toEqual(expect.any(Number));
    });

    test('returns a copy, not a reference', () => {
      const state = manager.getCompleteState();
      state.visual.numFaces = 99;

      expect(manager.getVisualState().numFaces).toBe(0);
    });
  });

  describe('pause/resume', () => {
    test('pause and resume toggle the paused flag', () => {
      manager.pause();
      expect(manager.getSessionState().isPaused).toBe(true);

      manager.resume();
      expect(manager.getSessionState().isPaused).toBe(false);
    });
  });

  describe('getSessionDuration', () => {
    test('returns zero before the session starts', () => {
      expect(manager.getSessionDuration()).toBe(0);
    });

    test('returns elapsed time after session starts', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      manager.setSessionStartTime(1000000);

      expect(manager.getSessionDuration()).toBe(1000000);

      Date.now.mockReturnValue(3000000);
      expect(manager.getSessionDuration()).toBe(2000000);
    });
  });

  describe('reset', () => {
    test('restores all defaults', () => {
      manager.updateVisualState({ numFaces: 3 });
      manager.updateAudioState({ isTalking: true });
      manager.setSessionStartTime(123);

      manager.reset();

      expect(manager.getVisualState().numFaces).toBe(0);
      expect(manager.getAudioState().isTalking).toBe(false);
      expect(manager.getSessionState().isActive).toBe(false);
    });
  });

  describe('exportState', () => {
    test('includes session duration', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      manager.setSessionStartTime(1000000);

      const exported = manager.exportState();

      expect(exported.sessionDuration).toBe(1000000);
      expect(exported.visual).toBeDefined();
      expect(exported.audio).toBeDefined();
      expect(exported.session).toBeDefined();
    });
  });
});
