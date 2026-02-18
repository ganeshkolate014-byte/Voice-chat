
import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { Button } from './components/Button';
import { StreamAudio } from './components/StreamAudio';
import { Mic, MicOff, Users, Copy, LogOut, ShieldCheck, Share2, Sparkles, Activity, Globe, Zap, Radio, PhoneOff, MessageSquare, ArrowRight, DoorOpen, Home, Server, Hash, Plus, LayoutGrid, Play, Power, Layers } from 'lucide-react';
import { VolumeVisualizer } from './components/VolumeVisualizer';
import { auth, googleProvider, database } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ref, push, onValue, update, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { ChatWindow } from './components/ChatWindow';
import { ServerData } from './types';

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

type ViewState = 'BROWSE' | 'MY_SERVERS' | 'CREATE';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // App State: 'LOBBY' | 'ROOM'
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('BROWSE');
  
  // Data State
  const [servers, setServers] = useState<ServerData[]>([]);
  const [activeServerData, setActiveServerData] = useState<ServerData | null>(null);

  const { myId, myStream, connections, error, enableVoice, connectToFriend, disconnectFromFriend, isSignalConnected, isMuted, toggleMic, endAllCalls } = useWebRTC();
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const myVolume = useAudioLevel(myStream);

  // Form State
  const [newServerName, setNewServerName] = useState('');
  const [newServerDesc, setNewServerDesc] = useState('');
  const [newServerCategory, setNewServerCategory] = useState<'GAMING' | 'CASUAL'>('CASUAL');

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Persistent Servers
  useEffect(() => {
    const serversRef = ref(database, 'servers');
    const unsubscribe = onValue(serversRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const loadedServers: ServerData[] = Object.entries(data).map(([key, val]: [string, any]) => ({
                id: key,
                ...val
            }));
            // Sort: Online first, then by creation date
            loadedServers.sort((a, b) => {
                if (a.isOnline === b.isOnline) return b.createdAt - a.createdAt;
                return a.isOnline ? -1 : 1;
            });
            setServers(loadedServers);
        } else {
            setServers([]);
        }
    });
    return () => unsubscribe();
  }, []);

  // 3. Auto-Connect / Invite Logic
  useEffect(() => {
    if (isInRoom && myId && isSignalConnected && myStream) {
      // If we are hosting a persistent server, we must update its status in DB
      if (activeServerData && activeServerData.ownerId === user?.uid) {
          const serverRef = ref(database, `servers/${activeServerData.id}`);
          
          // Set Online
          update(serverRef, {
              isOnline: true,
              hostPeerId: myId
          });

          // Set Offline on Disconnect (Closing tab)
          onDisconnect(serverRef).update({
              isOnline: false
          });
      }

      // Generate Invite Link
      const url = new URL(window.location.href);
      // If active server, use server ID, else use Peer ID
      url.searchParams.set('join', activeServerData ? activeServerData.id : myId);
      setInviteLink(url.toString());
    }
  }, [isInRoom, myId, isSignalConnected, myStream, activeServerData, user]);


  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert("Login failed");
    }
  };

  const createServer = async () => {
      if (!newServerName.trim() || !user) return;

      const newServerRef = push(ref(database, 'servers'));
      const newServer: Partial<ServerData> = {
          name: newServerName,
          description: newServerDesc,
          ownerId: user.uid,
          ownerName: user.displayName || 'Anonymous',
          category: newServerCategory,
          createdAt: Date.now(),
          isOnline: false,
          hostPeerId: ''
      };

      await set(newServerRef, newServer);
      setNewServerName('');
      setNewServerDesc('');
      setCurrentView('MY_SERVERS');
  };

  const startServer = (server: ServerData) => {
      setActiveServerData(server);
      setIsInRoom(true);
  };

  const joinServer = (server: ServerData) => {
      if (!server.isOnline || !server.hostPeerId) {
          alert("This server is currently offline. Wait for the host to start it.");
          return;
      }
      setActiveServerData(server);
      setIsInRoom(true);
      // Give the system a moment to initialize media/peer before connecting
      setTimeout(() => {
          connectToFriend(server.hostPeerId);
      }, 1000);
  };

  const leaveRoom = async () => {
      // If I am the owner, mark offline
      if (activeServerData && activeServerData.ownerId === user?.uid) {
          const serverRef = ref(database, `servers/${activeServerData.id}`);
          await update(serverRef, { isOnline: false });
      }

      setIsInRoom(false);
      setActiveServerData(null);
      endAllCalls();
  };

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  // --- PERMISSION SCREEN (Only shown inside Room if stream missing) ---
  if (isInRoom && !myStream) {
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

  // --- VOICE ROOM (ACTIVE) ---
  if (isInRoom) {
      return (
        <div className="min-h-screen neo-bg text-black flex flex-col overflow-hidden relative">
          {/* Navbar */}
          <nav className="h-20 px-6 md:px-12 flex items-center justify-between border-b-[3px] border-black bg-white sticky top-0 z-40">
            <div className="flex items-center gap-4">
               <div className={`w-4 h-4 rounded-full border-2 border-black ${isSignalConnected ? 'bg-[#4ade80]' : 'bg-red-500 animate-pulse'}`}></div>
               <div className="flex flex-col">
                   <span className="font-black text-xl tracking-tighter leading-none">{activeServerData ? activeServerData.name : 'TEMPORARY ROOM'}</span>
                   {activeServerData && <span className="text-xs font-bold text-gray-500">HOST: {activeServerData.ownerName}</span>}
               </div>
               
               <div className="h-8 w-[2px] bg-gray-300 mx-2 hidden md:block"></div>
               <div className="bg-black text-white px-3 py-1 rounded text-xs font-bold font-mono hidden md:block">
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
                title="End Call"
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

          <ChatWindow 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            roomId={activeServerData ? activeServerData.id : (myId || 'temp')} 
            userDisplayName={user.displayName || 'Anon'} 
          />
        </div>
      );
  }

  // --- DASHBOARD (LOBBY) ---
  return (
    <div className="min-h-screen neo-bg flex text-black">
        {/* SIDEBAR */}
        <div className="w-20 md:w-64 bg-white border-r-[3px] border-black flex flex-col sticky top-0 h-screen z-20">
            <div className="h-20 flex items-center justify-center md:justify-start md:px-6 border-b-[3px] border-black">
                <div className="w-10 h-10 bg-[#FDE047] border-2 border-black rounded-lg flex items-center justify-center mr-0 md:mr-3 shadow-[2px_2px_0px_0px_#000]">
                    <Zap className="w-6 h-6 text-black fill-current" />
                </div>
                <span className="font-black text-xl tracking-tight hidden md:block">VOICE_SYNC</span>
            </div>

            <div className="flex-1 p-4 space-y-2">
                <SidebarItem 
                    icon={<LayoutGrid className="w-6 h-6" />} 
                    label="Browse Servers" 
                    active={currentView === 'BROWSE'}
                    onClick={() => setCurrentView('BROWSE')}
                />
                <SidebarItem 
                    icon={<Layers className="w-6 h-6" />} 
                    label="My Servers" 
                    active={currentView === 'MY_SERVERS'}
                    onClick={() => setCurrentView('MY_SERVERS')}
                />
                <div className="h-[2px] bg-gray-200 my-2 mx-2"></div>
                <SidebarItem 
                    icon={<Plus className="w-6 h-6" />} 
                    label="Create Server" 
                    active={currentView === 'CREATE'}
                    onClick={() => setCurrentView('CREATE')}
                />
            </div>

            <div className="p-4 border-t-[3px] border-black bg-gray-50">
                <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                     <div className="w-10 h-10 rounded-lg bg-white border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_#000]">
                        <img src={user.photoURL || ''} alt="User" className="w-full h-full" />
                     </div>
                     <div className="hidden md:block overflow-hidden">
                        <div className="font-bold text-sm truncate">{user.displayName}</div>
                        <div className="text-[10px] font-bold text-green-600">ONLINE</div>
                     </div>
                </div>
                <Button 
                    variant="secondary" 
                    onClick={() => signOut(auth)} 
                    fullWidth
                    className="!h-10 !text-sm"
                >
                    <LogOut className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">LOGOUT</span>
                </Button>
            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
            
            {/* VIEW: BROWSE SERVERS */}
            {currentView === 'BROWSE' && (
                <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-4xl md:text-5xl font-black uppercase">Browse Servers</h1>
                        <p className="text-xl font-medium text-gray-500">Join a persistent room or create your own.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {servers.map((server) => (
                            <div key={server.id} className="neo-card flex flex-col hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_#000] transition-all duration-300">
                                <div className={`h-24 border-b-[3px] border-black flex items-center justify-center ${server.category === 'GAMING' ? 'bg-[#C4B5FD]' : 'bg-[#A7F3D0]'}`}>
                                    {server.category === 'GAMING' ? <Activity className="w-10 h-10" /> : <Home className="w-10 h-10" />}
                                </div>
                                <div className="p-6 flex flex-col flex-1 gap-4">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-black text-xl uppercase leading-tight">{server.name}</h3>
                                            {server.isOnline ? (
                                                <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 border border-black rounded">LIVE</span>
                                            ) : (
                                                <span className="bg-gray-300 text-gray-600 text-[10px] font-bold px-2 py-0.5 border border-black rounded">OFFLINE</span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-gray-500 line-clamp-2">{server.description}</p>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="text-xs font-bold text-gray-400 mb-3 uppercase">Host: {server.ownerName}</div>
                                        <Button 
                                            variant={server.isOnline ? "primary" : "secondary"} 
                                            fullWidth 
                                            disabled={!server.isOnline}
                                            onClick={() => joinServer(server)}
                                        >
                                            {server.isOnline ? 'JOIN SERVER' : 'OFFLINE'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {servers.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-500 font-bold text-lg border-[3px] border-dashed border-gray-300 rounded-xl">
                                No active servers found. Be the first to create one!
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VIEW: MY SERVERS */}
            {currentView === 'MY_SERVERS' && (
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-4xl md:text-5xl font-black uppercase">My Servers</h1>
                        <p className="text-xl font-medium text-gray-500">Manage and start your owned servers.</p>
                    </div>

                    <div className="space-y-4">
                        {servers.filter(s => s.ownerId === user.uid).map(server => (
                             <div key={server.id} className="neo-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-white">
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 border-[3px] border-black rounded-lg flex items-center justify-center shadow-[2px_2px_0px_0px_#000] ${server.category === 'GAMING' ? 'bg-[#C4B5FD]' : 'bg-[#A7F3D0]'}`}>
                                        <Server className="w-8 h-8 text-black" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-2xl uppercase">{server.name}</h3>
                                        <p className="font-medium text-gray-500">{server.description}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-300">{server.category}</span>
                                            {server.isOnline && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">CURRENTLY LIVE</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <Button onClick={() => startServer(server)} variant="glow" className="flex-1 md:flex-none">
                                        <Play className="w-5 h-5 fill-current" /> START SERVER
                                    </Button>
                                </div>
                             </div>
                        ))}
                         {servers.filter(s => s.ownerId === user.uid).length === 0 && (
                            <div className="py-12 text-center flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                                    <Server className="w-8 h-8 text-gray-400" />
                                </div>
                                <div className="text-gray-500 font-bold text-lg">You haven't created any servers yet.</div>
                                <Button onClick={() => setCurrentView('CREATE')}>Create Your First Server</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VIEW: CREATE SERVER */}
            {currentView === 'CREATE' && (
                <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex flex-col gap-2">
                        <h1 className="text-4xl md:text-5xl font-black uppercase">Create Server</h1>
                        <p className="text-xl font-medium text-gray-500">Setup a permanent room for your community.</p>
                    </div>

                    <div className="neo-card p-8 bg-white flex flex-col gap-6">
                        <div className="space-y-2">
                            <label className="font-black uppercase text-sm ml-1">Server Name</label>
                            <input 
                                className="neo-input w-full h-12 px-4 text-lg" 
                                placeholder="e.g. Minecraft Late Night"
                                value={newServerName}
                                onChange={(e) => setNewServerName(e.target.value)}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="font-black uppercase text-sm ml-1">Description</label>
                            <input 
                                className="neo-input w-full h-12 px-4 text-lg" 
                                placeholder="What are we playing?"
                                value={newServerDesc}
                                onChange={(e) => setNewServerDesc(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="font-black uppercase text-sm ml-1">Category</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setNewServerCategory('GAMING')}
                                    className={`h-12 border-[3px] border-black rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${newServerCategory === 'GAMING' ? 'bg-[#C4B5FD] shadow-[2px_2px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    <Activity className="w-5 h-5" /> GAMING
                                </button>
                                <button 
                                    onClick={() => setNewServerCategory('CASUAL')}
                                    className={`h-12 border-[3px] border-black rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${newServerCategory === 'CASUAL' ? 'bg-[#A7F3D0] shadow-[2px_2px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    <Home className="w-5 h-5" /> CASUAL
                                </button>
                            </div>
                        </div>

                        <div className="h-4"></div>

                        <Button onClick={createServer} variant="primary" fullWidth className="h-14 text-lg">
                            PUBLISH SERVER
                        </Button>
                    </div>
                </div>
            )}

        </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full h-12 flex items-center px-4 rounded-lg font-bold transition-all border-2 ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-transparent hover:bg-gray-100'}`}
    >
        {React.cloneElement(icon as any, { className: `w-5 h-5 mr-3 ${active ? 'text-white' : 'text-black'}` })}
        <span className="hidden md:block">{label}</span>
    </button>
);

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
