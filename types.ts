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

export interface Room {
  id: string;
  name: string;
  hostPeerId: string;
  createdBy: string;
  createdAt: number;
}

export interface RecentRoom {
  roomId: string;
  roomName: string;
  lastVisited: number;
}