import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { CallStatus } from './types';
import { MinecraftButton } from './components/MinecraftButton';
import { StreamAudio } from './components/StreamAudio';
import { Mic, MicOff, Users, Copy, Radio, Signal } from 'lucide-react';
import { VolumeVisualizer } from './components/VolumeVisualizer';

// Hook to calculate volume for the visualizer
const useAudioLevel = (stream: MediaStream | null) => {
  const [volume, setVolume] = useState(0);
  const rafRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const ctxRef = useRef<AudioContext>();

  useEffect(() => {
    if (!stream) {
      setVolume(0);
      return;
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i=0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Normalize to 0-1 range roughly
      setVolume(Math.min(avg / 100, 1));
      rafRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) ctxRef.current.close();
    };
  }, [stream]);

  return volume;
};

const App: React.FC = () => {
  const { myId, myStream, connections, status, error, enableVoice, connectToFriend, disconnectFromFriend } = useWebRTC();
  const [friendIdInput, setFriendIdInput] = useState('');
  const [copied, setCopied] = useState(false);
  const myVolume = useAudioLevel(myStream);

  const copyToClipboard = () => {
    if (myId) {
      navigator.clipboard.writeText(myId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = () => {
    if (friendIdInput.trim()) {
      connectToFriend(friendIdInput.trim());
      setFriendIdInput('');
    }
  };

  // 1. Landing Screen (Permission Request)
  if (!myStream) {
    return (
      <div className="min-h-screen bg-dirt text-white flex flex-col items-center justify-center font-['VT323'] p-4 text-center select-none relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#000000a0_100%)]"></div>
        
        <div className="relative z-10 bg-[#000000aa] border-4 border-[#555] p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 backdrop-blur-sm animate-in zoom-in duration-300">
             <div className="space-y-2">
                 <h1 className="text-5xl text-white drop-shadow-[4px_4px_0_#000]">VOICE CHAT</h1>
                 <p className="text-[#aaa] text-xl">Enable microphone to join the server.</p>
             </div>
             
             {error && (
                <div className="bg-[#a12e2e] text-white p-3 border-2 border-[#ff6b6b] text-lg">
                    {error}
                </div>
             )}
             
             <MinecraftButton onClick={enableVoice} fullWidth disabled={status === CallStatus.CONNECTING}>
                {status === CallStatus.CONNECTING ? "Initializing..." : "Enable Microphone"}
             </MinecraftButton>
             
             <p className="text-[#666] text-lg">Permissions required for P2P audio.</p>
        </div>
      </div>
    );
  }

  // 2. Main Dashboard
  return (
    <div className="min-h-screen bg-dirt text-white flex flex-col font-['VT323'] relative overflow-hidden select-none">
      {/* Background Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#000000a0_100%)]"></div>

      {/* Header */}
      <header className="relative z-10 p-4 bg-[#000000aa] border-b-4 border-[#2b2b2b] flex items-center justify-center gap-4 shadow-lg">
        <h1 className="text-4xl text-[#fff] drop-shadow-[2px_2px_0_#3f3f3f]">
          MINECRAFT VOICE CHAT
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-10 relative z-10 p-4 gap-8 max-w-5xl mx-auto w-full">
        
        {/* Error Message Toast */}
        {error && (
           <div className="bg-[#a12e2e] text-white p-2 border-2 border-[#ff6b6b] animate-bounce absolute top-20 z-50 shadow-xl">
             Warning: {error}
           </div>
        )}

        {/* My Status Section */}
        <div className="w-full max-w-2xl bg-[#000000aa] border-2 border-[#555] p-6 flex flex-col gap-4 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between border-b-2 border-[#333] pb-2 mb-2">
            <h2 className="text-2xl text-[#aaa]">Server Status</h2>
            <div className="flex items-center gap-2 bg-[#00000055] px-3 py-1 rounded-full border border-[#333]">
              <div className={`w-3 h-3 rounded-full ${myId ? 'bg-green-500 shadow-[0_0_8px_#4ade80]' : 'bg-yellow-500 animate-pulse'}`}></div>
              <span className="text-gray-300">{myId ? "Online" : "Connecting..."}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#888] uppercase text-lg">Your Friend ID (Share this)</label>
            <div className="flex gap-2">
               <div className="flex-1 bg-[#000000] border-2 border-[#555] p-2 text-xl font-mono text-yellow-300 tracking-wider truncate flex items-center shadow-inner">
                 {myId || "Generating ID..."}
               </div>
               <MinecraftButton onClick={copyToClipboard} className="w-16 flex items-center justify-center">
                 {copied ? "OK!" : <Copy className="w-6 h-6" />}
               </MinecraftButton>
            </div>
          </div>
          
          <div className="mt-2">
            <label className="text-[#888] uppercase text-lg">Microphone Check</label>
            <VolumeVisualizer volume={myVolume} isActive={true} />
          </div>
        </div>

        {/* Connect Section */}
        <div className="w-full max-w-2xl bg-[#000000aa] border-2 border-[#555] p-6 flex flex-col gap-4 backdrop-blur-sm shadow-xl">
           <h2 className="text-2xl text-[#aaa] border-b-2 border-[#333] pb-2">Add Friend</h2>
           
           <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 flex flex-col gap-1 w-full">
                <label className="text-[#888]">Friend's ID</label>
                <input 
                  type="text" 
                  value={friendIdInput}
                  onChange={(e) => setFriendIdInput(e.target.value)}
                  placeholder="Paste Friend ID here..."
                  className="w-full bg-[#000000] text-white border-2 border-[#555] p-3 text-xl font-mono focus:border-[#aaa] focus:outline-none placeholder-gray-600 shadow-inner"
                />
              </div>
              <MinecraftButton variant="success" onClick={handleConnect} className="w-full md:w-auto">
                Connect
              </MinecraftButton>
           </div>
        </div>

        {/* Connected Friends List */}
        <div className="w-full max-w-2xl flex flex-col gap-2">
          <h2 className="text-2xl text-[#aaa] drop-shadow-md flex items-center gap-2">
            <Users className="w-6 h-6" /> Connected Players ({connections.length})
          </h2>
          
          {connections.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-[#444] text-[#666] bg-[#00000055]">
              No friends connected. Share your ID to start talking!
            </div>
          ) : (
            <div className="grid gap-2 animate-in fade-in duration-300">
              {connections.map((conn) => (
                <FriendRow key={conn.peerId} connection={conn} onDisconnect={() => disconnectFromFriend(conn.peerId)} />
              ))}
            </div>
          )}
        </div>

      </main>

      <footer className="text-center p-2 text-[#444] text-sm relative z-10">
        Peer-to-Peer Encrypted • No Server Logs • Pure Chaos
      </footer>
    </div>
  );
};

const FriendRow: React.FC<{ connection: any, onDisconnect: () => void }> = ({ connection, onDisconnect }) => {
  // We need to render the audio element for this connection
  const volume = useAudioLevel(connection.stream);

  return (
    <div className="bg-[#00000088] border-2 border-[#555] p-3 flex items-center justify-between hover:bg-[#000000aa] transition-colors shadow-lg">
      <StreamAudio stream={connection.stream} />
      
      <div className="flex items-center gap-4">
        {/* Head Icon */}
        <div className="w-12 h-12 bg-[#333] border-2 border-[#777] flex items-center justify-center shrink-0">
           <img 
             src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${connection.peerId}`} 
             alt="avatar" 
             className="w-10 h-10 image-pixelated"
           />
        </div>
        
        {/* Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-xl text-[#ddd] tracking-wide truncate">
             {connection.peerId.substring(0, 8)}...
          </span>
          <div className="flex items-center gap-2 text-sm">
             <Signal className={`w-4 h-4 ${volume > 0.05 ? 'text-green-400' : 'text-gray-600'}`} />
             <span className={volume > 0.05 ? 'text-green-400' : 'text-gray-600'}>
               {volume > 0.05 ? 'Talking' : 'Silent'}
             </span>
          </div>
        </div>
      </div>

      {/* Visualizer Mini */}
      <div className="flex items-center gap-3">
        <div className="w-24 h-4 bg-[#222] border border-[#444] hidden sm:block">
            <div 
            className="h-full bg-gradient-to-r from-green-800 to-green-500 transition-all duration-75"
            style={{ width: `${Math.min(volume * 150, 100)}%` }}
            />
        </div>

        <MinecraftButton variant="danger" onClick={onDisconnect} className="!h-10 !text-lg !px-4">
            Kick
        </MinecraftButton>
      </div>
    </div>
  );
};

export default App;