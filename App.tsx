import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { Button } from './components/Button';
import { StreamAudio } from './components/StreamAudio';
import { Mic, Users, Copy, Link as LinkIcon, LogOut, ShieldCheck, Share2, Sparkles, Activity, Globe, Zap } from 'lucide-react';
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
    analyser.fftSize = 128; // Lower fftSize for snappier reaction
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
      // More sensitive volume calculation
      const instantVolume = Math.min((sum / dataArray.length) / 80, 1.5); 
      setVolume(prev => prev * 0.7 + instantVolume * 0.3); 
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

  // --- LIQUID BACKGROUND COMPONENT ---
  const LiquidBackground = ({ intensity }: { intensity: number }) => {
    // Scale the blobs based on voice intensity
    const scale = 1 + (intensity * 0.8);
    const blurAmount = 80 - (intensity * 20); // Sharpen slightly when loud

    return (
      <div className="liquid-wrapper">
         <div 
            className="liquid-blob blob-1" 
            style={{ 
                transform: `scale(${scale}) translate(${intensity * 20}px, ${intensity * 20}px)`,
                filter: `blur(${blurAmount}px)`
            }} 
         />
         <div 
            className="liquid-blob blob-2" 
            style={{ 
                transform: `scale(${scale * 0.9}) translate(-${intensity * 30}px, -${intensity * 10}px)`,
                filter: `blur(${blurAmount}px)`
            }} 
         />
         <div 
            className="liquid-blob blob-3" 
            style={{ 
                transform: `scale(${scale * 1.1})`,
                opacity: 0.4 + (intensity * 0.4)
            }} 
         />
         {/* Noise overlay for texture */}
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }}></div>
      </div>
    );
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <LiquidBackground intensity={0.2} />

        <div className="glass-panel p-10 rounded-[2rem] shadow-2xl max-w-md w-full flex flex-col gap-8 items-center text-center border-t border-white/20 relative z-10 animate-in fade-in zoom-in duration-500">
          <div className="relative group">
             <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
             <div className="relative bg-black/80 backdrop-blur p-5 rounded-full border border-white/10">
                <Sparkles className="w-10 h-10 text-violet-400" />
             </div>
          </div>
          
          <div className="space-y-2">
             <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/40 tracking-tight">
               Liquid Voice
             </h1>
             <p className="text-white/60 text-lg font-light">
               Immersive, reactive voice rooms.
             </p>
          </div>

          <div className="w-full space-y-4">
             <Button onClick={handleLogin} variant="glow" fullWidth className="h-14 text-lg">
                <Globe className="w-5 h-5" />
                Connect with Google
             </Button>
          </div>
          
          {joinId && (
            <div className="text-sm bg-violet-500/20 text-violet-200 px-4 py-2 rounded-full border border-violet-500/30 flex items-center gap-2">
                <Zap className="w-4 h-4 fill-current" /> Invite accepted
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- PERMISSION SCREEN ---
  if (!myStream) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
         <LiquidBackground intensity={0.5} />

         <div className="glass-panel max-w-lg w-full p-12 rounded-[2.5rem] border border-white/10 flex flex-col gap-8 items-center animate-in zoom-in duration-300 relative z-10">
           <div className="relative">
              <div className="absolute inset-0 bg-violet-500 blur-[40px] opacity-30"></div>
              <Mic className="w-16 h-16 text-white relative z-10" />
           </div>
           
           <div className="space-y-4">
               <h2 className="text-4xl font-bold text-white tracking-tight">Enable Microphone</h2>
               <p className="text-white/50 text-xl font-light leading-relaxed">
                 We need access to your audio to visualize the liquid environment.
               </p>
           </div>
           
           {error && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl w-full text-sm font-medium">
                ⚠️ {error}
             </div>
           )}
           
           <Button onClick={enableVoice} variant="primary" fullWidth className="h-16 text-xl rounded-2xl shadow-[0_0_40px_rgba(124,58,237,0.3)]">
             Allow Access
           </Button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen text-white flex flex-col overflow-hidden relative">
      <LiquidBackground intensity={myVolume} />

      {/* Navbar */}
      <nav className="h-24 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 transition-all duration-300">
        <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-4">
           <div className="relative flex items-center justify-center">
              <div className={`w-3 h-3 rounded-full ${isSignalConnected ? 'bg-emerald-400 shadow-[0_0_15px_#34d399]' : 'bg-red-500 animate-pulse'}`}></div>
              {isSignalConnected && <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75 duration-1000"></div>}
           </div>
           <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Voice Sync</span>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-3 pl-2 pr-4 py-2 rounded-full glass-panel">
              <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-white/20" />
              <span className="text-sm font-medium opacity-90">{user.displayName}</span>
           </div>
           <Button variant="secondary" onClick={() => signOut(auth)} className="!w-12 !h-12 !p-0 rounded-full flex items-center justify-center">
             <LogOut className="w-5 h-5 ml-1" />
           </Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 pb-20">
        
        {/* LEFT COLUMN: Controls & My Status */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           {/* My Card */}
           <div className="glass-panel rounded-[2.5rem] p-8 relative overflow-hidden group">
              <div className="flex flex-col items-center gap-6">
                 <div className="relative">
                    <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white/5 shadow-2xl relative z-10 bg-black/50">
                        <img src={user.photoURL || ''} alt="Me" className="w-full h-full object-cover" />
                    </div>
                    {/* Liquid Ring Visualizer for Self */}
                    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-[180%] pointer-events-none opacity-60" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="25" fill="none" stroke="url(#gradient)" strokeWidth="1" className="animate-spin-slow">
                            <animate attributeName="r" values="25;30;25" dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
                         </circle>
                         <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                         </defs>
                    </svg>
                    
                    {/* Volume Pump Effect */}
                    <div 
                        className="absolute inset-0 bg-gradient-to-tr from-violet-500 to-fuchsia-500 blur-2xl rounded-full -z-10 transition-transform duration-75"
                        style={{ transform: `scale(${0.8 + myVolume})`, opacity: myVolume }}
                    ></div>
                 </div>
                 
                 <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold text-white">{user.displayName}</h2>
                    <p className="text-white/40 text-sm font-mono tracking-wider">ID: {myId?.substring(0,8)}</p>
                 </div>

                 <div className="w-full bg-white/5 rounded-2xl p-4 mt-2 border border-white/5">
                    <div className="flex justify-between text-xs text-white/40 uppercase font-bold tracking-widest mb-3">
                        <span>Mic Intensity</span>
                        <span>{Math.round(myVolume * 100)}%</span>
                    </div>
                    <VolumeVisualizer volume={myVolume} isActive={true} bars={24} />
                 </div>
              </div>
           </div>

           {/* Invite Section */}
           <div className="glass-panel rounded-[2rem] p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-white mb-2 pl-2">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg">Add Friends</h3>
              </div>
              
              {myId ? (
                <div className="bg-black/40 p-2 rounded-2xl flex items-center border border-white/10 pl-4">
                   <div className="flex-1 truncate text-white/70 text-sm font-mono select-all">
                      {inviteLink.replace(/^https?:\/\//, '')}
                   </div>
                   <div className="flex gap-1">
                     <Button variant="ghost" onClick={copyLink} className="!h-10 !w-10 !p-0 rounded-xl hover:bg-white/10">
                         {copied ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                     </Button>
                     <Button variant="primary" onClick={shareLink} className="!h-10 !w-10 !p-0 rounded-xl shadow-none">
                         <Activity className="w-5 h-5" />
                     </Button>
                   </div>
                </div>
              ) : (
                <div className="h-14 w-full bg-white/5 animate-pulse rounded-2xl"></div>
              )}
              
              <div className="flex gap-2 mt-2">
                 <input 
                    placeholder="Enter Friend ID..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-violet-500/50 transition-all"
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') connectToFriend((e.target as HTMLInputElement).value);
                    }}
                 />
                 <Button variant="secondary" className="!h-auto !px-6 rounded-xl" onClick={(e) => {
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
           <div className="flex items-center justify-between pl-2">
              <h2 className="text-3xl font-bold flex items-center gap-4 text-white">
                 <span className="p-2 bg-white/5 rounded-xl border border-white/5">
                    <Users className="w-6 h-6 text-violet-300" /> 
                 </span>
                 Session
                 <span className="bg-violet-600/20 text-violet-200 text-sm px-3 py-1 rounded-full border border-violet-500/30 font-medium">{connections.length} Active</span>
              </h2>
           </div>

           {connections.length === 0 ? (
             <div className="flex-1 min-h-[500px] glass-panel rounded-[2.5rem] border-dashed border-2 border-white/10 flex flex-col items-center justify-center text-center gap-8 p-12 group hover:border-white/20 transition-colors">
                <div className="relative">
                    <div className="absolute inset-0 bg-violet-500 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <div className="w-32 h-32 rounded-full bg-white/5 flex items-center justify-center relative z-10 border border-white/10">
                       <LinkIcon className="w-12 h-12 text-white/30" />
                    </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Room is empty</h3>
                  <p className="text-white/40 text-lg max-w-sm mx-auto leading-relaxed">The liquid void is quiet. Share your link to start the flow.</p>
                </div>
                <Button variant="primary" onClick={shareLink} className="h-14 px-8 text-lg rounded-2xl shadow-[0_0_30px_rgba(124,58,237,0.3)]">Invite Friends</Button>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max">
               {connections.map(conn => (
                 <ParticipantCard key={conn.peerId} connection={conn} onDisconnect={disconnectFromFriend} />
               ))}
             </div>
           )}
        </div>

      </main>

      {/* Floating Error Toast */}
      {error && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(220,38,38,0.5)] z-50 animate-bounce flex items-center gap-4 border border-white/10">
            <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">!</span>
            <span className="font-medium">{error}</span>
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
    <div className={`glass-panel p-6 rounded-[2rem] transition-all duration-500 group relative overflow-hidden ${isSpeaking ? 'bg-white/10 border-white/20' : ''}`}>
       <StreamAudio stream={connection.stream} />
       
       {/* Card Background Glow */}
       <div 
            className="absolute -right-20 -top-20 w-64 h-64 bg-violet-500/30 blur-[80px] rounded-full transition-opacity duration-500 pointer-events-none"
            style={{ opacity: isSpeaking ? 0.6 : 0 }}
       ></div>

       <div className="flex items-start justify-between mb-6 relative z-10">
          <div className="relative">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${connection.peerId}&backgroundColor=1e293b`} alt="Avatar" className="w-full h-full" />
             </div>
             {/* Remote user speaking indicator ring */}
             <div 
                className="absolute -inset-1 rounded-3xl border-2 border-emerald-400/50 transition-all duration-100 ease-out"
                style={{ 
                   transform: `scale(${1 + vol * 0.3})`, 
                   opacity: vol > 0.05 ? 1 : 0 
                }}
             />
          </div>
          
          <button 
             onClick={() => onDisconnect(connection.peerId)}
             className="text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all p-2 rounded-xl"
             title="Disconnect"
          >
             <LogOut className="w-5 h-5" />
          </button>
       </div>

       <div className="mb-4 relative z-10">
          <h4 className="font-bold text-xl truncate tracking-tight text-white" title={connection.peerId}>
            {connection.peerId.substring(0, 12)}...
          </h4>
          <span className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-1 ${isSpeaking ? 'text-emerald-400' : 'text-white/30'}`}>
             <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
             {isSpeaking ? 'Live Audio' : 'Silent'}
          </span>
       </div>

       <div className="bg-black/20 rounded-xl p-3 border border-white/5 relative z-10">
         <VolumeVisualizer volume={vol} isActive={true} bars={18} />
       </div>
    </div>
  );
};

export default App;