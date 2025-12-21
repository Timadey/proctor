/**
 * WebRTC Data Channel Setup Utilities
 * Provides helper functions for establishing WebRTC connections with data channels
 */

/**
 * Create an RTCPeerConnection with optimized configuration for proctoring
 * 
 * @param {Object} config - Configuration options
 * @returns {RTCPeerConnection}
 */
export const createPeerConnection = (config = {}) => {
  const defaultConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  return new RTCPeerConnection({ ...defaultConfig, ...config });
};

/**
 * Create a data channel optimized for real-time proctoring events
 * 
 * @param {RTCPeerConnection} peerConnection - Active peer connection
 * @param {string} label - Channel label (default: 'proctoring')
 * @returns {RTCDataChannel}
 */
export const createProctoringDataChannel = (
  peerConnection,
  label = 'proctoring'
) => {
  // Create data channel with low-latency configuration
  const dataChannel = peerConnection.createDataChannel(label, {
    ordered: false, // Allow out-of-order delivery for lowest latency
    maxRetransmits: 0, // Don't retransmit (UDP-like behavior)
    // Alternative: maxPacketLifeTime: 100, // Max 100ms lifetime
  });

  // Set up event handlers
  dataChannel.binaryType = 'arraybuffer';

  dataChannel.addEventListener('open', () => {
    console.log(`Data channel "${label}" opened`);
  });

  dataChannel.addEventListener('close', () => {
    console.log(`Data channel "${label}" closed`);
  });

  dataChannel.addEventListener('error', (error) => {
    console.error(`Data channel "${label}" error:`, error);
  });

  return dataChannel;
};

/**
 * Example: Full WebRTC setup for proctoring (caller side)
 * This would be used by the student's browser
 */
export const setupStudentPeerConnection = async (
  signalingCallback,
  onDataChannelReady
) => {
  const peerConnection = createPeerConnection();
  const dataChannel = createProctoringDataChannel(peerConnection);

  // Wait for data channel to open
  dataChannel.addEventListener('open', () => {
    if (onDataChannelReady) {
      onDataChannelReady(dataChannel);
    }
  });

  // Handle ICE candidates
  peerConnection.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      signalingCallback({
        type: 'ice-candidate',
        candidate: event.candidate,
      });
    }
  });

  // Create offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Send offer through signaling
  signalingCallback({
    type: 'offer',
    sdp: offer,
  });

  return { peerConnection, dataChannel };
};

/**
 * Example: Full WebRTC setup for proctoring (answerer side)
 * This would be used by the proctor's monitoring dashboard
 */
export const setupProctorPeerConnection = async (
  offer,
  signalingCallback,
  onDataChannelReady
) => {
  const peerConnection = createPeerConnection();

  // Listen for incoming data channel
  peerConnection.addEventListener('datachannel', (event) => {
    const dataChannel = event.channel;

    dataChannel.addEventListener('open', () => {
      console.log('Incoming data channel opened');
      if (onDataChannelReady) {
        onDataChannelReady(dataChannel);
      }
    });

    dataChannel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received proctoring event:', data);
      } catch (e) {
        console.log('Received non-JSON data:', event.data);
      }
    });
  });

  // Handle ICE candidates
  peerConnection.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      signalingCallback({
        type: 'ice-candidate',
        candidate: event.candidate,
      });
    }
  });

  // Set remote offer
  await peerConnection.setRemoteDescription(offer);

  // Create answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // Send answer through signaling
  signalingCallback({
    type: 'answer',
    sdp: answer,
  });

  return peerConnection;
};

/**
 * Mock signaling server for local testing
 * In production, replace with WebSocket or HTTP signaling
 */
export class MockSignalingServer {
  constructor() {
    this.peers = new Map();
    this.messageQueue = [];
  }

  register(peerId, callback) {
    this.peers.set(peerId, callback);

    // Deliver queued messages
    this.messageQueue
      .filter(msg => msg.to === peerId)
      .forEach(msg => callback(msg.data));

    this.messageQueue = this.messageQueue.filter(msg => msg.to !== peerId);
  }

  send(from, to, data) {
    const recipient = this.peers.get(to);
    if (recipient) {
      recipient(data);
    } else {
      this.messageQueue.push({ from, to, data });
    }
  }
}

/**
 * Example usage with React hook
 */
export const useWebRTCConnection = (role = 'student') => {
  const [dataChannel, setDataChannel] = React.useState(null);
  const [connectionState, setConnectionState] = React.useState('new');
  const peerConnectionRef = React.useRef(null);

  React.useEffect(() => {
    const setupConnection = async () => {
      if (role === 'student') {
        // Student initiates connection
        const signaling = (message) => {
          console.log('Signaling message:', message);
          // In production, send through WebSocket/HTTP
        };

        const { peerConnection, dataChannel: dc } = await setupStudentPeerConnection(
          signaling,
          (channel) => {
            setDataChannel(channel);
            setConnectionState('connected');
          }
        );

        peerConnectionRef.current = peerConnection;

        // Monitor connection state
        peerConnection.addEventListener('connectionstatechange', () => {
          setConnectionState(peerConnection.connectionState);
        });
      }
    };

    setupConnection();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [role]);

  return { dataChannel, connectionState };
};

/**
 * Utility: Send batched events to reduce overhead
 */
export class EventBatcher {
  constructor(onFlush, batchInterval = 1000) {
    this.onFlush = onFlush;
    this.batchInterval = batchInterval;
    this.eventQueue = [];
    this.flushTimer = null;
  }

  addEvent(event) {
    this.eventQueue.push(event);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }

  flush() {
    if (this.eventQueue.length === 0) return;

    const batch = {
      type: 'batch',
      events: this.eventQueue,
      ts: Date.now(),
    };

    if (this.onFlush) {
      this.onFlush(batch);
    }

    this.eventQueue = [];
    this.flushTimer = null;
  }

  destroy() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flush();
    }
  }
}

/**
 * Utility: Monitor data channel statistics
 */
export const monitorDataChannelStats = async (peerConnection) => {
  const stats = await peerConnection.getStats();
  const dataChannelStats = [];

  stats.forEach(report => {
    if (report.type === 'data-channel') {
      dataChannelStats.push({
        label: report.label,
        state: report.state,
        messagesSent: report.messagesSent,
        messagesReceived: report.messagesReceived,
        bytesSent: report.bytesSent,
        bytesReceived: report.bytesReceived,
      });
    }
  });

  return dataChannelStats;
};
