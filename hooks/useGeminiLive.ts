import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../services/audioUtils';
import { ConnectionState, ChatMessage, Sender } from '../types';

export const useGeminiLive = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Playback Refs
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Refs
  const sessionRef = useRef<any>(null); // Holds the session promise or object

  const addMessage = useCallback((text: string, sender: Sender) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      text,
      sender,
      timestamp: new Date()
    }]);
  }, []);

  const disconnect = useCallback(() => {
    // Close session
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
         if(session.close) session.close();
      }).catch(() => {});
      sessionRef.current = null;
    }

    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop Audio Processing
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Stop Playback
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    // Clear Audio Sources
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();

    setConnectionState(ConnectionState.DISCONNECTED);
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found in environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Initialize Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime; // Reset timing

      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // Start Session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            addMessage("Connected to server! Speak to start.", Sender.SYSTEM);

            // Setup Input Processing
            const source = inputCtx.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(rms * 10, 1)); // Scale up a bit

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            // CRITICAL FIX: Do NOT connect processor to destination, or you will hear yourself!
            // processor.connect(inputCtx.destination); 
            // We only need the processor to run. In modern browsers, it might stop if not connected.
            // A workaround is to connect to a Gain node with 0 gain, then to destination.
            const muteNode = inputCtx.createGain();
            muteNode.gain.value = 0;
            processor.connect(muteNode);
            muteNode.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.turnComplete) {
               // Handle turn complete
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               if (outputAudioContextRef.current) {
                 const ctx = outputAudioContextRef.current;
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 
                 const audioBuffer = await decodeAudioData(
                   decode(base64Audio),
                   ctx,
                   24000,
                   1
                 );
                 
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(outputNode);
                 source.addEventListener('ended', () => {
                   audioSourcesRef.current.delete(source);
                 });
                 
                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += audioBuffer.duration;
                 audioSourcesRef.current.add(source);
               }
            }
            
            if (message.serverContent?.interrupted) {
               audioSourcesRef.current.forEach(s => s.stop());
               audioSourcesRef.current.clear();
               if(outputAudioContextRef.current) {
                 nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
               }
               addMessage("...interrupted...", Sender.MODEL);
            }
          },
          onclose: () => {
            setConnectionState(ConnectionState.DISCONNECTED);
            addMessage("Disconnected from server.", Sender.SYSTEM);
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection Error. Please try again.");
            setConnectionState(ConnectionState.ERROR);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
    }
  }, [addMessage]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
    messages,
    volume,
    error
  };
};