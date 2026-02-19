import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { StreamAudio } from './components/StreamAudio';
import { StreamVideo } from './components/StreamVideo';
import { Mic, MicOff, PhoneOff, Monitor, MonitorOff, Settings, Headphones, MessageSquare } from 'lucide-react';
import { VolumeVisualizer } from './components/VolumeVisualizer';
import { ChatWindow } from './components/ChatWindow';
import { Lobby } from './components/Lobby';
import { RoomService } from './services/roomService';

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
  const [displayName, setDisplayName] = useState<string>('');
  const [isNameSet, setIsNameSet] = useState(false);
  const { myId, myStream, connections, error, enableVoice, connectToFriend, disconnectFromFriend, isSignalConnected, isMuted, toggleMic, endAllCalls, toggleScreenShare, screenStream } = useWebRTC();
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState(true); // Default open in Discord layout

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    
    // Check local storage for name
    const storedName = localStorage.getItem('voice_sync_name');
    if (storedName) {
        setDisplayName(storedName);
        setIsNameSet(true);
        if (joinParam) setActiveRoomId(joinParam);
    }
  }, []);

  // Handle Room Joining/Leaving
  useEffect(() => {
    if (activeRoomId && myId && isNameSet) {
      // Join the room in Realtime DB
      RoomService.joinRoom(activeRoomId, myId, {
        displayName: displayName || 'Anon',
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}&backgroundColor=5865F2`
      });

      // Subscribe to participants
      const unsubscribe = RoomService.subscribeToParticipants(activeRoomId, (participants) => {
        participants.forEach(p => {
          if (p.peerId !== myId) {
            connectToFriend(p.peerId);
          }
        });
      });

      return () => {
        unsubscribe();
        RoomService.leaveRoom(activeRoomId, myId);
      };
    }
  }, [activeRoomId, myId, isNameSet, displayName, connectToFriend]);

  const handleSetName = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim()) {
        localStorage.setItem('voice_sync_name', displayName);
        setIsNameSet(true);
        const params = new URLSearchParams(window.location.search);
        const joinParam = params.get('join');
        if (joinParam) setActiveRoomId(joinParam);
    }
  };

  const handleLeaveRoom = () => {
    endAllCalls();
    setActiveRoomId('');
  };

  // --- NAME ENTRY SCREEN ---
  if (!isNameSet) {
    return (
      <div className="min-h-screen bg-[#313338] flex items-center justify-center p-6 text-[#DBDEE1]">
        <div className="bg-[#313338] p-8 rounded-md shadow-lg max-w-md w-full flex flex-col gap-6 items-center text-center">
          <div className="w-24 h-24 bg-[#5865F2] rounded-full flex items-center justify-center mb-2">
             <Headphones className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-2">
             <h1 className="text-2xl font-bold text-white">Welcome back!</h1>
             <p className="text-[#949BA4]">We're so excited to see you again!</p>
          </div>
          
          <form onSubmit={handleSetName} className="w-full space-y-4 text-left">
             <div>
                <label className="text-xs font-bold uppercase text-[#B5BAC1] mb-2 block">Display Name</label>
                <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#1E1F22] text-[#DBDEE1] p-2.5 rounded outline-none focus:ring-2 focus:ring-[#00A8FC]"
                    autoFocus
                />
             </div>
             <button type="submit" className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium py-2.5 rounded transition-colors" disabled={!displayName.trim()}>
                Continue
             </button>
          </form>
        </div>
      </div>
    );
  }

  // --- PERMISSION SCREEN ---
  if (!myStream) {
    return (
      <div className="min-h-screen bg-[#313338] flex items-center justify-center p-6 text-[#DBDEE1]">
         <div className="bg-[#313338] p-8 rounded-md shadow-lg max-w-lg w-full flex flex-col gap-6 items-center text-center">
           <div className="w-20 h-20 bg-[#5865F2] rounded-full flex items-center justify-center">
             <Mic className="w-10 h-10 text-white" />
           </div>
           <div className="space-y-2">
               <h2 className="text-2xl font-bold text-white">Microphone Access</h2>
               <p className="text-[#949BA4]">
                 We need access to your microphone to connect you to voice channels.
               </p>
           </div>
           {error && (
             <div className="bg-[#DA373C] text-white p-3 rounded w-full text-sm font-medium">
                {error}
             </div>
           )}
           <button onClick={enableVoice} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium py-3 rounded transition-colors text-lg">
             Enable Microphone
           </button>
        </div>
      </div>
    );
  }

  // --- MAIN LAYOUT ---
  return (
    <div className="flex h-screen bg-[#313338] overflow-hidden font-sans">
      
      {/* 1. SERVER RAIL (Leftmost) */}
      <div className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 flex-shrink-0">
         <div className="w-12 h-12 bg-[#5865F2] rounded-[16px] flex items-center justify-center text-white cursor-pointer hover:rounded-[12px] transition-all">
            <img src="https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Home" className="w-7 h-7" />
         </div>
         <div className="w-8 h-[2px] bg-[#35363C] rounded-lg my-1"></div>
         {/* Placeholder for other servers */}
         <div className="w-12 h-12 bg-[#313338] rounded-[24px] flex items-center justify-center text-[#23A559] hover:bg-[#23A559] hover:text-white cursor-pointer hover:rounded-[16px] transition-all group">
            <div className="font-medium text-2xl group-hover:text-white">+</div>
         </div>
      </div>

      {/* 2. CHANNEL SIDEBAR (Left) */}
      <div className="w-60 bg-[#2B2D31] flex flex-col flex-shrink-0">
         {/* Room List */}
         <Lobby 
            onJoinRoom={setActiveRoomId} 
            userDisplayName={displayName} 
            activeRoomId={activeRoomId} 
         />
         
         {/* User Bar (Bottom) */}
         <div className="h-[52px] bg-[#232428] px-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 hover:bg-[#3F4147] p-1 rounded cursor-pointer min-w-0">
               <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[#5865F2] overflow-hidden">
                     <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${displayName}&backgroundColor=5865F2`} alt="Me" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#23A559] rounded-full border-[2px] border-[#232428]"></div>
               </div>
               <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate max-w-[80px]">{displayName}</div>
                  <div className="text-[10px] text-[#B5BAC1] truncate">#{myId?.substring(0,4)}</div>
               </div>
            </div>
            <div className="flex items-center">
               <button onClick={toggleMic} className="p-1.5 hover:bg-[#3F4147] rounded text-[#F2F3F5]">
                  {isMuted ? <MicOff className="w-5 h-5 text-[#DA373C]" /> : <Mic className="w-5 h-5" />}
               </button>
               <button className="p-1.5 hover:bg-[#3F4147] rounded text-[#F2F3F5]">
                  <Headphones className="w-5 h-5" />
               </button>
               <button className="p-1.5 hover:bg-[#3F4147] rounded text-[#F2F3F5]">
                  <Settings className="w-5 h-5" />
               </button>
            </div>
         </div>
      </div>

      {/* 3. MAIN CONTENT AREA (Center) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#313338] relative">
         {/* Top Bar */}
         <div className="h-12 border-b border-[#26272D] flex items-center justify-between px-4 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-2 text-[#F2F3F5]">
               <div className="font-bold text-base">
                  {activeRoomId ? 'Voice Channel' : 'Friends'}
               </div>
               {activeRoomId && (
                  <span className="text-xs font-medium text-[#23A559] bg-[#23A559]/10 px-1.5 py-0.5 rounded">Connected</span>
               )}
            </div>
            <div className="flex items-center gap-4 text-[#B5BAC1]">
               <button onClick={() => setIsChatOpen(!isChatOpen)} className={`hover:text-[#DBDEE1] ${isChatOpen ? 'text-[#F2F3F5]' : ''}`}>
                  <MessageSquare className="w-6 h-6" />
               </button>
            </div>
         </div>

         {/* Stage / Grid */}
         <div className="flex-1 p-4 overflow-y-auto flex flex-wrap content-start gap-4 justify-center">
            {!activeRoomId ? (
               <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                  <div className="w-64 h-64 bg-[#2B2D31] rounded-full mb-6 flex items-center justify-center">
                     <div className="text-6xl">👋</div>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">No one's around to play with.</h2>
                  <p className="text-[#949BA4]">Select a voice channel on the left to start talking.</p>
               </div>
            ) : (
               <>
                  {/* My Tile */}
                  <div className="w-[300px] h-[200px] bg-black rounded-lg relative overflow-hidden group border border-[#202225] shadow-sm">
                     {screenStream ? (
                        <StreamVideo stream={screenStream} />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#2B2D31]">
                           <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${displayName}&backgroundColor=5865F2`} alt="Me" className="w-20 h-20 rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                     )}
                     <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-white text-sm font-medium flex items-center gap-2">
                        {isMuted && <MicOff className="w-3 h-3 text-[#DA373C]" />}
                        {displayName} (You)
                     </div>
                     {screenStream && (
                        <div className="absolute top-2 right-2 bg-[#DA373C] text-white text-xs font-bold px-1.5 py-0.5 rounded uppercase">
                           LIVE
                        </div>
                     )}
                     <div className={`absolute inset-0 border-2 ${!isMuted && useAudioLevel(myStream) > 0.05 ? 'border-[#23A559]' : 'border-transparent'} rounded-lg pointer-events-none transition-colors`}></div>
                  </div>

                  {/* Remote Tiles */}
                  {connections.map(conn => (
                     <ParticipantCard key={conn.peerId} connection={conn} onDisconnect={disconnectFromFriend} />
                  ))}
               </>
            )}
         </div>

         {/* Call Controls (Floating at bottom center of main area) */}
         {activeRoomId && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#2B2D31] px-4 py-2 rounded-lg shadow-lg flex items-center gap-4 border border-[#1F2023]">
               <button 
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full transition-colors ${screenStream ? 'bg-[#F2F3F5] text-black' : 'bg-[#313338] text-[#F2F3F5] hover:bg-[#404249]'}`}
                  title="Share Screen"
               >
                  {screenStream ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
               </button>
               
               <button 
                  onClick={handleLeaveRoom}
                  className="p-3 rounded-full bg-[#DA373C] text-white hover:bg-[#A1282C] transition-colors"
                  title="Disconnect"
               >
                  <PhoneOff className="w-5 h-5" />
               </button>
            </div>
         )}
      </div>

      {/* 4. RIGHT SIDEBAR (Chat) */}
      {isChatOpen && activeRoomId && (
         <div className="w-[300px] flex-shrink-0 border-l border-[#26272D] bg-[#313338]">
            <ChatWindow 
               isOpen={true} 
               onClose={() => setIsChatOpen(false)} 
               roomId={activeRoomId} 
               userDisplayName={displayName} 
            />
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
    <div className={`w-[300px] h-[200px] bg-black rounded-lg relative overflow-hidden group border border-[#202225] shadow-sm ${connection.screenStream ? 'md:col-span-2 md:w-[600px] md:h-[400px]' : ''}`}>
       <StreamAudio stream={connection.stream} />
       
       {connection.screenStream ? (
          <StreamVideo stream={connection.screenStream} />
       ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#2B2D31]">
             <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${connection.peerId}&backgroundColor=5865F2`} alt="Avatar" className={`w-20 h-20 rounded-full transition-all ${isSpeaking ? 'ring-4 ring-[#23A559]' : 'opacity-50 group-hover:opacity-100'}`} />
          </div>
       )}

       <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-white text-sm font-medium flex items-center gap-2">
          {connection.peerId.substring(0, 8)}
       </div>

       {connection.screenStream && (
          <div className="absolute top-2 right-2 bg-[#DA373C] text-white text-xs font-bold px-1.5 py-0.5 rounded uppercase">
             LIVE
          </div>
       )}
       
       <div className={`absolute inset-0 border-2 ${isSpeaking ? 'border-[#23A559]' : 'border-transparent'} rounded-lg pointer-events-none transition-colors`}></div>
    </div>
  );
};

export default App;
