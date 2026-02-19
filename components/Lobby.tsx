import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Plus, Hash, Volume2 } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
}

interface LobbyProps {
  onJoinRoom: (roomId: string) => void;
  userDisplayName: string;
  activeRoomId: string;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoinRoom, userDisplayName, activeRoomId }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Room));
      setRooms(roomList);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        name: newRoomName,
        createdBy: userDisplayName,
        createdAt: serverTimestamp()
      });
      setNewRoomName('');
      setIsCreating(false);
      onJoinRoom(docRef.id);
    } catch (error) {
      console.error("Error creating room: ", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#2B2D31] text-[#949BA4]">
      {/* Header */}
      <div className="h-12 border-b border-[#1F2023] flex items-center px-4 shadow-sm bg-[#2B2D31]">
        <h2 className="font-bold text-[#F2F3F5] truncate">Voice Hangout</h2>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        
        {/* Category Header */}
        <div className="flex items-center justify-between px-2 pt-4 pb-1 group">
          <div className="flex items-center text-xs font-bold uppercase hover:text-[#DBDEE1] cursor-pointer transition-colors">
            <span className="mr-0.5">v</span>
            <span>Voice Channels</span>
          </div>
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="text-[#DBDEE1] hover:text-white cursor-pointer p-1 rounded hover:bg-[#3F4147]"
            title="Create Channel"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Create Room Input */}
        {isCreating && (
          <form onSubmit={handleCreateRoom} className="px-2 mb-2">
            <input
              autoFocus
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="new-channel"
              className="w-full bg-[#1E1F22] text-[#DBDEE1] text-sm rounded px-2 py-1 outline-none border border-transparent focus:border-blue-500"
              onBlur={() => !newRoomName && setIsCreating(false)}
            />
          </form>
        )}

        {/* Room List */}
        {rooms.map(room => {
          const isActive = activeRoomId === room.id;
          return (
            <div 
              key={room.id}
              onClick={() => onJoinRoom(room.id)}
              className={`group flex items-center px-2 py-1.5 rounded mx-2 cursor-pointer transition-colors ${isActive ? 'bg-[#404249] text-white' : 'hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}
            >
              <Volume2 className="w-5 h-5 mr-1.5 text-[#80848E] group-hover:text-[#DBDEE1]" />
              <span className={`font-medium truncate ${isActive ? 'text-white' : ''}`}>{room.name}</span>
            </div>
          );
        })}

        {rooms.length === 0 && !isCreating && (
          <div className="px-4 py-2 text-xs italic opacity-50">
            No channels yet.
          </div>
        )}
      </div>
    </div>
  );
};
