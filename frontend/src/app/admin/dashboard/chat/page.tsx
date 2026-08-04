'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users } from 'lucide-react';
import { connectSocket } from '@/lib/socket';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatMessage {
  id: string;
  text: string;
  senderType: 'DRIVER' | 'DISPATCHER';
  senderId: string;
  senderName: string;
  createdAt: string;
}

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get admin info from localStorage
  const adminInfo = typeof window !== 'undefined' ? localStorage.getItem('adminInfo') : null;
  const admin = adminInfo ? JSON.parse(adminInfo) : null;
  const adminId = admin?.id || 'dispatcher';
  const adminName = admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Диспетчер' : 'Диспетчер';

  // Fetch chat history
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/chat', { params: { limit: 200 } });
        setMessages(data.messages || []);
      } catch {}
      setLoading(false);
    };
    fetchMessages();
  }, []);

  // Socket listener for real-time messages
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('chat:join');

    const handleNewMessage = (message: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    socket.on('chat:message', handleNewMessage);
    return () => { socket.off('chat:message', handleNewMessage); };
  }, []);

  // Auto-scroll
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
        senderType: 'DISPATCHER',
        senderId: adminId,
        senderName: `📢 ${adminName}`,
      });
    } catch {
      try {
        await api.post('/chat', {
          text,
          senderType: 'DISPATCHER',
          senderId: adminId,
          senderName: `📢 ${adminName}`,
        });
      } catch {}
    } finally {
      setSending(false);
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  // Count unique drivers in chat
  const uniqueDrivers = new Set(messages.filter(m => m.senderType === 'DRIVER').map(m => m.senderId)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-red-400" />
            Чат
          </h1>
          <p className="text-muted-foreground text-sm">Бардык водителдер менен байланыш</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{uniqueDrivers} водитель</span>
        </div>
      </div>

      <Card className="h-[calc(100vh-240px)] flex flex-col">
        <CardHeader className="py-3 px-4 border-b border-border flex-shrink-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Жалпы чат — бардык водителдер жана диспетчерлер
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-16">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Билдирүүлөр жок</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isDispatcher = msg.senderType === 'DISPATCHER';
            const isMyMessage = msg.senderId === adminId && isDispatcher;

            // Show date separator
            const showDate = idx === 0 || formatDate(msg.createdAt) !== formatDate(messages[idx - 1].createdAt);

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="text-center my-3">
                    <span className="text-[10px] text-muted-foreground bg-muted px-3 py-0.5 rounded-full">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMyMessage
                      ? 'bg-blue-600/80 text-white rounded-br-md'
                      : isDispatcher
                        ? 'bg-blue-600/20 border border-blue-500/20 text-white rounded-bl-md'
                        : 'bg-white/5 border border-white/10 text-white rounded-bl-md'
                  }`}>
                    {!isMyMessage && (
                      <p className={`text-[11px] font-bold mb-1 ${
                        isDispatcher ? 'text-blue-400' : 'text-green-400'
                      }`}>
                        {msg.senderName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${isMyMessage ? 'text-white/50' : 'text-muted-foreground'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input area */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Диспетчер катары жазыңыз..."
              maxLength={500}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="icon"
              className="bg-red-600 hover:bg-red-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
