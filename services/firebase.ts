import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase, ref, set, push, serverTimestamp, get, child, update, query, orderByChild, equalTo } from "firebase/database";
import { Room, RecentRoom } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyBzIkOrMI1gns2W9HVjvRZDVvab33Ts09Y",
  authDomain: "minecraft-voice-chat-80828.firebaseapp.com",
  projectId: "minecraft-voice-chat-80828",
  storageBucket: "minecraft-voice-chat-80828.firebasestorage.app",
  messagingSenderId: "1054732388896",
  appId: "1:1054732388896:web:cbc1f0f2bc727697e04a45",
  measurementId: "G-T7415DGT1B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const database = getDatabase(app);

// --- Room Services ---

export const createPermanentRoom = async (roomName: string, userId: string, hostPeerId: string): Promise<string> => {
  const roomsRef = ref(database, 'rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key as string;
  
  await set(newRoomRef, {
    name: roomName,
    createdBy: userId,
    hostPeerId: hostPeerId,
    createdAt: serverTimestamp()
  });

  return roomId;
};

export const updateRoomHost = async (roomId: string, newHostPeerId: string) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, {
    hostPeerId: newHostPeerId
  });
};

export const getRoomById = async (roomId: string): Promise<Room | null> => {
  const dbRef = ref(database);
  const snapshot = await get(child(dbRef, `rooms/${roomId}`));
  if (snapshot.exists()) {
    return { id: roomId, ...snapshot.val() };
  }
  return null;
};

export const getMyRooms = async (userId: string): Promise<Room[]> => {
    const roomsRef = query(ref(database, 'rooms'), orderByChild('createdBy'), equalTo(userId));
    const snapshot = await get(roomsRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([key, value]: [string, any]) => ({
            id: key,
            ...value
        }));
    }
    return [];
};

export const addToRecents = async (userId: string, roomId: string, roomName: string) => {
  const recentRef = ref(database, `users/${userId}/recentRooms/${roomId}`);
  await set(recentRef, {
    roomId,
    roomName,
    lastVisited: serverTimestamp()
  });
};

export const getRecents = async (userId: string): Promise<RecentRoom[]> => {
    const recentsRef = ref(database, `users/${userId}/recentRooms`);
    const snapshot = await get(recentsRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        // Sort by last visited desc
        return Object.values(data).sort((a: any, b: any) => b.lastVisited - a.lastVisited) as RecentRoom[];
    }
    return [];
};