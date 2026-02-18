import { db, database } from './firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, remove, onDisconnect } from 'firebase/database';

export const RoomService = {
  // Join a room (Realtime DB for presence)
  joinRoom: async (roomId: string, peerId: string, userData: { displayName: string, photoURL: string }) => {
    const participantRef = ref(database, `rooms/${roomId}/participants/${peerId}`);
    
    // Set user data
    await set(participantRef, {
      ...userData,
      joinedAt: Date.now()
    });

    // Remove on disconnect
    onDisconnect(participantRef).remove();
  },

  // Leave a room
  leaveRoom: async (roomId: string, peerId: string) => {
    const participantRef = ref(database, `rooms/${roomId}/participants/${peerId}`);
    await remove(participantRef);
  },

  // Listen to participants
  subscribeToParticipants: (roomId: string, callback: (participants: any[]) => void) => {
    const participantsRef = ref(database, `rooms/${roomId}/participants`);
    return onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([key, value]: [string, any]) => ({
          peerId: key,
          ...value
        }));
        callback(list);
      } else {
        callback([]);
      }
    });
  }
};
