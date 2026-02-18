
export interface PeerConnection {
  peerId: string;
  stream: MediaStream;
  isMuted: boolean;
}

export enum CallStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export enum Sender {
  USER = 'USER',
  MODEL = 'MODEL',
  SYSTEM = 'SYSTEM',
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
}

export interface ServerData {
  id: string;
  name: string;
  description: string;
  ownerId: string; // Firebase Auth UID of owner
  ownerName: string;
  hostPeerId: string; // The current P2P ID of the host (changes every session)
  isOnline: boolean;
  category: 'CASUAL' | 'GAMING' | 'MUSIC' | 'MEETING';
  createdAt: number;
}
