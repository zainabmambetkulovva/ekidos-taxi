'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users, Search, Circle, Hash } from 'lucide-react';
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

type ActiveChat = 'general' | string;

// Persist messages per conversation in localStorage
const CACHE_PREFIX = 'ekidos_chat_v2_';
function saveConvMessages(convId: string, msgs: any[]) {
  try { localStorage.setItem(CACHE_PREFIX + convId, JSON.stringify(msgs.slice(-300))); } catch {}
}
function loadConvMessages(convId: string): any[] {
  try { const s = localStorage.getItem(CACHE_PREFIX + convId); return s ? JSON.parse(s) : []; } catch { return []; }
}

// Merge old + new messages without duplicates, sorted by time
function mergeMessages<T extends { id: string; createdAt: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  [...existing, ...incoming].forEach(m => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function DriverChatPage() {
  const [activeChat, setActiveChat] = useState<ActiveChat>('general');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadConvMessages('general'));
  // Store DM messages per conversationId: { convId: DirectMessage[] }
  const [convMessages, setConvMessages] = useState<Record<string, DirectMessage[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const driverInfo = typeof window !== 'undefined' ? localStorage.getItem('driverInfo') : null;
  const driver = driverInfo ? JSON.parse(driverInfo) : null;
  const myId = driver?.id || '';
  const myName = driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : 'Водитель';
  const myCallsign = driver?.callsign || '';
  const myDisplayName = myCallsign ? `${myName} (${myCallsign})` : myName;

  // Fetch general chat
  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, []);

  // Fetch drivers (exclude self)
  useEffect(() => {
    api.get('/drivers').then(({ data }) => {
      setDrivers((data.drivers || data || []).filter((d: DriverItem) => d.id !== myId));
    }).catch(() => {});
  }, [myId]);

  // Fetch conversations
  useEffect(() => {
    if (!myId) return;
    const fetch = async () => {
      try {
        const { data } = await api.get('/dm/conversations', { params: { userId: myId } });
        setConversations(data || []);
      } catch {}
    };
    fetch();
    const iv = setInterval(fetch, 15000);
    return () => clearInterval(iv);
  }, [myId]);

  // Socket
  useEffect(() => {
    if (!myId) return;
    const socket = connectSocket();
    socket.emit('chat:join');
    socket.emit('dm:join', myId);

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        const next = mergeMessages(prev, [msg]);
        saveConvMessages('general', next);
        return next;
      });
    });

    socket.on('dm:message', (msg: DirectMessage) => {
      const convId = msg.conversationId;
      setConvMessages(prev => {
        const existing = prev[convId] || loadConvMessages(convId);
        if (existing.find((m: DirectMessage) => m.id === msg.id)) return prev;
        const next = mergeMessages(existing, [msg]);
        saveConvMessages(convId, next);
        return { ...prev, [convId]: next };
      });
      setConversations(prev => {
        const existing = prev.find(c => c.conversationId === msg.conversationId);
        if (existing) return prev.map(c => c.conversationId === msg.conversationId
          ? { ...c, lastMessage: msg, unreadCount: msg.receiverId === myId ? c.unreadCount + 1 : c.unreadCount }
          : c
        );
        return [{
          conversationId: msg.conversationId,
          lastMessage: msg,
          unreadCount: msg.receiverId === myId ? 1 : 0,
          partnerId: msg.senderId === myId ? msg.receiverId : msg.senderId,
          partnerName: msg.senderId === myId ? msg.receiverName : msg.senderName,
          partnerType: msg.senderId === myId ? msg.receiverType : msg.senderType,
        }, ...prev];
      });
    });

    return () => { socket.off('chat:message'); socket.off('dm:message'); };
  }, [myId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, convMessages, activeChat]);

  // Open DM — load cache instantly, merge with server
  const openDm = async (d: DriverItem) => {
    const name = `${d.firstName} ${d.lastName}${d.callsign ? ` (${d.callsign})` : ''}`;
    setSelectedPartner({ id: d.id, name });
    setActiveChat(d.id);
    const convId = [myId, d.id].sort().join('_');
    // Load cache immediately so messages show instantly
    const cached = loadConvMessages(convId);
    if (cached.length) {
      setConvMessages(prev => ({ ...prev, [convId]: cached }));
    }
    // Fetch from server and merge (never clear cached)
    try {
      const { data } = await api.get(`/dm/messages/${convId}`, { params: { limit: 100 } });
      const fresh = data.messages || [];
      setConvMessages(prev => {
        const existing = prev[convId] || cached;
        const merged = mergeMessages(existing, fresh);
        saveConvMessages(convId, merged);
        return { ...prev, [convId]: merged };
      });
      await api.patch(`/dm/read/${convId}`, { userId: myId });
      setConversations(prev => prev.map(c => c.conversationId === convId ? { ...c, unreadCount: 0 } : c));
    } catch {}
  };

  // Send general
  const sendGeneral = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    try {
      connectSocket().emit('chat:send', { text, senderType: 'DRIVER', senderId: myId, senderName: myDisplayName });
    } catch {} finally { setSending(false); }
  };

  // Send DM
  const sendDm = async () => {
    if (!newMessage.trim() || sending || !selectedPartner) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    const convId = [myId, selectedPartner.id].sort().join('_');
    const optimistic: DirectMessage = {
      id: `tmp-${Date.now()}`, text,
      senderId: myId, senderName: myDisplayName, senderType: 'DRIVER',
      receiverId: selectedPartner.id, receiverName: selectedPartner.name, receiverType: 'DISPATCHER',
      conversationId: convId,
      isRead: false, createdAt: new Date().toISOString(),
    };
    setConvMessages(prev => {
      const existing = prev[convId] || [];
      const next = [...existing, optimistic];
      saveConvMessages(convId, next);
      return { ...prev, [convId]: next };
    });
    try {
      const { data } = await api.post('/dm/send', {
        text, senderId: myId, senderName: myDisplayName, senderType: 'DRIVER',
        receiverId: selectedPartner.id, receiverName: selectedPartner.name, receiverType: 'DISPATCHER',
      });
      setConvMessages(prev => {
        const existing = prev[convId] || [];
        const next = existing.map(m => m.id === optimistic.id ? data : m);
        saveConvMessages(convId, next);
        return { ...prev, [convId]: next };
      });
    } catch {} finally { setSending(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); activeChat === 'general' ? sendGeneral() : sendDm(); }
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const filtered = drivers.filter(d => {
    const q = searchQuery.toLowerCase();
    return d.firstName.toLowerCase().includes(q) || d.lastName.toLowerCase().includes(q) ||
      (d.callsign || '').toLowerCase().includes(q);
  });

  const currentDm = selectedPartner
    ? (convMessages[[myId, selectedPartner.id].sort().join('_')] || [])
    : [];

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden">

      {/* ── LEFT: contacts ── */}
      <div className="w-[140px] sm:w-[180px] flex-shrink-0 flex flex-col border-r border-white/10 bg-[#0a0f1a]">
        {/* Search */}
        <div className="p-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group */}
          {!searchQuery && (
            <button
              onClick={() => setActiveChat('general')}
              className={`w-full text-left px-2 py-2.5 flex items-center gap-2 transition-all border-b border-white/5 ${
                activeChat === 'general' ? 'bg-red-600/20 border-l-2 border-l-red-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Hash className="w-3.5 h-3.5 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">Группа</p>
              </div>
            </button>
          )}

          {/* Drivers */}
          {filtered.map(d => {
            const conv = conversations.find(c => c.partnerId === d.id);
            const isActive = activeChat === d.id;
            return (
              <button
                key={d.id}
                onClick={() => openDm(d)}
                className={`w-full text-left px-2 py-2 flex items-center gap-2 transition-all ${
                  isActive ? 'bg-red-600/20 border-l-2 border-l-red-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 relative">
                  <span className="text-[10px] font-bold text-green-400">
                    {d.callsign || d.firstName.charAt(0)}
                  </span>
                  {(d.status === 'ONLINE' || d.status === 'BUSY') && (
                    <Circle className="w-2 h-2 text-green-500 fill-green-500 absolute -bottom-0.5 -right-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white truncate">{d.firstName}</p>
                  {conv && <p className="text-[9px] text-gray-500 truncate">{conv.lastMessage.text}</p>}
                </div>
                {conv && conv.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: messages ── */}
      <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">

        {/* Header */}
        <div className="px-3 py-2.5 border-b border-white/10 bg-[#0a0f1a] flex items-center gap-2 flex-shrink-0">
          {activeChat === 'general' ? (
            <>
              <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
                <Hash className="w-3.5 h-3.5 text-red-400" />
              </div>
              <p className="text-sm font-bold text-white">Группа</p>
            </>
          ) : selectedPartner ? (
            <>
              <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-green-400">{selectedPartner.name.charAt(0)}</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{selectedPartner.name}</p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Чат тандаңыз</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {activeChat === 'general' ? (
            messages.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Билдирүүлөр жок</p>
              </div>
            ) : messages.map(msg => {
              const isMe = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${isMe ? 'bg-red-600/80 text-white rounded-br-sm' : msg.senderType === 'DISPATCHER' ? 'bg-blue-600/25 border border-blue-500/25 text-white rounded-bl-sm' : 'bg-white/8 text-white rounded-bl-sm'}`}>
                    {!isMe && <p className={`text-[9px] font-bold mb-0.5 ${msg.senderType === 'DISPATCHER' ? 'text-blue-300' : 'text-green-300'}`}>{msg.senderName}</p>}
                    <p className="text-sm break-words">{msg.text}</p>
                    <p className={`text-[9px] mt-0.5 ${isMe ? 'text-white/40' : 'text-gray-500'}`}>{fmt(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })
          ) : selectedPartner ? (
            currentDm.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Билдирүүлөр жок</p>
              </div>
            ) : currentDm.map(msg => {
              const isMe = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${isMe ? 'bg-red-600/80 text-white rounded-br-sm' : msg.senderType === 'DISPATCHER' ? 'bg-blue-600/25 border border-blue-500/25 text-white rounded-bl-sm' : 'bg-white/8 text-white rounded-bl-sm'}`}>
                    <p className="text-sm break-words">{msg.text}</p>
                    <p className={`text-[9px] mt-0.5 ${isMe ? 'text-white/40' : 'text-gray-500'}`}>{fmt(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-600">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Чат тандаңыз</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {(activeChat === 'general' || selectedPartner) && (
          <div className="px-3 py-2 border-t border-white/10 bg-[#0a0f1a] flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKey}
                placeholder="..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/40"
              />
              <button
                onClick={activeChat === 'general' ? sendGeneral : sendDm}
                disabled={!newMessage.trim() || sending}
                className="w-9 h-9 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 flex items-center justify-center active:scale-95 transition-all"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
