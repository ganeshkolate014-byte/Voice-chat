import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { PeerConnection, CallStatus } from '../types';

export const useWebRTC = () => {
  const [myId, setMyId] = useState<string>('');
  const [connections, setConnections] = useState<PeerConnection[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [isSignalConnected, setIsSignalConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const myStreamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      myStreamRef.current?.getTracks().forEach(track => track.stop());
      peerRef.current?.destroy();
    };
  }, []);

  const setupCallEventHandlers = (call: MediaConnection) => {
    call.on('stream', (remoteStream) => {
      setConnections(prev => {
        if (prev.find(c => c.peerId === call.peer)) return prev;
        return [...prev, { peerId: call.peer, stream: remoteStream, isMuted: false }];
      });
    });

    call.on('close', () => {
      setConnections(prev => prev.filter(c => c.peerId !== call.peer));
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      // Don't remove immediately on error, sometimes it recovers or is minor
      if (err.type === 'peer-unavailable') {
         setConnections(prev => prev.filter(c => c.peerId !== call.peer));
      }
    });
  };

  const enableVoice = useCallback(async () => {
    try {
      setError(null);
      setStatus(CallStatus.CONNECTING);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      myStreamRef.current = stream;
      setMyStream(stream);

      const peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        },
        debug: 1
      });
      
      peerRef.current = peer;

      peer.on('open', (id) => {
        setMyId(id);
        setIsSignalConnected(true);
        setStatus(CallStatus.CONNECTED);
      });

      peer.on('disconnected', () => {
        setIsSignalConnected(false);
        // Attempt reconnect
        peer.reconnect();
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
             setError('ID unavailable.');
        } else if (err.type === 'peer-unavailable') {
             setError('Friend ID not found. They might be offline.');
        } else if (err.type === 'network') {
             setError('Network error. Retrying...');
        } else {
             setError('Connection error: ' + (err.message || 'Unknown'));
        }
      });

      peer.on('call', (call) => {
        console.log('Incoming call from:', call.peer);
        call.answer(stream); 
        setupCallEventHandlers(call);
      });

    } catch (err: any) {
      console.error('Initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied.');
      } else {
        setError('Could not access microphone: ' + err.message);
      }
      setStatus(CallStatus.ERROR);
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (myStreamRef.current) {
      const audioTrack = myStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const connectToFriend = useCallback((friendId: string) => {
    if (!peerRef.current || !myStreamRef.current) {
        setError("Voice not enabled. Click 'Start' first.");
        return;
    }

    if (!isSignalConnected) {
        setError("Lost connection to server. Please wait...");
        return;
    }
    
    // Normalize ID
    const targetId = friendId.trim();
    if (targetId === myId) return;

    if (connections.find(c => c.peerId === targetId)) {
        console.log("Already connected to", targetId);
        return;
    }

    try {
      console.log("Calling...", targetId);
      const call = peerRef.current.call(targetId, myStreamRef.current);
      if (call) {
         setupCallEventHandlers(call);
      } else {
         setError("Failed to initiate call.");
      }
    } catch (err) {
      console.error(err);
      setError('Failed to dial friend.');
    }
  }, [connections, myId, isSignalConnected]);

  const disconnectFromFriend = useCallback((friendId: string) => {
    setConnections(prev => prev.filter(c => c.peerId !== friendId));
    // Note: PeerJS MediaConnection.close() should be called if we tracked the connection object directly in the array
  }, []);

  const endAllCalls = useCallback(() => {
    setConnections([]);
    if (peerRef.current) {
        // Just destroy and recreate peer if needed, or loop connections and close.
        // For simple P2P mesh without full connection tracking map, we clear UI.
        // A reload is often the cleanest 'End Call' in simple P2P apps.
        window.location.reload(); 
    }
  }, []);

  return {
    myId,
    myStream,
    connections,
    status,
    error,
    isSignalConnected,
    isMuted,
    enableVoice,
    toggleMic,
    connectToFriend,
    disconnectFromFriend,
    endAllCalls
  };
};