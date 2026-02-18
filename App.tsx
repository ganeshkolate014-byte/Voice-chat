import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { Button } from './components/Button';
import { StreamAudio } from './components/StreamAudio';
import { Mic, Users, Copy, Link as LinkIcon, LogOut, ShieldCheck, Share2, Sparkles, Activity, Globe } from 'lucide-react';
import { VolumeVisualizer } from './components/VolumeVisualizer';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

// Helper hook for volume
const useAudioLevel = (stream: MediaStream | null) => {
  const [volume, setVolume] = useState(0);
  const rafRef = useRef<number>();
  const ctxRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();

  useEffect(() => {
    if (!stream) {
      setVolume(0);
      return;
    }
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
      // Smoothening
      const instantVolume = Math.min((sum / dataArray.length) / 100, 1);
      setVolume(prev => prev * 0.8 + instantVolume * 0.2); // Simple low-pass filter for smoothness
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { myId, myStream, connections, error, enableVoice, connectToFriend, disconnectFromFriend, isSignalConnected } = useWebRTC();
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [joinId, setJoinId] = useState('');
  const myVolume = useAudioLevel(myStream);

  // Check for invite link in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
      setJoinId(joinParam);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Generate Invite Link when ID is available
  useEffect(() => {
    if (myId) {
      const url = new URL(window.location.href);
      url.searchParams.set('join', myId);
      setInviteLink(url.toString());
      
      // Auto-join if pending
      if (joinId && isSignalConnected && myStream) {
         connectToFriend(joinId);
         const cleanUrl = new URL(window.location.href);
         cleanUrl.searchParams.delete('join');
         window.history.replaceState({}, '', cleanUrl.toString());
         setJoinId(''); // Clear pending
      }
    }
  }, [myId, joinId, isSignalConnected, myStream, connectToFriend]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert("Login failed");
    }
  };

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const shareLink = async () => {
    if (navigator.share && inviteLink) {
        try {
            await navigator.share({
                title: 'Join my Voice Chat',
                text: 'Click to join the call',
                url: inviteLink
            });
        } catch (e) { console.log("Share failed/cancelled"); }
    } else {
        copyLink();
    }
  };

  // --- LOADER ---
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse"></div>
           <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse delay-1000"></div>
        </div>

        <div className="glass-panel p-10 rounded-3xl shadow-2xl max-w-md w-full flex flex-col gap-8 items-center text-center border-t border-white/10 relative z-10">
          <div className="relative">
             <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full blur opacity-75"></div>
             <div className="relative bg-black p-4 rounded-full">
                <Sparkles className="w-8 h-8 text-violet-400" />
             </div>
          </div>
          
          <div className="space-y-2">
             <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
               Voice Sync
             </h1>
             <p className="text-white/60 text-lg">
               High-fidelity, low-latency audio rooms for your squad.
             </p>
          </div>

          <div className="w-full space-y-4">
             <Button onClick={handleLogin} variant="glow" fullWidth>
                <Globe className="w-5 h-5" />
                Continue with Google
             </Button>
          </div>
          
          {joinId && (
            <div className="text-sm bg-violet-500/20 text-violet-200 px-4 py-2 rounded-full border border-violet-500/30">
                🚀 Invite pending... login to join
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- PERMISSION SCREEN ---
  if (!myStream) {
    return (
      <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
         {/* Dynamic Pulse based on simulated volume for effect */}
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px] animate-pulse"></div>
         </div>

         <div className="glass-panel max-w-lg w-full p-10 rounded-3xl border border-white/10 flex flex-col gap-6 items-center animate-in zoom-in duration-300 relative z-10">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2">
             <Mic className="w-10 h-10 text-violet-400" />
           </div>
           
           <h2 className="text-3xl font-bold text-white">Microphone Access</h2>
           <p className="text-white/60 text-lg leading-relaxed">
             To provide spatial audio and noise cancellation, we need access to your microphone.
           </p>
           
           {error && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl w-full">
                ⚠️ {error}
             </div>
           )}
           
           <Button onClick={enableVoice} variant="primary" fullWidth className="mt-4 py-6 text-lg">
             Allow Access
           </Button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen mesh-bg text-white flex flex-col overflow-hidden relative">
      
      {/* --- DYNAMIC VOICE GRADIENT --- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 blur-[150px] transition-all duration-75 ease-out"
            style={{ 
                width: `${300 + (myVolume * 1000)}px`, 
                height: `${300 + (myVolume * 1000)}px`,
                opacity: 0.1 + (myVolume * 0.4) 
            }}
          />
          {/* Secondary reactive orb */}
          <div 
            className="absolute top-1/3 left-1/3 rounded-full bg-cyan-500 blur-[100px] transition-all duration-300 ease-out mix-blend-overlay"
            style={{ 
                width: `${200 + (myVolume * 500)}px`, 
                height: `${200 + (myVolume * 500)}px`,
                opacity: 0.1 + (myVolume * 0.3) 
            }}
          />
      </div>

      {/* Navbar */}
      <nav className="h-20 px-6 md:px-12 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
           <div className="relative">
              <div className={`w-3 h-3 rounded-full ${isSignalConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 animate-pulse'}`}></div>
              {isSignalConnected && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>}
           </div>
           <span className="font-bold text-xl tracking-tight">Voice Sync</span>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <img src={user.photoURL || ''} alt="User" className="w-6 h-6 rounded-full" />
              <span className="text-sm font-medium opacity-80">{user.displayName}</span>
           </div>
           <Button variant="ghost" onClick={() => signOut(auth)} className="!p-3 rounded-full">
             <LogOut className="w-5 h-5" />
           </Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: Controls & My Status */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           {/* My Card */}
           <div className="glass-panel rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex flex-col items-center gap-4">
                 <div className="relative">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl relative z-10">
                        <img src={user.photoURL || ''} alt="Me" className="w-full h-full object-cover" />
                    </div>
                    {/* Ring Visualizer for Self */}
                    <div 
                        className="absolute inset-0 rounded-3xl border-2 border-violet-500 transition-all duration-75 ease-out"
                        style={{ 
                            transform: `scale(${1 + myVolume * 0.3})`, 
                            opacity: myVolume > 0.01 ? 1 : 0 
                        }}
                    ></div>
                    <div 
                        className="absolute inset-0 rounded-3xl bg-violet-500 blur-xl transition-all duration-75 ease-out"
                        style={{ 
                            transform: `scale(${1 + myVolume * 0.5})`, 
                            opacity: myVolume > 0.01 ? 0.6 : 0 
                        }}
                    ></div>
                 </div>
                 
                 <div className="text-center">
                    <h2 className="text-xl font-bold">{user.displayName}</h2>
                    <p className="text-white/40 text-sm font-mono mt-1">ID: {myId?.substring(0,8)}</p>
                 </div>

                 <div className="w-full mt-2">
                    <div className="flex justify-between text-xs text-white/40 uppercase font-semibold mb-2">
                        <span>Mic Level</span>
                        <span>{Math.round(myVolume * 100)}%</span>
                    </div>
                    <VolumeVisualizer volume={myVolume} isActive={true} bars={20} />
                 </div>
              </div>
           </div>

           {/* Invite Section */}
           <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-violet-300 mb-2">
                  <Share2 className="w-5 h-5" />
                  <h3 className="font-semibold">Invite Friends</h3>
              </div>
              
              {myId ? (
                <div className="bg-black/30 p-1 rounded-xl flex items-center border border-white/5 pl-4 pr-1 py-1">
                   <div className="flex-1 truncate text-white/50 text-sm font-mono">
                      {inviteLink.replace(/^https?:\/\//, '')}
                   </div>
                   <div className="flex gap-1">
                     <Button variant="ghost" onClick={copyLink} className="!h-9 !px-3 rounded-lg hover:bg-white/10">
                         {copied ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                     </Button>
                     <Button variant="primary" onClick={shareLink} className="!h-9 !px-3 rounded-lg">
                         <Activity className="w-4 h-4" />
                     </Button>
                   </div>
                </div>
              ) : (
                <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl"></div>
              )}
              
              <div className="h-px bg-white/10 my-1"></div>
              
              <div className="flex gap-2">
                 <input 
                    placeholder="Or enter Friend ID..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') connectToFriend((e.target as HTMLInputElement).value);
                    }}
                 />
                 <Button variant="secondary" onClick={(e) => {
                      const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                      connectToFriend(input.value);
                 }}>
                    Join
                 </Button>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: Participants */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                 <Users className="w-6 h-6 text-violet-400" /> 
                 Room Members
                 <span className="bg-white/10 text-sm px-2 py-0.5 rounded-full text-white/60">{connections.length}</span>
              </h2>
           </div>

           {connections.length === 0 ? (
             <div className="flex-1 min-h-[400px] glass-panel rounded-3xl border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-center gap-6 p-8">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                   <LinkIcon className="w-10 h-10 text-white/20" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white/80">Room is empty</h3>
                  <p className="text-white/40 mt-2 max-w-xs mx-auto">Share your invite link to start a voice session with your friends.</p>
                </div>
                <Button variant="primary" onClick={shareLink}>Invite Others</Button>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max">
               {connections.map(conn => (
                 <ParticipantCard key={conn.peerId} connection={conn} onDisconnect={disconnectFromFriend} />
               ))}
             </div>
           )}
        </div>

      </main>

      {/* Floating Error Toast */}
      {error && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-bounce flex items-center gap-3">
            <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">!</span>
            {error}
         </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const ParticipantCard: React.FC<{ connection: any, onDisconnect: (id: string) => void }> = ({ connection, onDisconnect }) => {
  const vol = useAudioLevel(connection.stream);
  const isSpeaking = vol > 0.05;

  return (
    <div className={`glass-panel p-5 rounded-2xl transition-all duration-300 group hover:bg-white/10 ${isSpeaking ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.1)]' : 'border-white/10'}`}>
       <StreamAudio stream={connection.stream} />
       
       <div className="flex items-start justify-between mb-4">
          <div className="relative">
             <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${connection.peerId}&backgroundColor=1e293b`} alt="Avatar" className="w-full h-full" />
             </div>
             {/* Remote user speaking indicator */}
             <div 
                className="absolute inset-0 rounded-xl border-2 border-green-500 transition-all duration-75"
                style={{ 
                   transform: `scale(${1 + vol * 0.4})`, 
                   opacity: vol > 0.05 ? 1 : 0 
                }}
             />
          </div>
          
          <button 
             onClick={() => onDisconnect(connection.peerId)}
             className="text-white/20 hover:text-red-400 transition-colors p-1"
             title="Disconnect"
          >
             <LogOut className="w-4 h-4" />
          </button>
       </div>

       <div className="mb-3">
          <h4 className="font-bold text-lg truncate" title={connection.peerId}>
            {connection.peerId.substring(0, 12)}...
          </h4>
          <span className={`text-xs font-medium uppercase tracking-wider ${isSpeaking ? 'text-green-400' : 'text-white/30'}`}>
             {isSpeaking ? 'Speaking...' : 'Silent'}
          </span>
       </div>

       <VolumeVisualizer volume={vol} isActive={true} bars={12} />
    </div>
  );
};

export default App;