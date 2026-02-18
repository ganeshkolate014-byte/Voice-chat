import React, { useState, useEffect } from 'react';
import { db, database } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, set, onDisconnect, remove } from 'firebase/database';
import { Button } from './Button';
import { Plus, Users, ArrowRight, Loader2 } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
}

interface LobbyProps {
  onJoinRoom: (roomId: string) => void;
  userDisplayName: string;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoinRoom, userDisplayName }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        name: newRoomName,
        createdBy: userDisplayName,
        createdAt: serverTimestamp()
      });
      setNewRoomName('');
      onJoinRoom(docRef.id);
    } catch (error) {
      console.error("Error creating room: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="neo-card p-6 bg-white">
        <h2 className="text-2xl font-black uppercase mb-4 flex items-center gap-2">
          <Users className="w-6 h-6" /> Active Rooms
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
          {rooms.map(room => (
            <div key={room.id} className="border-2 border-black p-4 rounded-lg hover:bg-gray-50 transition-colors flex flex-col justify-between gap-4 shadow-[4px_4px_0px_0px_#000]">
              <div>
                <h3 className="font-bold text-lg truncate" title={room.name}>{room.name}</h3>
                <p className="text-xs text-gray-500 font-mono">Host: {room.createdBy}</p>
              </div>
              <Button onClick={() => onJoinRoom(room.id)} variant="primary" fullWidth className="!h-10 text-sm">
                JOIN ROOM <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ))}
          {rooms.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500 italic border-2 border-dashed border-gray-300 rounded-lg">
              No active rooms found. Create one to start!
            </div>
          )}
        </div>
      </div>

      <div className="neo-card p-6 bg-[#FFFBEB]">
        <h3 className="font-bold text-lg uppercase mb-2 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Create New Room
        </h3>
        <form onSubmit={handleCreateRoom} className="flex gap-2">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name..."
            className="flex-1 border-2 border-black rounded-lg px-4 py-2 font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-all"
            disabled={loading}
          />
          <Button type="submit" variant="glow" disabled={loading || !newRoomName.trim()} className="!w-auto px-6">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE'}
          </Button>
        </form>
      </div>
    </div>
  );
};
