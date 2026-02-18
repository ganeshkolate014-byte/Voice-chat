import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { Button } from './components/Button';
import { StreamAudio } from './components/StreamAudio';
import { Mic, MicOff, Users, Copy, LogOut, ShieldCheck, Share2, Sparkles, Activity, Globe, Zap, Radio, PhoneOff, MessageSquare, ArrowRight, DoorOpen, Home, Server, Hash } from 'lucide-react';
import { VolumeVisualizer } from './components/VolumeVisualizer';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ChatWindow } from './components/ChatWindow';

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
    analyser.fftSize = 128;
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
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
  
  // App State: 'LOBBY' | 'ROOM'
  const [isInRoom, setIsInRoom] = useState(false);
  
  const { myId, myStream, connections, error, enableVoice, connectToFriend, disconnectFromFriend, isSignalConnected, isMuted, toggleMic, endAllCalls } = useWebRTC();
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  
  // Join Logic
  const [joinId, setJoinId] = useState(''); // The actual ID to connect to
  const [manualJoinInput, setManualJoinInput] = useState(''); // Input field state
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const myVolume = useAudioLevel(myStream);

  // 1. Check for URL Join Param on Load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
        setManualJoinInput(joinParam);
    }
  }, []);

  // 2. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Auto-Connect Logic (Only runs when in ROOM and Signal is Ready)
  useEffect(() => {
    if (isInRoom && myId && isSignalConnected && myStream) {
      // Generate Invite Link
      const url = new URL(window.location.href);
      url.searchParams.set('join', myId);
      setInviteLink(url.toString());

      // Connect if joinId is present
      if (joinId) {
         console.log("Attempting to connect to:", joinId);
         connectToFriend(joinId);
         // Clean URL
         const cleanUrl = new URL(window.location.href);
         cleanUrl.searchParams.delete('join');
         window.history.replaceState({}, '', cleanUrl.toString());
         // Clear joinId to prevent re-connect loops
         setJoinId('');
      }
    }
  }, [isInRoom, myId, isSignalConnected, myStream, joinId, connectToFriend]);

  // Determine Active Room ID for Chat
  // If we joined someone, the room ID is THEIR id. If we are hosting, it's OUR id.
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  useEffect(() => {
      if (isInRoom) {
          if (joinId) setActiveRoomId(joinId);
          else if (myId && !activeRoomId) setActiveRoomId(myId);
      }
  }, [isInRoom, joinId, myId, activeRoomId]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert("Login failed");
    }
  };

  const enterRoom = (targetId?: string) => {
      if (targetId) setJoinId(targetId);
      setIsInRoom(true);
  };

  const leaveRoom = () => {
      setIsInRoom(false);
      endAllCalls(); // Cleanup WebRTC
      setJoinId('');
      // Optional: Reload to fully clear media stream state if needed, but endAllCalls does reload in current impl.
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
                title: 'Voice Chat Invite',
                text: 'Join my voice room',
                url: inviteLink
            });
        } catch (e) { console.log("Share cancelled"); }
    } else {
        copyLink();
    }
  };

  // --- LOADING SCREEN ---
  if (loading) return (
    <div className="min-h-screen bg-[#E0E7FF] flex items-center justify-center">
        <div className="neo-card p-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            <span className="font-bold text-xl">LOADING_ASSETS</span>
        </div>
    </div>
  );

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen neo-bg flex flex-col items-center justify-center p-6">
        <div className="neo-card p-10 max-w-md w-full flex flex-col gap-8 items-center text-center relative animate-in fade-in zoom-in duration-300">
          <div className="w-24 h-24 bg-[#FDE047] border-[3px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
             <Sparkles className="w-10 h-10 text-black" />
          </div>
          <div className="space-y-2">
             <h1 className="text-5xl font-black text-black tracking-tight">VOICE<br/>SYNC</h1>
             <p className="text-gray-600 text-lg font-medium border-2 border-black bg-white inline-block px-3 py-1 -rotate-2">
               Simple. Raw. Fast.
             </p>
          </div>
          <div className="w-full space-y-4">
             <Button onClick={handleLogin} variant="primary" fullWidth className="text-lg h-14">
                <Globe className="w-6 h-6" />
                CONNECT WITH GOOGLE
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOBBY SCREEN (Distinct Area) ---
  if (!isInRoom) {
      return (
        <div className="min-h-screen neo-bg flex flex-col p-6 relative">
            {/* Lobby Header */}
            <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-12 mt-4">
                <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-white border-[3px] border-black overflow-hidden shadow-[3px_3px_0px_0px_#000]">
                        <img src={user.photoURL || ''} alt="User" className="w-full h-full" />
                     </div>
                     <div>
                        <div className="font-black text-xl uppercase leading-none">{user.displayName}</div>
                        <div className="text-sm font-bold text-gray-500">LOBBY STATUS: IDLE</div>
                     </div>
                </div>
                <Button 
                    variant="secondary" 
                    onClick={() => signOut(auth)} 
                    className="!h-10 !w-10 !p-0 !rounded-lg flex items-center justify-center border-[3px]"
                >
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>

            {/* Lobby Content */}
            <div className="flex-1 w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                
                {/* Host Card */}
                <div className="neo-card p-8 flex flex-col gap-6 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000] transition-all duration-300">
                    <div className="w-16 h-16 bg-[#A7F3D0] border-[3px] border-black rounded-full flex items-center justify-center">
                        <Server className="w-8 h-8 text-black" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase mb-2">Host Server</h2>
                        <p className="font-medium text-gray-600">Create a new voice room and invite your squad via link.</p>
                    </div>
                    <Button onClick={() => enterRoom()} variant="primary" className="h-16 text-xl">
                        START SERVER <ArrowRight className="w-6 h-6" />
                    </Button>
                </div>

                {/* Join Card */}
                <div className="neo-card p-8 flex flex-col gap-6 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000] transition-all duration-300 bg-[#FFFBEB]">
                     <div className="w-16 h-16 bg-[#FDE047] border-[3px] border-black rounded-full flex items-center justify-center">
                        <Hash className="w-8 h-8 text-black" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black uppercase mb-2">Join Squad</h2>
                        <p className="font-medium text-gray-600">Enter a Room ID or paste an invite link to connect.</p>
                    </div>
                    
                    {/* Invite Detected State */}
                    {manualJoinInput && manualJoinInput.length > 5 ? (
                         <div className="bg-white border-[3px] border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_#000] flex flex-col gap-3">
                             <div className="flex items-center gap-2 font-bold text-green-600">
                                 <Zap className="w-5 h-5 fill-current" /> INVITE FOUND
                             </div>
                             <div className="font-mono text-sm bg-gray-100 p-2 rounded border-2 border-black truncate">
                                 {manualJoinInput}
                             </div>
                             <Button onClick={() => enterRoom(manualJoinInput)} variant="glow" fullWidth>
                                 ACCEPT & JOIN
                             </Button>
                         </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <input 
                                placeholder="Paste Room ID here..."
                                className="neo-input h-12 px-4 text-lg"
                                value={manualJoinInput}
                                onChange={(e) => setManualJoinInput(e.target.value)}
                            />
                            <Button 
                                onClick={() => enterRoom(manualJoinInput)} 
                                disabled={!manualJoinInput}
                                variant="secondary"
                                className="w-full"
                            >
                                CONNECT
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-12 text-center font-bold text-gray-400 uppercase tracking-widest text-sm">
                Voice Sync v2.0 • Secured P2P Connection
            </div>
        </div>
      );
  }

  // --- PERMISSION SCREEN (Only shown inside Room if stream missing) ---
  if (!myStream) {
    return (
      <div className="min-h-screen neo-bg flex flex-col items-center justify-center p-6 text-center">
         <div className="neo-card max-w-lg w-full p-12 flex flex-col gap-8 items-center relative animate-in zoom-in-95 duration-200">
           
           <div className="w-24 h-24 bg-[#FCA5A5] border-[3px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
             <Mic className="w-10 h-10 text-black" />
           </div>
           
           <div className="space-y-4">
               <h2 className="text-4xl font-black text-black uppercase">Mic Check</h2>
               <p className="text-black/70 text-lg font-medium">
                 We need your microphone to transmit audio.
               </p>
           </div>
           
           {error && (
             <div className="bg-red-100 border-2 border-red-500 text-red-600 p-4 rounded-xl w-full font-bold">
                ⚠️ {error}
             </div>
           )}
           
           <div className="flex flex-col gap-3 w-full">
                <Button onClick={enableVoice} variant="glow" fullWidth className="h-16 text-xl">
                    ENABLE MICROPHONE
                </Button>
                <button onClick={() => setIsInRoom(false)} className="font-bold underline text-sm hover:text-red-600">
                    Cancel & Return to Lobby
                </button>
           </div>
        </div>
      </div>
    );
  }

  // --- VOICE DASHBOARD (Main Room) ---
  return (
    <div className="min-h-screen neo-bg text-black flex flex-col overflow-hidden relative">

      {/* Navbar */}
      <nav className="h-20 px-6 md:px-12 flex items-center justify-between border-b-[3px] border-black bg-white sticky top-0 z-40">
        <div className="flex items-center gap-4">
           <div className={`w-4 h-4 rounded-full border-2 border-black ${isSignalConnected ? 'bg-[#4ade80]' : 'bg-red-500 animate-pulse'}`}></div>
           <span className="font-black text-2xl tracking-tighter hidden md:block">VOICE_SYNC</span>
           <span className="font-black text-xl tracking-tighter md:hidden">SYNC</span>
           
           <div className="h-8 w-[2px] bg-gray-300 mx-2"></div>
           <div className="bg-black text-white px-3 py-1 rounded text-xs font-bold font-mono">
               {connections.length + 1} ONLINE
           </div>
        </div>

        <div className="flex items-center gap-4">
           <Button variant="secondary" onClick={leaveRoom} className="!h-10 !px-4 !rounded-lg flex items-center justify-center !border-2 gap-2 text-sm">
             <DoorOpen className="w-4 h-4" /> LEAVE ROOM
           </Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
        
        {/* LEFT COLUMN: Me & Invite */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           {/* My Card */}
           <div className="neo-card p-6 flex flex-col gap-6 bg-white relative">
              <div className="flex flex-col items-center gap-4">
                 <div className="relative">
                    <div className="w-32 h-32 border-[3px] border-black rounded-2xl overflow-hidden bg-white shadow-[4px_4px_0px_0px_#000]">
                        <img src={user.photoURL || ''} alt="Me" className="w-full h-full object-cover" />
                    </div>
                    {/* Status Badge */}
                    <div className="absolute -bottom-3 -right-3 bg-[#C4B5FD] border-2 border-black px-2 py-1 text-xs font-bold rounded-md shadow-[2px_2px_0px_0px_#000]">
                        YOU
                    </div>
                    {isMuted && (
                        <div className="absolute top-2 left-2 bg-red-500 border-2 border-black text-white p-1 rounded">
                            <MicOff className="w-4 h-4" />
                        </div>
                    )}
                 </div>
                 
                 <div className="text-center w-full">
                    <h2 className="text-2xl font-black uppercase">{user.displayName}</h2>
                    <div className="inline-block bg-black text-white px-2 py-0.5 text-xs font-mono mt-1 rounded">
                        ID: {myId?.substring(0,8)}
                    </div>
                 </div>

                 <div className="w-full bg-[#f3f4f6] border-2 border-black rounded-lg p-4 mt-2">
                    <div className="flex justify-between text-xs font-bold uppercase mb-2">
                        <span>Mic Gain</span>
                        <span>{isMuted ? 'MUTED' : `${Math.round(myVolume * 100)}%`}</span>
                    </div>
                    <VolumeVisualizer volume={myVolume} isActive={!isMuted} bars={20} />
                 </div>
              </div>
           </div>

           {/* Invite Section */}
           <div className="neo-card p-6 flex flex-col gap-4 bg-[#FFFBEB]">
              <div className="flex items-center gap-3 border-b-2 border-black pb-3">
                  <div className="p-1.5 bg-black text-white rounded">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg uppercase">Invite Squad</h3>
              </div>
              
              {myId ? (
                <div className="flex gap-2">
                    <div className="flex-1 bg-white border-2 border-black rounded-lg p-2 font-mono text-sm truncate flex items-center px-3">
                        {inviteLink.replace(/^https?:\/\//, '')}
                    </div>
                     <Button variant="secondary" onClick={copyLink} className="!h-10 !w-10 !p-0 !rounded-lg !border-2">
                         {copied ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                     </Button>
                     <Button variant="primary" onClick={shareLink} className="!h-10 !w-10 !p-0 !rounded-lg !border-2">
                         <Activity className="w-5 h-5" />
                     </Button>
                </div>
              ) : (
                <div className="h-10 w-full bg-gray-200 animate-pulse rounded-lg border-2 border-gray-300"></div>
              )}
           </div>
        </div>

        {/* RIGHT COLUMN: Participants */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black flex items-center gap-3">
                 <span className="w-10 h-10 bg-[#A7F3D0] border-2 border-black flex items-center justify-center rounded-lg shadow-[3px_3px_0px_0px_#000]">
                    <Users className="w-6 h-6 text-black" /> 
                 </span>
                 SQUAD
              </h2>
           </div>

           {connections.length === 0 ? (
             <div className="flex-1 min-h-[400px] neo-card border-dashed flex flex-col items-center justify-center text-center gap-6 p-12 bg-gray-50">
                <div className="w-24 h-24 rounded-full bg-white border-[3px] border-black flex items-center justify-center relative shadow-[6px_6px_0px_0px_#000]">
                   <Radio className="w-10 h-10 text-black/50" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase mb-1">Silence...</h3>
                  <p className="font-medium text-gray-500 max-w-sm mx-auto">The room is empty. Share the invite link to start yapping.</p>
                </div>
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

      {/* Floating Control Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border-[3px] border-black p-2 rounded-2xl shadow-[6px_6px_0px_0px_#000] z-50 flex items-center gap-4 scale-90 md:scale-100">
         <button 
            onClick={toggleMic}
            className={`w-14 h-14 rounded-xl border-2 border-black flex items-center justify-center transition-all active:scale-95 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-y-[3px] active:translate-x-[3px] ${isMuted ? 'bg-red-200' : 'bg-white hover:bg-gray-50'}`}
            title={isMuted ? "Unmute" : "Mute"}
         >
            {isMuted ? <MicOff className="w-6 h-6 text-red-600" /> : <Mic className="w-6 h-6 text-black" />}
         </button>

         <button 
            onClick={leaveRoom}
            className="w-16 h-16 rounded-xl border-2 border-black flex items-center justify-center bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-y-[3px] active:translate-x-[3px]"
            title="End Call (Disconnect)"
         >
            <PhoneOff className="w-8 h-8 text-white fill-current" />
         </button>

         <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-14 h-14 rounded-xl border-2 border-black flex items-center justify-center transition-all active:scale-95 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-y-[3px] active:translate-x-[3px] ${isChatOpen ? 'bg-[#FDE047]' : 'bg-white hover:bg-gray-50'}`}
            title="Chat"
         >
            <MessageSquare className="w-6 h-6 text-black" />
         </button>
      </div>

      {/* Chat Overlay */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        roomId={activeRoomId} 
        userDisplayName={user.displayName || 'Anon'} 
      />

      {/* Error Toast */}
      {error && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#FECACA] border-[3px] border-black text-black px-6 py-4 rounded-xl shadow-[8px_8px_0px_0px_#000] z-[100] animate-bounce flex items-center gap-4">
            <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border border-black">!</span>
            <span className="font-bold">{error}</span>
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
    <div className={`neo-card p-6 transition-all duration-300 relative group ${isSpeaking ? 'bg-[#F0FDFA]' : ''}`}>
       <StreamAudio stream={connection.stream} />
       
       {isSpeaking && (
           <div className="absolute top-2 right-2 bg-[#34D399] border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase rounded shadow-[2px_2px_0px_0px_#000]">
               Speaking
           </div>
       )}

       <div className="flex items-start justify-between mb-4">
          <div className="relative">
             <div className="w-16 h-16 rounded-lg bg-gray-200 border-2 border-black overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${connection.peerId}&backgroundColor=fbbf24`} alt="Avatar" className="w-full h-full" />
             </div>
          </div>
          
          <button 
             onClick={() => onDisconnect(connection.peerId)}
             className="bg-white border-2 border-black text-black hover:bg-[#FCA5A5] transition-colors p-2 rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
             title="Kick / Disconnect"
          >
             <LogOut className="w-5 h-5" />
          </button>
       </div>

       <div className="mb-4">
          <h4 className="font-black text-xl truncate uppercase" title={connection.peerId}>
            {connection.peerId.substring(0, 12)}
          </h4>
          <span className="text-xs font-bold bg-black text-white px-2 py-0.5 rounded">
             REMOTE USER
          </span>
       </div>

       <div className="bg-white border-2 border-black rounded-lg p-2">
         <VolumeVisualizer volume={vol} isActive={true} bars={18} />
       </div>
    </div>
  );
};

export default App;