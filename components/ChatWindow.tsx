import React, { useEffect, useState, useRef } from 'react';
import { database } from '../services/firebase';
import { ref, onValue, push, serverTimestamp, query, limitToLast } from 'firebase/database';
import { Send, X, MessageSquare, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatWindowProps {
  roomId: string;
  userDisplayName: string;
  onClose: () => void;
  isOpen: boolean;
  isGlobal?: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, userDisplayName, onClose, isOpen, isGlobal = false }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;

    const path = isGlobal ? 'chats/global' : `chats/${roomId}`;
    const messagesRef = query(ref(database, path), limitToLast(50));
    
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
  }, [roomId, isGlobal]);

  useEffect(() => {
    if (isOpen) {
        // Small delay to ensure content is rendered before scrolling
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId) return;

    const path = isGlobal ? 'chats/global' : `chats/${roomId}`;
    const messagesRef = ref(database, path);
    
    await push(messagesRef, {
      text: newMessage,
      sender: userDisplayName,
      timestamp: serverTimestamp(),
    });

    setNewMessage('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-[55] md:hidden"
          />
          
          {/* Drawer */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-96 bg-white border-l-[3px] border-black shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.2)] z-[60] flex flex-col"
          >
            {/* Header */}
            <div className={`p-4 border-b-[3px] border-black flex justify-between items-center ${isGlobal ? 'bg-[#A7F3D0]' : 'bg-[#FDE047]'}`}>
              <div className="flex items-center gap-2">
                  {isGlobal ? <Globe className="w-6 h-6 text-black" /> : <MessageSquare className="w-6 h-6 text-black" />}
                  <h2 className="text-xl font-black uppercase tracking-tight">{isGlobal ? 'Global Chat' : 'Squad Chat'}</h2>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-black hover:text-white border-2 border-black rounded transition-colors bg-white">
                  <X className="w-6 h-6" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f3f4f6]">
              {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-10 font-medium italic flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center border-2 border-black">
                        <MessageSquare className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>Quiet in here... say something!</p>
                  </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender === userDisplayName;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[85%] border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] rounded-xl relative ${isMe ? 'bg-[#C4B5FD] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                       {!isMe && <div className="text-[10px] font-black mb-1 uppercase tracking-wider text-purple-600">{msg.sender}</div>}
                       <p className="font-medium text-sm md:text-base leading-snug break-words">{msg.text}</p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase ml-1 mr-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </motion.div>
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
                placeholder={isGlobal ? "Message global lobby..." : "Message squad..."}
                className="flex-1 border-[3px] border-black rounded-lg px-4 py-3 font-bold focus:outline-none focus:border-black focus:shadow-[4px_4px_0px_0px_#000] transition-all placeholder:font-normal placeholder:text-gray-400"
              />
              <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit" 
                  className="bg-black text-white p-3 rounded-lg border-[3px] border-black hover:bg-gray-800"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};