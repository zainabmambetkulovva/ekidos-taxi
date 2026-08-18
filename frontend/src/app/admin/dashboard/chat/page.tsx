'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users, Search, Circle, Hash } from 'lucide-react';
import { connectSocket } from '@/lib/socket';
import api from '@/lib/axios';
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

type ActiveChat = 'general' | string; // 'general' or driverId

// ====== PERSISTENCE: localStorage for messages ======
const DM_CACHE_PREFIX = 'ekidos_dm_v2_';
const GENERAL_CHAT_CACHE_KEY = DM_CACHE_PREFIX + 'general';
function saveConvMessages(convId: string, msgs: any[]) {
  try { localStorage.setItem(convId === 'general' ? GENERAL_CHAT_CACHE_KEY : DM_CACHE_PREFIX + convId, JSON.stringify(msgs)); } catch {}
}
function loadConvMessages(convId: string): any[] {
  try { 
    const key = convId === 'general' ? GENERAL_CHAT_CACHE_KEY : DM_CACHE_PREFIX + convId;
    const s = localStorage.getItem(key); 
    return s ? JSON.parse(s) : []; 
  } catch { return []; }
}
function saveDmMessages(convId: string, msgs: any[]) { saveConvMessages(convId, msgs); }
function loadDmMessages(convId: string): any[] { return loadConvMessages(convId); }

// Merge old + new without duplicates
function mergeDirectMessages(existing: DirectMessage[], incoming: DirectMessage[]): DirectMessage[] {
  const map = new Map<string, DirectMessage>();
  [...existing, ...incoming].forEach(m => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function mergeMessages<T extends { id: string; createdAt: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  [...existing, ...incoming].forEach(m => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function AdminChatPage() {
  const [activeChat, setActiveChat] = useState<ActiveChat>('general');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadConvMessages('general'));
  // Store DM messages per conversationId in localStorage
  const [convMessages, setConvMessages] = useState<Record<string, DirectMessage[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adminInfo = typeof window !== 'undefined' ? localStorage.getItem('adminInfo') : null;
  const admin = adminInfo ? JSON.parse(adminInfo) : null;
  const adminId = admin?.id || 'dispatcher';
  const adminName = admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Диспетчер' : 'Диспетчер';

  // Fetch general chat
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/chat', { params: { limit: 200 } });
        const fresh = data.messages || [];
        setMessages(prev => {
          const merged = mergeMessages(prev, fresh);
          saveConvMessages('general', merged);
          return merged;
        });
      } catch {}
    };
    fetchMessages();
  }, []);

  // Fetch drivers
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

  // Socket
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('chat:join');
    socket.emit('dm:join', adminId);

    socket.on('chat:message', (message: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        const next = [...prev, message];
        saveConvMessages('general', next);
        return next;
      });
    });

    socket.on('dm:message', (message: DirectMessage) => {
      const convId = message.conversationId;
      setConvMessages(prev => {
        const existing = prev[convId] || loadDmMessages(convId);
        if (existing.find(m => m.id === message.id)) return prev;
        const next = mergeDirectMessages(existing, [message]);
        saveDmMessages(convId, next);
        return { ...prev, [convId]: next };
      });
      setConversations(prev => {
        const existing = prev.find(c => c.conversationId === message.conversationId);
        if (existing) {
          return prev.map(c => c.conversationId === message.conversationId
            ? { ...c, lastMessage: message, unreadCount: message.receiverId === adminId ? c.unreadCount + 1 : c.unreadCount }
            : c
          );
        }
        return [{
          conversationId: message.conversationId,
          lastMessage: message,
          unreadCount: message.receiverId === adminId ? 1 : 0,
          partnerId: message.senderId === adminId ? message.receiverId : message.senderId,
          partnerName: message.senderId === adminId ? message.receiverName : message.senderName,
          partnerType: message.senderId === adminId ? message.receiverType : message.senderType,
        }, ...prev];
      });
    });

    return () => {
      socket.off('chat:message');
      socket.off('dm:message');
    };
  }, [adminId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, convMessages, activeChat]);

  // Open DM
  const openDm = async (driver: DriverItem) => {
    const name = `${driver.firstName} ${driver.lastName}`;
    setSelectedPartner({ id: driver.id, name });
    setActiveChat(driver.id);

    const conversationId = [adminId, driver.id].sort().join('_');
    
    // Load from localStorage first (instant)
    const cached = loadDmMessages(conversationId);
    if (cached.length) {
      setConvMessages(prev => ({ ...prev, [conversationId]: cached }));
    }
    
    // Fetch from server and merge
    try {
      const { data } = await api.get(`/dm/messages/${conversationId}`);
      const fresh = data.messages || [];
      setConvMessages(prev => {
        const existing = prev[conversationId] || cached;
        const merged = mergeDirectMessages(existing, fresh);
        saveDmMessages(conversationId, merged);
        return { ...prev, [conversationId]: merged };
      });
      await api.patch(`/dm/read/${conversationId}`, { userId: adminId });
      setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c));
    } catch {}
  };

  // Send general
  const handleSendGeneral = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    try {
      const socket = connectSocket();
      socket.emit('chat:send', { text, senderType: 'DISPATCHER', senderId: adminId, senderName: `📢 ${adminName}` });
    } catch {} finally { setSending(false); }
  };

  // Send DM
  const handleSendDm = async () => {
    if (!newMessage.trim() || sending || !selectedPartner) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    const conversationId = [adminId, selectedPartner.id].sort().join('_');
    const optimistic: DirectMessage = {
      id: `temp-${Date.now()}`, text,
      senderId: adminId, senderName: `📢 ${adminName}`, senderType: 'DISPATCHER',
      receiverId: selectedPartner.id, receiverName: selectedPartner.name, receiverType: 'DRIVER',
      conversationId,
      isRead: false, createdAt: new Date().toISOString(),
    };
    setConvMessages(prev => {
      const existing = prev[conversationId] || [];
      const next = [...existing, optimistic];
      saveDmMessages(conversationId, next);
      return { ...prev, [conversationId]: next };
    });
    try {
      const { data } = await api.post('/dm/send', {
        text, senderId: adminId, senderName: `📢 ${adminName}`, senderType: 'DISPATCHER',
        receiverId: selectedPartner.id, receiverName: selectedPartner.name, receiverType: 'DRIVER',
      });
      setConvMessages(prev => {
        const existing = prev[conversationId] || [];
        const next = existing.map(m => m.id === optimistic.id ? data : m);
        saveDmMessages(conversationId, next);
        return { ...prev, [conversationId]: next };
      });
    } catch {} finally { setSending(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      activeChat === 'general' ? handleSendGeneral() : handleSendDm();
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

  const filteredDrivers = drivers.filter(d => {
    const q = searchQuery.toLowerCase();
    return d.firstName.toLowerCase().includes(q) || d.lastName.toLowerCase().includes(q) ||
      (d.callsign || '').toLowerCase().includes(q) || d.phone.includes(q);
  });

  const currentDmMessages = selectedPartner
    ? (convMessages[[adminId, selectedPartner.id].sort().join('_')] || [])
    : [];

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex h-[calc(100vh-140px)] gap-0 rounded-xl overflow-hidden border border-border">

      {/* ── LEFT PANE: contacts ── */}
      <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-border bg-[#111827]">
        {/* Header */}
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-red-400" />
            Чат
            {totalUnread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{totalUnread}</span>
            )}
          </h2>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Издөө..."
              className="pl-8 h-8 text-xs bg-white/5 border-white/10"
            />
          </div>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto">
          {/* Group chat */}
          {!searchQuery && (
            <button
              onClick={() => setActiveChat('general')}
              className={`w-full text-left px-3 py-3 flex items-center gap-2.5 transition-all border-b border-border/30 ${
                activeChat === 'general' ? 'bg-red-600/20 border-l-2 border-l-red-500' : 'hover:bg-white/5'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Hash className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Группа</p>
                <p className="text-xs text-muted-foreground truncate">Жалпы чат</p>
              </div>
            </button>
          )}

          {/* Drivers */}
          {filteredDrivers.map(driver => {
            const conv = conversations.find(c => c.partnerId === driver.id);
            const isActive = activeChat === driver.id;
            return (
              <button
                key={driver.id}
                onClick={() => openDm(driver)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-all ${
                  isActive ? 'bg-red-600/20 border-l-2 border-l-red-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 relative">
                  <span className="text-xs font-bold text-green-400">
                    {driver.callsign || driver.firstName.charAt(0)}
                  </span>
                  {(driver.status === 'ONLINE' || driver.status === 'BUSY') && (
                    <Circle className="w-2.5 h-2.5 text-green-500 fill-green-500 absolute -bottom-0.5 -right-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white truncate">{driver.firstName} {driver.lastName}</p>
                    {conv && (
                      <span className="text-[9px] text-muted-foreground">{fmt(conv.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {conv ? conv.lastMessage.text : driver.phone}
                  </p>
                </div>
                {conv && conv.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANE: messages ── */}
      <div className="flex-1 flex flex-col bg-[#0f172a]">

        {/* Chat header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 bg-[#111827]">
          {activeChat === 'general' ? (
            <>
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <Hash className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Группа</p>
                <p className="text-[11px] text-muted-foreground">Жалпы чат</p>
              </div>
            </>
          ) : selectedPartner ? (
            <>
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-xs font-bold text-green-400">{selectedPartner.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">{selectedPartner.name}</p>
                <p className="text-[11px] text-muted-foreground">Жеке билдирүү</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Чат тандаңыз</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeChat === 'general' ? (
            <>
              {messages.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Билдирүүлөр жок</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === adminId && msg.senderType === 'DISPATCHER';
                const showDate = idx === 0 || fmtDate(msg.createdAt) !== fmtDate(messages[idx - 1].createdAt);
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center my-2">
                        <span className="text-[10px] text-muted-foreground bg-white/5 px-3 py-0.5 rounded-full">{fmtDate(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${isMe ? 'bg-blue-600/80 text-white rounded-br-sm' : 'bg-white/5 border border-white/10 text-white rounded-bl-sm'}`}>
                        {!isMe && <p className={`text-[10px] font-bold mb-0.5 ${msg.senderType === 'DISPATCHER' ? 'text-blue-400' : 'text-green-400'}`}>{msg.senderName}</p>}
                        <p className="text-sm break-words">{msg.text}</p>
                        <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/40' : 'text-muted-foreground'}`}>{fmt(msg.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : selectedPartner ? (
            <>
              {currentDmMessages.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Билдирүүлөр жок</p>
                  <p className="text-xs mt-1">Биринчи жазыңыз!</p>
                </div>
              )}
              {currentDmMessages.map((msg, idx) => {
                const isMe = msg.senderId === adminId;
                const showDate = idx === 0 || fmtDate(msg.createdAt) !== fmtDate(currentDmMessages[idx - 1].createdAt);
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center my-2">
                        <span className="text-[10px] text-muted-foreground bg-white/5 px-3 py-0.5 rounded-full">{fmtDate(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${isMe ? 'bg-blue-600/80 text-white rounded-br-sm' : 'bg-white/5 border border-white/10 text-white rounded-bl-sm'}`}>
                        <p className="text-sm break-words">{msg.text}</p>
                        <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/40' : 'text-muted-foreground'}`}>{fmt(msg.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Сол жагынан чат тандаңыз</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {(activeChat === 'general' || selectedPartner) && (
          <div className="p-3 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="..."
                maxLength={500}
                className="flex-1 bg-white/5 border-white/10"
                autoFocus={activeChat !== 'general'}
              />
              <Button
                onClick={activeChat === 'general' ? handleSendGeneral : handleSendDm}
                disabled={!newMessage.trim() || sending}
                size="icon"
                className="bg-red-600 hover:bg-red-700 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
