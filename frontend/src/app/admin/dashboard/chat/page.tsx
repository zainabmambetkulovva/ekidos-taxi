'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users, ArrowLeft, Search, Circle } from 'lucide-react';
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

interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderType: string;
  receiverId: string;
  receiverName: string;
  receiverType: string;
  conversationId: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  conversationId: string;
  lastMessage: DirectMessage;
  unreadCount: number;
  partnerId: string;
  partnerName: string;
  partnerType: string;
}

interface DriverItem {
  id: string;
  firstName: string;
  lastName: string;
  callsign: string | null;
  phone: string;
  status: string;
}

type ChatView = 'general' | 'conversations' | 'dm';

export default function AdminChatPage() {
  const [view, setView] = useState<ChatView>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string; type: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get admin info
  const adminInfo = typeof window !== 'undefined' ? localStorage.getItem('adminInfo') : null;
  const admin = adminInfo ? JSON.parse(adminInfo) : null;
  const adminId = admin?.id || 'dispatcher';
  const adminName = admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Диспетчер' : 'Диспетчер';

  // Fetch general chat messages
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

  // Fetch drivers list
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const { data } = await api.get('/drivers');
        setDrivers(data.drivers || data || []);
      } catch {}
    };
    fetchDrivers();
  }, []);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get('/dm/conversations', { params: { userId: adminId } });
        setConversations(data || []);
      } catch {}
    };
    fetchConversations();
    const iv = setInterval(fetchConversations, 15000);
    return () => clearInterval(iv);
  }, [adminId]);

  // Socket: general chat + DM
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('chat:join');
    socket.emit('dm:join', adminId);

    const handleNewMessage = (message: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handleDmMessage = (message: DirectMessage) => {
      setDmMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Update conversations list
      setConversations(prev => {
        const existing = prev.find(c => c.conversationId === message.conversationId);
        if (existing) {
          return prev.map(c =>
            c.conversationId === message.conversationId
              ? { ...c, lastMessage: message, unreadCount: message.receiverId === adminId ? c.unreadCount + 1 : c.unreadCount }
              : c
          );
        }
        // New conversation
        return [{
          conversationId: message.conversationId,
          lastMessage: message,
          unreadCount: message.receiverId === adminId ? 1 : 0,
          partnerId: message.senderId === adminId ? message.receiverId : message.senderId,
          partnerName: message.senderId === adminId ? message.receiverName : message.senderName,
          partnerType: message.senderId === adminId ? message.receiverType : message.senderType,
        }, ...prev];
      });
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('dm:message', handleDmMessage);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('dm:message', handleDmMessage);
    };
  }, [adminId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  // Open DM with a specific partner
  const openDm = async (partnerId: string, partnerName: string, partnerType: string) => {
    setSelectedPartner({ id: partnerId, name: partnerName, type: partnerType });
    setView('dm');
    setDmMessages([]);

    const conversationId = [adminId, partnerId].sort().join('_');
    try {
      const { data } = await api.get(`/dm/messages/${conversationId}`, { params: { limit: 100 } });
      setDmMessages(data.messages || []);
      // Mark as read
      await api.patch(`/dm/read/${conversationId}`, { userId: adminId });
      setConversations(prev =>
        prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c)
      );
    } catch {}
  };

  // Send general chat message
  const handleSendGeneral = async () => {
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
        await api.post('/chat', { text, senderType: 'DISPATCHER', senderId: adminId, senderName: `📢 ${adminName}` });
      } catch {}
    } finally {
      setSending(false);
    }
  };

  // Send DM
  const handleSendDm = async () => {
    if (!newMessage.trim() || sending || !selectedPartner) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const socket = connectSocket();
      socket.emit('dm:send', {
        text,
        senderId: adminId,
        senderName: `📢 ${adminName}`,
        senderType: 'DISPATCHER',
        receiverId: selectedPartner.id,
        receiverName: selectedPartner.name,
        receiverType: selectedPartner.type,
      });
    } catch {
      try {
        await api.post('/dm/send', {
          text,
          senderId: adminId,
          senderName: `📢 ${adminName}`,
          senderType: 'DISPATCHER',
          receiverId: selectedPartner.id,
          receiverName: selectedPartner.name,
          receiverType: selectedPartner.type,
        });
      } catch {}
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (view === 'dm') handleSendDm();
      else handleSendGeneral();
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

  // Filter drivers by search
  const filteredDrivers = drivers.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      d.firstName.toLowerCase().includes(q) ||
      d.lastName.toLowerCase().includes(q) ||
      (d.callsign || '').toLowerCase().includes(q) ||
      d.phone.includes(q)
    );
  });

  // Current DM messages filtered for selected partner
  const currentDmMessages = selectedPartner
    ? dmMessages.filter(m => m.conversationId === [adminId, selectedPartner.id].sort().join('_'))
    : [];

  const uniqueDrivers = new Set(messages.filter(m => m.senderType === 'DRIVER').map(m => m.senderId)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-red-400" />
            Чат
          </h1>
          <p className="text-muted-foreground text-sm">Жалпы чат жана жеке билдирүүлөр</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{uniqueDrivers} водитель</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={view === 'general' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('general')}
          className={view === 'general' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          <MessageCircle className="w-4 h-4 mr-1.5" />
          Жалпы чат
        </Button>
        <Button
          variant={view === 'conversations' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('conversations')}
          className={view === 'conversations' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          <Users className="w-4 h-4 mr-1.5" />
          Жеке билдирүүлөр
          {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
            </span>
          )}
        </Button>
      </div>

      {/* === GENERAL CHAT === */}
      {view === 'general' && (
        <Card className="h-[calc(100vh-300px)] flex flex-col">
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
                        <p className={`text-[11px] font-bold mb-1 ${isDispatcher ? 'text-blue-400' : 'text-green-400'}`}>
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
                onClick={handleSendGeneral}
                disabled={!newMessage.trim() || sending}
                size="icon"
                className="bg-red-600 hover:bg-red-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* === CONVERSATIONS LIST (DMs) === */}
      {view === 'conversations' && (
        <Card className="h-[calc(100vh-300px)] flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-border flex-shrink-0">
            <div className="space-y-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Водительге жеке жазуу
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Водитель издөө (аты, позывной, телефон)..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Existing conversations first */}
            {!searchQuery && conversations.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 py-1 font-semibold">Акыркы сүйлөшүүлөр</p>
                {conversations.map(conv => (
                  <button
                    key={conv.conversationId}
                    onClick={() => openDm(conv.partnerId, conv.partnerName, conv.partnerType)}
                    className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-green-400">
                        {conv.partnerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{conv.partnerName}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(conv.lastMessage.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage.text}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Driver list */}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 py-1 font-semibold">
              {searchQuery ? 'Издөө жыйынтыктары' : 'Бардык водителдер'}
            </p>
            {filteredDrivers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Водитель табылган жок</p>
            )}
            {filteredDrivers.map(driver => (
              <button
                key={driver.id}
                onClick={() => openDm(
                  driver.id,
                  `${driver.firstName} ${driver.lastName}${driver.callsign ? ` (${driver.callsign})` : ''}`,
                  'DRIVER'
                )}
                className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 relative">
                  <span className="text-sm font-bold text-green-400">
                    {driver.callsign || driver.firstName.charAt(0)}
                  </span>
                  {(driver.status === 'ONLINE' || driver.status === 'BUSY') && (
                    <Circle className="w-3 h-3 text-green-500 fill-green-500 absolute -bottom-0.5 -right-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{driver.firstName} {driver.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    {driver.callsign ? `Позывной: ${driver.callsign} • ` : ''}{driver.phone}
                  </p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* === DM CONVERSATION === */}
      {view === 'dm' && selectedPartner && (
        <Card className="h-[calc(100vh-300px)] flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={() => setView('conversations')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-xs font-bold text-green-400">
                  {selectedPartner.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{selectedPartner.name}</CardTitle>
                <p className="text-[11px] text-muted-foreground">Жеке билдирүү</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {currentDmMessages.length === 0 && (
              <div className="text-center py-16">
                <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">Билдирүүлөр жок</p>
                <p className="text-xs text-muted-foreground mt-1">Биринчи билдирүүнү жөнөтүңүз!</p>
              </div>
            )}

            {currentDmMessages.map((msg, idx) => {
              const isMe = msg.senderId === adminId;
              const showDate = idx === 0 || formatDate(msg.createdAt) !== formatDate(currentDmMessages[idx - 1].createdAt);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-3">
                      <span className="text-[10px] text-muted-foreground bg-muted px-3 py-0.5 rounded-full">
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? 'bg-blue-600/80 text-white rounded-br-md'
                        : 'bg-white/5 border border-white/10 text-white rounded-bl-md'
                    }`}>
                      <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-white/50' : 'text-muted-foreground'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`${selectedPartner.name} га жазуу...`}
                maxLength={500}
                className="flex-1"
                autoFocus
              />
              <Button
                onClick={handleSendDm}
                disabled={!newMessage.trim() || sending}
                size="icon"
                className="bg-red-600 hover:bg-red-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
