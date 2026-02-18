import React, { useEffect, useState, useRef } from 'react';
import { database } from '../services/firebase';
import { ref, onValue, push, serverTimestamp, query, limitToLast } from 'firebase/database';
import { Button } from './Button';
import { Send, X, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  roomId: string;
  userDisplayName: string;
  onClose: () => void;
  isOpen: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, userDisplayName, onClose, isOpen }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isNewMessage, setIsNewMessage] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    const messagesRef = query(ref(database, `chats/${roomId}`), limitToLast(50));
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value,
        }));
        setMessages(messageList);
        if (!isOpen) {
            setIsNewMessage(true);
        }
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [roomId, isOpen]);

  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setIsNewMessage(false);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId) return;

    const messagesRef = ref(database, `chats/${roomId}`);
    await push(messagesRef, {
      text: newMessage,
      sender: userDisplayName,
      timestamp: serverTimestamp(),
    });

    setNewMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white border-l-[3px] border-black shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.2)] z-[60] flex flex-col transition-transform duration-300 transform">
      {/* Header */}
      <div className="bg-[#FDE047] p-4 border-b-[3px] border-black flex justify-between items-center">
        <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-black" />
            <h2 className="text-xl font-black uppercase tracking-tight">Squad Chat</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-black hover:text-[#FDE047] border-2 border-black rounded transition-colors">
            <X className="w-6 h-6" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f3f4f6]">
        {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10 font-medium italic">
                No messages yet. Start yapping.
            </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender === userDisplayName;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] border-2 border-black p-3 shadow-[4px_4px_0px_0px_#000] rounded-lg relative ${isMe ? 'bg-[#C4B5FD] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                 {!isMe && <div className="text-xs font-bold mb-1 underline">{msg.sender}</div>}
                 <p className="font-medium text-sm md:text-base leading-snug">{msg.text}</p>
              </div>
              <span className="text-[10px] font-bold text-gray-500 mt-1 uppercase">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t-[3px] border-black bg-white flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type something..."
          className="flex-1 border-[3px] border-black rounded-lg px-4 py-2 font-bold focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:font-normal"
        />
        <button 
            type="submit" 
            className="bg-black text-white p-3 rounded-lg border-[3px] border-black hover:bg-gray-800 active:scale-95 transition-transform"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};