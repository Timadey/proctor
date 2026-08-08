import { AudioMonitoringModule } from '../src/modules/AudioMonitoringModule.js';

function createAnalyser({ frequencyValue = 0, timeValue = 128 } = {}) {
  return {
    frequencyBinCount: 1024,
    fftSize: 2048,
    smoothingTimeConstant: 0,
    getByteFrequencyData: (dataArray) => dataArray.fill(frequencyValue),
    getByteTimeDomainData: (dataArray) => dataArray.fill(timeValue),
  };
}

function createAlternatingAnalyser() {
  return {
    frequencyBinCount: 1024,
    fftSize: 2048,
    smoothingTimeConstant: 0,
    getByteFrequencyData: (dataArray) => dataArray.fill(4),
    getByteTimeDomainData: (dataArray) => {
      for (let i = 0; i < dataArray.length; i++) {
        dataArray[i] = i % 2 === 0 ? 128 : 129;
      }
    },
  };
}

describe('AudioMonitoringModule', () => {
  let module;
  let onEvent;
  let onStateChange;

  beforeEach(() => {
    onEvent = jest.fn();
    onStateChange = jest.fn();
    module = new AudioMonitoringModule({ onEvent, onStateChange });
  });

  describe('constructor', () => {
    test('applies default options', () => {
      expect(module.options.talkingThreshold).toBe(-40);
      expect(module.options.whisperThreshold).toBe(-55);
      expect(module.options.audioSampleInterval).toBe(100);
      expect(module.options.prolongedTalkingDuration).toBe(1000);
    });

    test('initializes state defaults', () => {
      const state = module.getState();

      expect(state.isTalking).toBe(false);
      expect(state.isWhispering).toBe(false);
      expect(state.currentAudioLevel).toBe(-100);
      expect(state.audioLevelHistory).toEqual([]);
    });
  });

  describe('updateOptions', () => {
    test('merges new options', () => {
      module.updateOptions({ talkingThreshold: -30 });

      expect(module.options.talkingThreshold).toBe(-30);
      expect(module.options.whisperThreshold).toBe(-55);
    });
  });

  describe('canEmitEvent', () => {
    test('throttles events within the interval', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      expect(module.canEmitEvent('TALKING_DETECTED')).toBe(true);
      expect(module.canEmitEvent('TALKING_DETECTED')).toBe(false);

      Date.now.mockReturnValue(1001001);
      expect(module.canEmitEvent('TALKING_DETECTED')).toBe(true);
    });
  });

  describe('emitEvent', () => {
    test('emits an event with metadata', () => {
      module.emitEvent('TALKING_DETECTED', 8, { duration: 100 });

      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        event: 'TALKING_DETECTED',
        lv: 8,
        duration: 100,
        ts: expect.any(Number),
      }));
    });

    test('respects throttling for repeated events', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);

      module.emitEvent('TALKING_DETECTED', 8);
      module.emitEvent('TALKING_DETECTED', 8);

      expect(onEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('processAudio', () => {
    test('does nothing without an analyser', () => {
      expect(() => module.processAudio()).not.toThrow();
    });

    test('detects talking from a loud audio signal', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.analyser = createAnalyser({ frequencyValue: 255, timeValue: 255 });
      module.state.isTalking = true;
      module.state.talkingStartTime = 2000000 - 2000;

      module.processAudio();

      expect(module.getState().isTalking).toBe(true);
      expect(module.getState().currentAudioLevel).toBeGreaterThan(module.options.talkingThreshold);
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        event: 'TALKING_DETECTED',
        lv: 8,
        detectionMethod: 'audio',
      }));
      expect(onStateChange).toHaveBeenCalled();
    });

    test('emits TALKING_EPISODE when talking ends', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.analyser = createAnalyser({ frequencyValue: 0, timeValue: 128 });
      module.state.isTalking = true;
      module.state.talkingStartTime = 2000000 - 2000;

      module.processAudio();

      expect(module.getState().isTalking).toBe(false);
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        event: 'TALKING_EPISODE',
        lv: 7,
        detectionMethod: 'audio',
      }));
    });

    test('detects whispering from a quiet signal', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.analyser = createAlternatingAnalyser();
      module.state.isWhispering = true;
      module.state.whisperingStartTime = 2000000 - 2000;

      module.processAudio();

      const state = module.getState();
      expect(state.isWhispering).toBe(true);
      expect(state.isTalking).toBe(false);
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        event: 'WHISPERING_DETECTED',
        lv: 7,
      }));
    });

    test('tracks silence duration', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.analyser = createAnalyser({ frequencyValue: 0, timeValue: 128 });
      module.state.lastSoundTime = 1990000;

      module.processAudio();

      expect(module.getState().silenceDuration).toBe(10000);
      expect(onEvent).not.toHaveBeenCalled();
    });

    test('keeps only the last 30 audio samples', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.analyser = createAnalyser({ frequencyValue: 255, timeValue: 255 });

      for (let i = 0; i < 40; i++) {
        module.processAudio();
      }

      expect(module.getState().audioLevelHistory.length).toBeLessThanOrEqual(30);
    });
  });

  describe('getAverageAudioLevel', () => {
    test('returns -100 when there is no history', () => {
      expect(module.getAverageAudioLevel()).toBe(-100);
    });

    test('averages stored levels', () => {
      module.state.audioLevelHistory = [
        { decibels: -40 }, { decibels: -50 }, { decibels: -60 },
      ];

      expect(module.getAverageAudioLevel()).toBe(-50);
    });
  });

  describe('getAudioStatistics', () => {
    test('returns computed statistics', () => {
      jest.spyOn(Date, 'now').mockReturnValue(2000000);
      module.state.sessionStartTime = 1000000;
      module.state.totalTalkingDuration = 5000;
      module.state.isTalking = true;

      const stats = module.getAudioStatistics();

      expect(stats.sessionDurationSeconds).toBe(1000);
      expect(stats.totalTalkingDuration).toBe(5000);
      expect(stats.talkingPercentage).toBeCloseTo(0.5, 5);
      expect(stats.isTalking).toBe(true);
    });
  });

  describe('state helpers', () => {
    test('isTalking and isWhispering reflect current state', () => {
      expect(module.isTalking()).toBe(false);
      expect(module.isWhispering()).toBe(false);

      module.state.isTalking = true;
      module.state.talkingStartTime = 123;

      expect(module.isTalking()).toBe(true);
      expect(module.getTalkingStartTime()).toBe(123);
    });
  });

  describe('start/stop', () => {
    test('start polls audio and stop clears the interval', () => {
      jest.useFakeTimers();
      module.isSetup = true;
      module.processAudio = jest.fn();
      module.start();

      expect(module.audioMonitorInterval).not.toBeNull();
      jest.advanceTimersByTime(500);
      expect(module.processAudio).toHaveBeenCalled();

      module.stop();
      expect(module.audioMonitorInterval).toBeNull();

      jest.useRealTimers();
    });

    test('start warns when the module is not set up', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      module.isSetup = false;

      module.start();

      expect(consoleWarn).toHaveBeenCalled();
      expect(module.audioMonitorInterval).toBeNull();
    });
  });

  describe('initialize', () => {
    test('sets up audio context and analyser on success', async () => {
      const analyser = createAnalyser();
      const audioContext = {
        createAnalyser: jest.fn(() => analyser),
        createMediaStreamSource: jest.fn(() => ({ connect: jest.fn() })),
      };
      const getUserMedia = jest.fn().mockResolvedValue({});

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia },
        configurable: true,
      });
      Object.defineProperty(window, 'AudioContext', {
        value: jest.fn(() => audioContext),
        configurable: true,
      });

      await module.initialize();

      expect(getUserMedia).toHaveBeenCalled();
      expect(module.isSetup).toBe(true);
      expect(module.analyser).toBe(analyser);
      expect(audioContext.createAnalyser).toHaveBeenCalled();
    });

    test('marks the module as not set up when access is denied', async () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const getUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'));

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia },
        configurable: true,
      });

      await module.initialize();

      expect(module.isSetup).toBe(false);
      expect(consoleWarn).toHaveBeenCalled();
    });
  });
});
