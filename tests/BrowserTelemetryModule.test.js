import { BrowserTelemetryModule } from '../src/modules/BrowserTelemetryModule.js';

describe('BrowserTelemetryModule', () => {
  let module;
  let onEvent;

  beforeEach(() => {
    onEvent = jest.fn();
    module = new BrowserTelemetryModule({ onEvent });
    module.start();
  });

  afterEach(() => {
    module.stop();
  });

  const emittedEvents = () => onEvent.mock.calls.map(([event]) => event.event);
  const eventFor = (type) => onEvent.mock.calls.map(([event]) => event).find(e => e.event === type);

  describe('start/stop', () => {
    test('registers and removes document and window listeners', () => {
      const documentAdd = jest.spyOn(document, 'addEventListener');
      const windowAdd = jest.spyOn(window, 'addEventListener');

      const fresh = new BrowserTelemetryModule({ onEvent: jest.fn() });
      fresh.start();

      expect(documentAdd).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(documentAdd).toHaveBeenCalledWith('copy', expect.any(Function));
      expect(windowAdd).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(windowAdd).toHaveBeenCalledWith('mouseleave', expect.any(Function));

      const documentRemove = jest.spyOn(document, 'removeEventListener');
      const windowRemove = jest.spyOn(window, 'removeEventListener');
      fresh.stop();

      expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(windowRemove).toHaveBeenCalledWith('mouseleave', expect.any(Function));

      jest.restoreAllMocks();
    });
  });

  describe('tab and focus events', () => {
    test('emits TAB_SWITCHED when the tab becomes hidden', () => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(eventFor('TAB_SWITCHED')).toEqual(expect.objectContaining({
        lv: 10,
        hidden: true,
        count: 1,
      }));
    });

    test('emits TAB_RETURNED when the tab becomes visible again', () => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(eventFor('TAB_RETURNED')).toEqual(expect.objectContaining({ lv: 2, hidden: false }));
    });

    test('emits WINDOW_FOCUS_LOST on blur and WINDOW_FOCUS_SWITCHED on focus', () => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));

      expect(eventFor('WINDOW_FOCUS_LOST')).toEqual(expect.objectContaining({ lv: 8, focused: false }));
      expect(eventFor('WINDOW_FOCUS_SWITCHED')).toEqual(expect.objectContaining({ lv: 10, focused: true }));
    });
  });

  describe('clipboard events', () => {
    test('emits COPY_ATTEMPT on copy', () => {
      document.dispatchEvent(new Event('copy'));

      expect(eventFor('COPY_ATTEMPT')).toEqual(expect.objectContaining({ lv: 7, count: 1 }));
    });

    test('emits PASTE_ATTEMPT on paste', () => {
      document.dispatchEvent(new Event('paste'));

      expect(eventFor('PASTE_ATTEMPT')).toEqual(expect.objectContaining({ lv: 9, count: 1 }));
    });

    test('emits CUT_ATTEMPT on cut', () => {
      document.dispatchEvent(new Event('cut'));

      expect(eventFor('CUT_ATTEMPT')).toEqual(expect.objectContaining({ lv: 7 }));
    });
  });

  describe('keyboard events', () => {
    test('emits SUSPICIOUS_KEY_PRESS for Ctrl+C', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));

      expect(eventFor('SUSPICIOUS_KEY_PRESS')).toEqual(expect.objectContaining({
        lv: 6,
        key: 'Ctrl+C',
      }));
    });

    test('emits SUSPICIOUS_KEY_PRESS for F12', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));

      expect(eventFor('SUSPICIOUS_KEY_PRESS')).toEqual(expect.objectContaining({ key: 'F12' }));
    });

    test('does not emit for regular key presses', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

      expect(emittedEvents()).not.toContain('SUSPICIOUS_KEY_PRESS');
    });
  });

  describe('context menu', () => {
    test('emits RIGHT_CLICK with coordinates', () => {
      document.dispatchEvent(new MouseEvent('contextmenu', { clientX: 10, clientY: 20 }));

      expect(eventFor('RIGHT_CLICK')).toEqual(expect.objectContaining({
        lv: 5,
        x: 10,
        y: 20,
        count: 1,
      }));
    });
  });

  describe('fullscreen events', () => {
    test('emits EXITED_FULLSCREEN when leaving fullscreen', () => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(eventFor('EXITED_FULLSCREEN')).toEqual(expect.objectContaining({ lv: 8 }));
    });

    test('emits ENTERED_FULLSCREEN when entering fullscreen', () => {
      Object.defineProperty(document, 'fullscreenElement', { value: {}, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(eventFor('ENTERED_FULLSCREEN')).toEqual(expect.objectContaining({ lv: 1 }));
    });
  });

  describe('mouse events', () => {
    test('emits MOUSE_LEFT_WINDOW on mouseleave', () => {
      window.dispatchEvent(new Event('mouseleave'));

      expect(eventFor('MOUSE_LEFT_WINDOW')).toEqual(expect.objectContaining({ lv: 4, count: 1 }));
    });

    test('emits MOUSE_ENTERED_WINDOW on mouseenter', () => {
      window.dispatchEvent(new Event('mouseenter'));

      expect(eventFor('MOUSE_ENTERED_WINDOW')).toEqual(expect.objectContaining({ lv: 1 }));
    });
  });

  describe('getState and getSummary', () => {
    test('getState returns the current state', () => {
      module.state.tabSwitchCount = 3;

      expect(module.getState().tabSwitchCount).toBe(3);
    });

    test('getSummary aggregates counters', () => {
      module.state.tabSwitchCount = 2;
      module.state.focusLossCount = 1;
      module.state.copyCount = 4;
      module.state.pasteCount = 1;

      const summary = module.getSummary();

      expect(summary.tabSwitches).toBe(2);
      expect(summary.focusLosses).toBe(1);
      expect(summary.copyAttempts).toBe(4);
      expect(summary.pasteAttempts).toBe(1);
      expect(summary.currentState).toEqual(expect.objectContaining({
        isVisible: expect.any(Boolean),
        isFocused: expect.any(Boolean),
      }));
    });
  });
});
