'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { connectSocket } from '@/lib/socket';
import api from '@/lib/axios';

interface ChatMessage {
  id: string;
  text: string;
  senderType: 'DRIVER' | 'DISPATCHER';
  senderId: string;
  senderName: string;
  createdAt: string;
}

export default function DriverChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const driverInfo = typeof window !== 'undefined' ? localStorage.getItem('driverInfo') : null;
  const driver = driverInfo ? JSON.parse(driverInfo) : null;
  const myId = driver?.id || '';
  const myName = driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : 'Водитель';
  const myCallsign = driver?.callsign || '';

  // Fetch chat history
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/chat', { params: { limit: 100 } });
        setMessages(data.messages || []);
      } catch {
        // Ignore — chat might not have messages yet
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, []);

  // Socket listener for real-time messages
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('chat:join');

    const handleNewMessage = (message: ChatMessage) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    socket.on('chat:message', handleNewMessage);
    return () => { socket.off('chat:message', handleNewMessage); };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    const text = newMessage.trim();
    setNewMessage('');

    try {
      const socket = connectSocket();
      socket.emit('chat:send', {
        text,
        senderType: 'DRIVER',
        senderId: myId,
        senderName: myCallsign ? `${myName} (${myCallsign})` : myName,
      });
    } catch {
      // Fallback: send via REST
      try {
        await api.post('/chat', {
          text,
          senderType: 'DRIVER',
          senderId: myId,
          senderName: myCallsign ? `${myName} (${myCallsign})` : myName,
        });
      } catch {}
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-red-400" />
          <h1 className="font-bold text-base">Жалпы чат</h1>
          <span className="text-xs text-gray-500 ml-auto">{messages.length} билдирүү</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">Билдирүүлөр жок</p>
            <p className="text-xs text-gray-600 mt-1">Биринчи болуп жазыңыз!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          const isDispatcher = msg.senderType === 'DISPATCHER';

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                isMe
                  ? 'bg-red-600/80 text-white rounded-br-md'
                  : isDispatcher
                    ? 'bg-blue-600/30 border border-blue-500/30 text-white rounded-bl-md'
                    : 'bg-white/10 text-white rounded-bl-md'
              }`}>
                {/* Sender name (not shown for own messages) */}
                {!isMe && (
                  <p className={`text-[10px] font-bold mb-0.5 ${
                    isDispatcher ? 'text-blue-300' : 'text-green-300'
                  }`}>
                    {isDispatcher ? '📢 ' : ''}{msg.senderName}
                  </p>
                )}
                <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                <p className={`text-[9px] mt-1 ${isMe ? 'text-white/50' : 'text-gray-500'}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Билдирүү жазыңыз..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center transition-colors active:scale-95"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
