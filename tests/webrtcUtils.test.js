import {
  createPeerConnection,
  createProctoringDataChannel,
  EventBatcher,
  MockSignalingServer,
  monitorDataChannelStats,
} from '../src/webrtcUtils.js';

describe('createPeerConnection', () => {
  let RTCPeerConnectionMock;

  beforeEach(() => {
    RTCPeerConnectionMock = jest.fn(() => ({}));
    global.RTCPeerConnection = RTCPeerConnectionMock;
  });

  afterEach(() => {
    delete global.RTCPeerConnection;
  });

  test('uses the default STUN config when none is provided', () => {
    createPeerConnection();

    expect(RTCPeerConnectionMock).toHaveBeenCalledWith(expect.objectContaining({
      iceServers: expect.arrayContaining([{ urls: 'stun:stun.l.google.com:19302' }]),
      iceCandidatePoolSize: 10,
    }));
  });

  test('merges custom config with defaults', () => {
    createPeerConnection({ iceCandidatePoolSize: 5 });

    expect(RTCPeerConnectionMock).toHaveBeenCalledWith(expect.objectContaining({
      iceCandidatePoolSize: 5,
      iceServers: expect.any(Array),
    }));
  });
});

describe('createProctoringDataChannel', () => {
  let peerConnection;
  let channel;

  beforeEach(() => {
    channel = {
      binaryType: '',
      addEventListener: jest.fn(),
    };
    peerConnection = {
      createDataChannel: jest.fn(() => channel),
    };
  });

  test('creates a data channel with low latency options', () => {
    createProctoringDataChannel(peerConnection);

    expect(peerConnection.createDataChannel).toHaveBeenCalledWith('proctoring', {
      ordered: false,
      maxRetransmits: 0,
    });
  });

  test('supports a custom label', () => {
    createProctoringDataChannel(peerConnection, 'exam');

    expect(peerConnection.createDataChannel).toHaveBeenCalledWith('exam', expect.any(Object));
  });

  test('configures binaryType and attaches event listeners', () => {
    createProctoringDataChannel(peerConnection);

    expect(channel.binaryType).toBe('arraybuffer');
    expect(channel.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
    expect(channel.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
    expect(channel.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

describe('MockSignalingServer', () => {
  test('delivers messages immediately to registered peers', () => {
    const server = new MockSignalingServer();
    const callback = jest.fn();

    server.register('student', callback);
    server.send('proctor', 'student', { type: 'offer' });

    expect(callback).toHaveBeenCalledWith({ type: 'offer' });
  });

  test('queues messages for unregistered peers and delivers on register', () => {
    const server = new MockSignalingServer();
    const callback = jest.fn();

    server.send('proctor', 'student', { type: 'offer' });

    expect(callback).not.toHaveBeenCalled();

    server.register('student', callback);

    expect(callback).toHaveBeenCalledWith({ type: 'offer' });
    expect(server.messageQueue).toEqual([]);
  });

  test('does not deliver queued messages to unrelated peers', () => {
    const server = new MockSignalingServer();

    server.send('proctor', 'student', { type: 'offer' });

    const unrelated = jest.fn();
    server.register('proctor', unrelated);

    expect(unrelated).not.toHaveBeenCalled();
  });
});

describe('EventBatcher', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not flush before the batch interval elapses', () => {
    const onFlush = jest.fn();
    const batcher = new EventBatcher(onFlush, 1000);

    batcher.addEvent({ event: 'A' });

    jest.advanceTimersByTime(999);
    expect(onFlush).not.toHaveBeenCalled();
  });

  test('flushes batched events after the interval', () => {
    const onFlush = jest.fn();
    const batcher = new EventBatcher(onFlush, 1000);

    batcher.addEvent({ event: 'A' });
    batcher.addEvent({ event: 'B' });

    jest.advanceTimersByTime(1000);

    expect(onFlush).toHaveBeenCalledTimes(1);
    const batch = onFlush.mock.calls[0][0];
    expect(batch).toEqual(expect.objectContaining({
      type: 'batch',
      events: [{ event: 'A' }, { event: 'B' }],
      ts: expect.any(Number),
    }));
  });

  test('schedules only one timer while events accumulate', () => {
    const onFlush = jest.fn();
    const batcher = new EventBatcher(onFlush, 1000);

    batcher.addEvent({ event: 'A' });
    batcher.addEvent({ event: 'B' });
    batcher.addEvent({ event: 'C' });

    jest.advanceTimersByTime(1000);

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].events).toHaveLength(3);
  });

  test('flush is a no-op when the queue is empty', () => {
    const onFlush = jest.fn();
    const batcher = new EventBatcher(onFlush, 1000);

    batcher.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });

  test('destroy flushes pending events', () => {
    const onFlush = jest.fn();
    const batcher = new EventBatcher(onFlush, 1000);

    batcher.addEvent({ event: 'A' });
    batcher.destroy();

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].events).toEqual([{ event: 'A' }]);
  });
});

describe('monitorDataChannelStats', () => {
  test('collects data channel statistics from getStats', async () => {
    const reports = new Map();
    reports.set('dc_1', {
      type: 'data-channel',
      label: 'proctoring',
      state: 'open',
      messagesSent: 10,
      messagesReceived: 5,
      bytesSent: 100,
      bytesReceived: 50,
    });
    reports.set('transport', { type: 'transport', state: 'connected' });

    const peerConnection = {
      getStats: jest.fn().mockResolvedValue(reports),
    };

    const stats = await monitorDataChannelStats(peerConnection);

    expect(stats).toHaveLength(1);
    expect(stats[0]).toEqual({
      label: 'proctoring',
      state: 'open',
      messagesSent: 10,
      messagesReceived: 5,
      bytesSent: 100,
      bytesReceived: 50,
    });
  });

  test('returns an empty array when there are no data channels', async () => {
    const peerConnection = {
      getStats: jest.fn().mockResolvedValue(new Map()),
    };

    expect(await monitorDataChannelStats(peerConnection)).toEqual([]);
  });
});
