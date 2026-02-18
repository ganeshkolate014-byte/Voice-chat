import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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
