import React, { useEffect, useState, useRef } from 'react';
import { database } from '../services/firebase';
import { ref, onValue, push, serverTimestamp, query, limitToLast } from 'firebase/database';
import { Send, X, Hash, MessageSquare } from 'lucide-react';

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
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="w-[300px] flex flex-col bg-[#313338] border-l border-[#2B2D31] h-full">
      {/* Header */}
      <div className="h-12 border-b border-[#26272D] flex items-center justify-between px-4 shadow-sm bg-[#313338]">
        <div className="flex items-center gap-2 text-[#F2F3F5]">
            <Hash className="w-5 h-5 text-[#80848E]" />
            <span className="font-bold truncate">chat</span>
        </div>
        <button onClick={onClose} className="text-[#B5BAC1] hover:text-[#DBDEE1]">
            <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#1A1B1E] scrollbar-track-[#2B2D31]">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                <MessageSquare className="w-12 h-12 mb-2 text-[#4E5058]" />
                <p className="text-[#949BA4] text-sm">Welcome to the beginning of the #chat channel.</p>
            </div>
        )}
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const isSameSender = prevMsg && prevMsg.sender === msg.sender && (msg.timestamp - prevMsg.timestamp < 60000);
          
          return (
            <div key={msg.id} className={`group flex flex-col ${isSameSender ? 'mt-0.5' : 'mt-4'} hover:bg-[#2E3035] -mx-4 px-4 py-0.5`}>
              {!isSameSender && (
                  <div className="flex items-baseline gap-2 mb-1">
                      <div className="w-8 h-8 rounded-full bg-[#5865F2] flex-shrink-0 mr-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                          <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender}&backgroundColor=5865F2`} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-medium text-[#F2F3F5] hover:underline cursor-pointer">{msg.sender}</span>
                      <span className="text-xs text-[#949BA4] font-medium ml-1">
                          {new Date(msg.timestamp).toLocaleDateString()} at {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                  </div>
              )}
              
              <div className={`pl-[42px] min-w-0 ${isSameSender ? '-mt-1' : ''}`}>
                <p className="text-[#DBDEE1] whitespace-pre-wrap break-words leading-[1.375rem]">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#313338]">
        <form onSubmit={handleSendMessage} className="bg-[#383A40] rounded-lg px-4 py-2.5 flex items-center gap-2">
            <button type="button" className="text-[#B5BAC1] hover:text-[#DBDEE1] p-1 rounded-full hover:bg-[#404249] transition-colors">
                <div className="w-5 h-5 bg-[#B5BAC1] rounded-full flex items-center justify-center text-[#383A40] font-bold text-xs">+</div>
            </button>
            <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #chat`}
            className="flex-1 bg-transparent text-[#DBDEE1] placeholder-[#949BA4] outline-none font-medium"
            />
        </form>
      </div>
    </div>
  );
};
