import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { Button } from './components/Button';
import { StreamAudio } from './components/StreamAudio';
import { Mic, MicOff, Users, Copy, LogOut, ShieldCheck, Share2, Sparkles, Activity, Globe, Zap, Radio, PhoneOff, MessageSquare, Plus, Clock, Hash } from 'lucide-react';
import { VolumeVisualizer } from './components/VolumeVisualizer';
import { auth, googleProvider, createPermanentRoom, getRoomById, addToRecents, updateRoomHost, getMyRooms, getRecents } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ChatWindow } from './components/ChatWindow';
import { Room, RecentRoom } from './types';
import { onValue, ref } from 'firebase/database';
import { database } from './services/firebase';

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
  const { myId, myStream, connections, error, enableVoice, connectToFriend, disconnectFromFriend, isSignalConnected, isMuted, toggleMic, endAllCalls } = useWebRTC();
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const myVolume = useAudioLevel(myStream);

  // Room State
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [permanentRoomName, setPermanentRoomName] = useState<string>('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load Recents
  useEffect(() => {
    if (user) {
        const fetchRecents = () => {
            onValue(ref(database, `users/${user.uid}/recentRooms`), (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const sorted = Object.values(data).sort((a: any, b: any) => b.lastVisited - a.lastVisited) as RecentRoom[];
                    setRecentRooms(sorted);
                }
            });
        };
        fetchRecents();
    }
  }, [user]);

  // Handle URL params and Room Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    
    if (roomParam) setJoinRoomId(roomParam);
  }, []);

  // Update Host ID for my persistent rooms whenever my Peer ID changes
  useEffect(() => {
    if (user && myId && isSignalConnected) {
        const updateMyRooms = async () => {
            const myRooms = await getMyRooms(user.uid);
            myRooms.forEach(room => {
                updateRoomHost(room.id, myId);
            });
        };
        updateMyRooms();
    }
  }, [user, myId, isSignalConnected]);

  // Attempt to join room if URL param exists
  useEffect(() => {
    const joinRoom = async () => {
        if (joinRoomId && myId && isSignalConnected && myStream) {
            const room = await getRoomById(joinRoomId);
            if (room) {
                setActiveRoomId(room.id);
                setPermanentRoomName(room.name);
                
                // If I am not the host, connect to the host
                if (room.hostPeerId !== myId) {
                    connectToFriend(room.hostPeerId);
                }
                
                if (user) {
                   addToRecents(user.uid, room.id, room.name);
                }
                
                // Clear URL param to look cleaner
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('room');
                window.history.replaceState({}, '', cleanUrl.toString());
            } else {
                alert("Room not found or expired.");
            }
            setJoinRoomId('');
        }
    };
    joinRoom();
  }, [joinRoomId, myId, isSignalConnected, myStream, user, connectToFriend]);

  // Generate Invite Link
  useEffect(() => {
      const url = new URL(window.location.href);
      if (activeRoomId) {
          url.searchParams.set('room', activeRoomId);
      } else if (myId) {
          // Fallback to direct peer join if not in a permanent room
          // url.searchParams.set('join', myId); 
          // Actually, let's keep direct join hidden to encourage rooms, 
          // or construct a temporary link if needed.
          // For now, if no room active, no link shown in main box, 
          // or we create a temporary one.
      }
      setInviteLink(url.toString());
  }, [activeRoomId, myId]);


  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert("Login failed");
    }
  };

  const createRoom = async () => {
      if (!newRoomName.trim() || !user || !myId) return;
      
      try {
          const roomId = await createPermanentRoom(newRoomName, user.uid, myId);
          await addToRecents(user.uid, roomId, newRoomName);
          setActiveRoomId(roomId);
          setPermanentRoomName(newRoomName);
          setIsCreatingRoom(false);
          setNewRoomName('');
      } catch (e) {
          console.error(e);
          alert("Failed to create room");
      }
  };

  const joinRecent = async (room: RecentRoom) => {
      // Just set the ID, the effect hook will handle the connection logic
      // But wait, the effect hook relies on `joinRoomId` which comes from URL initially.
      // We need a direct function to "switch room"
      
      endAllCalls(); // Clear current
      const roomData = await getRoomById(room.roomId);
      
      if (roomData) {
          setActiveRoomId(roomData.id);
          setPermanentRoomName(roomData.name);
          addToRecents(user!.uid, roomData.id, roomData.name);
          
          if (roomData.hostPeerId !== myId) {
              connectToFriend(roomData.hostPeerId);
          } else {
              // I am the host, just update the record to ensure I'm live
              updateRoomHost(roomData.id, myId!);
          }
      } else {
          alert("Room unavailable");
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
                title: 'Voice Chat Invite',
                text: 'Join my voice room',
                url: inviteLink
            });
        } catch (e) { console.log("Share cancelled"); }
    } else {
        copyLink();
    }
  };

  // --- LOADER ---
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
        <div className="neo-card p-10 max-w-md w-full flex flex-col gap-8 items-center text-center relative">
          <div className="w-24 h-24 bg-[#FDE047] border-[3px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
             <Sparkles className="w-10 h-10 text-black" />
          </div>
          <div className="space-y-2">
             <h1 className="text-5xl font-black text-black tracking-tight">VOICE<br/>SYNC</h1>
             <p className="text-gray-600 text-lg font-medium border-2 border-black bg-white inline-block px-3 py-1 -rotate-2">
               Permanent Rooms & Voice Chat
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

  // --- PERMISSION SCREEN ---
  if (!myStream) {
    return (
      <div className="min-h-screen neo-bg flex flex-col items-center justify-center p-6 text-center">
         <div className="neo-card max-w-lg w-full p-12 flex flex-col gap-8 items-center relative">
           <div className="w-24 h-24 bg-[#FCA5A5] border-[3px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
             <Mic className="w-10 h-10 text-black" />
           </div>
           <div className="space-y-4">
               <h2 className="text-4xl font-black text-black uppercase">Mic Check</h2>
               <p className="text-black/70 text-lg font-medium">
                 Enable microphone to start creating or joining rooms.
               </p>
           </div>
           {error && (
             <div className="bg-red-100 border-2 border-red-500 text-red-600 p-4 rounded-xl w-full font-bold">
                ⚠️ {error}
             </div>
           )}
           <Button onClick={enableVoice} variant="glow" fullWidth className="h-16 text-xl">
             ENABLE MICROPHONE
           </Button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen neo-bg text-black flex flex-col overflow-hidden relative">

      {/* Navbar */}
      <nav className="h-20 px-6 md:px-12 flex items-center justify-between border-b-[3px] border-black bg-white sticky top-0 z-40">
        <div className="flex items-center gap-4">
           <div className={`w-4 h-4 rounded-full border-2 border-black ${isSignalConnected ? 'bg-[#4ade80]' : 'bg-red-500 animate-pulse'}`}></div>
           <span className="font-black text-2xl tracking-tighter hidden md:block">VOICE_SYNC</span>
           <span className="font-black text-xl tracking-tighter md:hidden">SYNC</span>
           {permanentRoomName && (
               <div className="hidden md:flex items-center gap-2 bg-[#FDE047] px-3 py-1 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] ml-4">
                   <Hash className="w-4 h-4" />
                   <span className="font-bold uppercase">{permanentRoomName}</span>
               </div>
           )}
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-3 pl-2 pr-4 py-2 bg-[#f3f4f6] border-2 border-black rounded-lg">
              <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded border-2 border-black bg-white" />
              <span className="text-sm font-bold">{user.displayName}</span>
           </div>
           <Button variant="danger" onClick={() => signOut(auth)} className="!h-10 !w-10 !p-0 !rounded-lg flex items-center justify-center">
             <LogOut className="w-5 h-5 ml-0.5" />
           </Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
        
        {/* LEFT COLUMN: Controls & My Status */}
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
                        {permanentRoomName ? `ROOM: ${permanentRoomName}` : 'NO ROOM'}
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

           {/* Create / Invite Section */}
           {activeRoomId ? (
                <div className="neo-card p-6 flex flex-col gap-4 bg-[#FFFBEB]">
                    <div className="flex items-center gap-3 border-b-2 border-black pb-3">
                        <div className="p-1.5 bg-black text-white rounded">
                            <Share2 className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg uppercase">Invite Squad</h3>
                    </div>
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
                    <p className="text-xs font-bold text-gray-500 text-center">Share this link to let friends join <span className="text-black bg-[#FDE047] px-1">{permanentRoomName}</span></p>
                </div>
           ) : (
                <div className="neo-card p-6 flex flex-col gap-4 bg-[#FFFBEB]">
                     <div className="flex items-center gap-3 border-b-2 border-black pb-3">
                        <div className="p-1.5 bg-black text-white rounded">
                            <Plus className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg uppercase">Create Room</h3>
                    </div>
                    
                    {!isCreatingRoom ? (
                        <Button onClick={() => setIsCreatingRoom(true)} variant="glow" fullWidth>
                            CREATE PERMANENT ROOM
                        </Button>
                    ) : (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                                autoFocus
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="Room Name (e.g. Minecraft Server)" 
                                className="neo-input p-2"
                                onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                            />
                            <div className="flex gap-2">
                                <Button onClick={() => setIsCreatingRoom(false)} variant="secondary" className="flex-1 !h-10 text-sm">Cancel</Button>
                                <Button onClick={createRoom} variant="primary" className="flex-1 !h-10 text-sm">Create</Button>
                            </div>
                        </div>
                    )}
                </div>
           )}

           {/* Recent Rooms List */}
           <div className="neo-card p-6 flex flex-col gap-4 bg-white">
                <div className="flex items-center gap-3 border-b-2 border-black pb-3">
                    <div className="p-1.5 bg-black text-white rounded">
                        <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg uppercase">Recent Rooms</h3>
                </div>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                    {recentRooms.length === 0 ? (
                        <div className="text-gray-400 text-center text-sm py-4 italic">No recent rooms</div>
                    ) : (
                        recentRooms.map(room => (
                            <button 
                                key={room.roomId}
                                onClick={() => joinRecent(room)}
                                className={`flex items-center justify-between p-3 border-2 border-black rounded-lg transition-all hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 text-left group ${activeRoomId === room.roomId ? 'bg-[#A7F3D0] shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000]'}`}
                            >
                                <span className="font-bold truncate max-w-[70%]">{room.roomName}</span>
                                <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">JOIN</span>
                            </button>
                        ))
                    )}
                </div>
           </div>
        </div>

        {/* RIGHT COLUMN: Participants */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black flex items-center gap-3">
                 <span className="w-10 h-10 bg-[#A7F3D0] border-2 border-black flex items-center justify-center rounded-lg shadow-[3px_3px_0px_0px_#000]">
                    <Users className="w-6 h-6 text-black" /> 
                 </span>
                 ROOM
                 <span className="ml-2 text-sm bg-black text-white px-3 py-1 rounded-full font-bold">{connections.length} ONLINE</span>
              </h2>
           </div>

           {connections.length === 0 ? (
             <div className="flex-1 min-h-[400px] neo-card border-dashed flex flex-col items-center justify-center text-center gap-6 p-12 bg-gray-50">
                <div className="w-24 h-24 rounded-full bg-white border-[3px] border-black flex items-center justify-center relative shadow-[6px_6px_0px_0px_#000]">
                   <Radio className="w-10 h-10 text-black/50" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase mb-1">Silence...</h3>
                  <p className="font-medium text-gray-500 max-w-sm mx-auto">
                      {activeRoomId ? "Waiting for squad members to join..." : "Create a room or select one from recents to start."}
                  </p>
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

      {/* Floating Control Bar (Mute, Cut, Chat) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border-[3px] border-black p-2 rounded-2xl shadow-[6px_6px_0px_0px_#000] z-50 flex items-center gap-4">
         <button 
            onClick={toggleMic}
            className={`w-14 h-14 rounded-xl border-2 border-black flex items-center justify-center transition-all active:scale-95 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-y-[3px] active:translate-x-[3px] ${isMuted ? 'bg-red-200' : 'bg-white hover:bg-gray-50'}`}
            title={isMuted ? "Unmute" : "Mute"}
         >
            {isMuted ? <MicOff className="w-6 h-6 text-red-600" /> : <Mic className="w-6 h-6 text-black" />}
         </button>

         <button 
            onClick={endAllCalls}
            className="w-16 h-16 rounded-xl border-2 border-black flex items-center justify-center bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-y-[3px] active:translate-x-[3px]"
            title="End Call (Cut)"
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

      {/* Chat Window Overlay */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        roomId={activeRoomId} 
        userDisplayName={user.displayName || 'Anon'} 
      />

      {/* Floating Error Toast */}
      {error && (
         <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-[#FECACA] border-[3px] border-black text-black px-6 py-4 rounded-xl shadow-[8px_8px_0px_0px_#000] z-[100] animate-bounce flex items-center gap-4">
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