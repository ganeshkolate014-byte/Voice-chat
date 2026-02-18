import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { PeerConnection, CallStatus } from '../types';

export const useWebRTC = () => {
  const [myId, setMyId] = useState<string>('');
  const [connections, setConnections] = useState<PeerConnection[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

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
      setConnections(prev => prev.filter(c => c.peerId !== call.peer));
    });
  };

  const enableVoice = useCallback(async () => {
    try {
      setError(null);
      setStatus(CallStatus.CONNECTING);
      
      // 1. Get Microphone Access (Must be triggered by user interaction)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      myStreamRef.current = stream;
      setMyStream(stream);

      // 2. Initialize PeerJS
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
        setMyId(id);
        setStatus(CallStatus.CONNECTED);
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
             setError('ID unavailable.');
        } else if (err.type === 'peer-unavailable') {
             setError('Friend ID not found.');
        } else if (err.type === 'network') {
             setError('Network error. Retrying...');
        } else {
             setError('Connection error: ' + (err.message || 'Unknown'));
        }
      });

      // 3. Handle Incoming Calls
      peer.on('call', (call) => {
        console.log('Incoming call from:', call.peer);
        call.answer(stream); 
        setupCallEventHandlers(call);
      });

    } catch (err: any) {
      console.error('Initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow access in browser settings.');
      } else {
        setError('Could not access microphone: ' + err.message);
      }
      setStatus(CallStatus.ERROR);
    }
  }, []);

  const connectToFriend = useCallback((friendId: string) => {
    if (!peerRef.current || !myStreamRef.current) {
        setError("Voice not enabled.");
        return;
    }
    
    // Check if already connected
    if (connections.find(c => c.peerId === friendId)) return;

    try {
      const call = peerRef.current.call(friendId, myStreamRef.current);
      setupCallEventHandlers(call);
    } catch (err) {
      setError('Failed to dial friend.');
    }
  }, [connections]);

  const disconnectFromFriend = useCallback((friendId: string) => {
    setConnections(prev => prev.filter(c => c.peerId !== friendId));
  }, []);

  return {
    myId,
    myStream,
    connections,
    status,
    error,
    enableVoice,
    connectToFriend,
    disconnectFromFriend
  };
};