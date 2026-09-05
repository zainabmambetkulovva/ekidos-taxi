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

// ── Palette ──────────────────────────────────────────────
// bg-deep:    #060d1a  (самый тёмный — основной фон)
// bg-panel:   #0a1628  (боковая панель / шапка)
// bg-msg:     #0d1f3c  (зона сообщений)
// neon:       #38bdf8  (sky-400 — неоново-голубой акцент)
// bubble-in:  rgba(15,35,70,0.85)  (входящий пузырь)
// bubble-out: rgba(30,64,120,0.90) (исходящий пузырь)
// ─────────────────────────────────────────────────────────

// ====== PERSISTENCE ======
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

function mergeMessages<T extends { id: string; createdAt: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  [...existing, ...incoming].forEach(m => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function DriverChatPage() {
  const [activeChat, setActiveChat] = useState<ActiveChat>('general');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadConvMessages('general'));
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

  useEffect(() => {
    api.get('/drivers').then(({ data }) => {
      setDrivers((data.drivers || data || []).filter((d: DriverItem) => d.id !== myId));
    }).catch(() => {});
  }, [myId]);

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
          : c);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, convMessages, activeChat]);

  const openDm = async (d: DriverItem) => {
    const name = `${d.firstName} ${d.lastName}${d.callsign ? ` (${d.callsign})` : ''}`;
    setSelectedPartner({ id: d.id, name });
    setActiveChat(d.id);
    const convId = [myId, d.id].sort().join('_');
    const cached = loadDmMessages(convId);
    if (cached.length) setConvMessages(prev => ({ ...prev, [convId]: cached }));
    try {
      const { data } = await api.get(`/dm/messages/${convId}`);
      const fresh = data.messages || [];
      setConvMessages(prev => {
        const existing = prev[convId] || cached;
        const merged = mergeMessages(existing, fresh);
        saveDmMessages(convId, merged);
        return { ...prev, [convId]: merged };
      });
      await api.patch(`/dm/read/${convId}`, { userId: myId });
      setConversations(prev => prev.map(c => c.conversationId === convId ? { ...c, unreadCount: 0 } : c));
    } catch {}
  };

  const sendGeneral = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    try { connectSocket().emit('chat:send', { text, senderType: 'DRIVER', senderId: myId, senderName: myDisplayName }); }
    catch {} finally { setSending(false); }
  };

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
      conversationId: convId, isRead: false, createdAt: new Date().toISOString(),
    };
    setConvMessages(prev => {
      const existing = prev[convId] || [];
      const next = [...existing, optimistic];
      saveDmMessages(convId, next);
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
        saveDmMessages(convId, next);
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

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #060d1a 0%, #0a1628 50%, #060d1a 100%)' }}>

      {/* ── LEFT: contacts ── */}
      <div className="w-[140px] sm:w-[175px] flex-shrink-0 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0a1628 0%, #060d1a 100%)', borderRight: '1px solid rgba(56,189,248,0.12)' }}>

        {/* Search */}
        <div className="p-2" style={{ borderBottom: '1px solid rgba(56,189,248,0.1)' }}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: '#38bdf8', opacity: 0.6 }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="..."
              className="w-full rounded-lg pl-6 pr-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none transition-all"
              style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group channel */}
          {!searchQuery && (
            <button
              onClick={() => setActiveChat('general')}
              className="w-full text-left px-2 py-2.5 flex items-center gap-2 transition-all relative"
              style={{
                borderBottom: '1px solid rgba(56,189,248,0.06)',
                background: activeChat === 'general' ? 'rgba(56,189,248,0.1)' : 'transparent',
                borderLeft: activeChat === 'general' ? '2px solid #38bdf8' : '2px solid transparent',
                boxShadow: activeChat === 'general' ? 'inset 0 0 20px rgba(56,189,248,0.05)' : 'none',
              }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.25)' }}>
                <Hash className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
              </div>
              <p className="text-xs font-semibold text-white truncate">Группа</p>
            </button>
          )}

          {/* Drivers list */}
          {filtered.map(d => {
            const conv = conversations.find(c => c.partnerId === d.id);
            const isActive = activeChat === d.id;
            const isOnline = d.status === 'ONLINE' || d.status === 'BUSY';
            return (
              <button
                key={d.id}
                onClick={() => openDm(d)}
                className="w-full text-left px-2 py-2 flex items-center gap-2 transition-all"
                style={{
                  background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
                  borderLeft: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                  boxShadow: isActive ? 'inset 0 0 20px rgba(56,189,248,0.05)' : 'none',
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative"
                  style={{ background: 'rgba(14,30,60,0.8)', border: `1px solid ${isActive ? 'rgba(56,189,248,0.4)' : 'rgba(56,189,248,0.15)'}` }}>
                  <span className="text-[10px] font-bold text-white">
                    {d.callsign || d.firstName.charAt(0)}
                  </span>
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400"
                      style={{ boxShadow: '0 0 6px #4ade80' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white truncate">{d.firstName}</p>
                  {conv && <p className="text-[9px] truncate" style={{ color: 'rgba(56,189,248,0.5)' }}>{conv.lastMessage.text}</p>}
                </div>
                {conv && conv.unreadCount > 0 && (
                  <span className="text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                    style={{ background: '#38bdf8', boxShadow: '0 0 8px rgba(56,189,248,0.6)' }}>
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0d1f3c 0%, #060d1a 100%)' }}>

        {/* Header */}
        <div className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, #0a1628 0%, #0d1f3c 100%)',
            borderBottom: '1px solid rgba(56,189,248,0.15)',
            boxShadow: '0 1px 12px rgba(56,189,248,0.06)',
          }}>
          {activeChat === 'general' ? (
            <>
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }}>
                <Hash className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
              </div>
              <p className="text-sm font-bold text-white">Группа</p>
              <span className="ml-auto text-[10px]" style={{ color: 'rgba(56,189,248,0.5)' }}>Жалпы чат</span>
            </>
          ) : selectedPartner ? (
            <>
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(14,30,60,0.8)', border: '1px solid rgba(56,189,248,0.3)' }}>
                <span className="text-[10px] font-bold text-white">{selectedPartner.name.charAt(0)}</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{selectedPartner.name}</p>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'rgba(56,189,248,0.4)' }}>Чат тандаңыз</p>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {activeChat === 'general' ? (
            messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-10 h-10 mx-auto mb-2" style={{ color: 'rgba(56,189,248,0.2)' }} />
                <p className="text-xs" style={{ color: 'rgba(56,189,248,0.4)' }}>Билдирүүлөр жок</p>
              </div>
            ) : messages.map(msg => {
              const isMe = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[78%] rounded-2xl px-3 py-2"
                    style={{
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(30,64,120,0.95) 0%, rgba(14,40,90,0.95) 100%)'
                        : 'rgba(15,35,70,0.85)',
                      border: isMe
                        ? '1px solid rgba(56,189,248,0.3)'
                        : '1px solid rgba(56,189,248,0.1)',
                      boxShadow: isMe
                        ? '0 2px 12px rgba(56,189,248,0.1)'
                        : '0 1px 6px rgba(0,0,0,0.3)',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    }}>
                    {!isMe && (
                      <p className="text-[9px] font-bold mb-0.5"
                        style={{ color: msg.senderType === 'DISPATCHER' ? '#38bdf8' : 'rgba(56,189,248,0.7)' }}>
                        {msg.senderName}
                      </p>
                    )}
                    <p className="text-sm break-words text-white">{msg.text}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })
          ) : selectedPartner ? (
            currentDm.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-10 h-10 mx-auto mb-2" style={{ color: 'rgba(56,189,248,0.2)' }} />
                <p className="text-xs" style={{ color: 'rgba(56,189,248,0.4)' }}>Билдирүүлөр жок</p>
              </div>
            ) : currentDm.map(msg => {
              const isMe = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[78%] px-3 py-2"
                    style={{
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(30,64,120,0.95) 0%, rgba(14,40,90,0.95) 100%)'
                        : 'rgba(15,35,70,0.85)',
                      border: isMe
                        ? '1px solid rgba(56,189,248,0.3)'
                        : '1px solid rgba(56,189,248,0.1)',
                      boxShadow: isMe ? '0 2px 12px rgba(56,189,248,0.1)' : '0 1px 6px rgba(0,0,0,0.3)',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    }}>
                    <p className="text-sm break-words text-white">{msg.text}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Users className="w-10 h-10 mx-auto mb-2" style={{ color: 'rgba(56,189,248,0.2)' }} />
                <p className="text-xs" style={{ color: 'rgba(56,189,248,0.4)' }}>Чат тандаңыз</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {(activeChat === 'general' || selectedPartner) && (
          <div className="px-3 py-2.5 flex-shrink-0"
            style={{
              background: 'linear-gradient(90deg, #0a1628 0%, #0d1f3c 100%)',
              borderTop: '1px solid rgba(56,189,248,0.15)',
            }}>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Билдирүү жазыңыз..."
                maxLength={500}
                className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none transition-all"
                style={{
                  background: 'rgba(56,189,248,0.06)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  boxShadow: 'inset 0 0 12px rgba(56,189,248,0.03)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.2)'}
              />
              <button
                onClick={activeChat === 'general' ? sendGeneral : sendDm}
                disabled={!newMessage.trim() || sending}
                className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
                style={{
                  background: newMessage.trim() && !sending
                    ? 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)'
                    : 'rgba(56,189,248,0.15)',
                  boxShadow: newMessage.trim() && !sending ? '0 0 14px rgba(56,189,248,0.4)' : 'none',
                  border: '1px solid rgba(56,189,248,0.3)',
                }}
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
