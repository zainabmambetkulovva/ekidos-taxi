'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users, ArrowLeft, Search, Circle } from 'lucide-react';
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

type ChatView = 'general' | 'conversations' | 'dm';

export default function DriverChatPage() {
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Get driver info
  const driverInfo = typeof window !== 'undefined' ? localStorage.getItem('driverInfo') : null;
  const driver = driverInfo ? JSON.parse(driverInfo) : null;
  const myId = driver?.id || '';
  const myName = driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : 'Водитель';
  const myCallsign = driver?.callsign || '';
  const myDisplayName = myCallsign ? `${myName} (${myCallsign})` : myName;

  // Fetch general chat messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/chat', { params: { limit: 100 } });
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
        const allDrivers = data.drivers || data || [];
        // Exclude self from list
        setDrivers(allDrivers.filter((d: DriverItem) => d.id !== myId));
      } catch {}
    };
    fetchDrivers();
  }, [myId]);

  // Fetch conversations
  useEffect(() => {
    if (!myId) return;
    const fetchConversations = async () => {
      try {
        const { data } = await api.get('/dm/conversations', { params: { userId: myId } });
        setConversations(data || []);
      } catch {}
    };
    fetchConversations();
    const iv = setInterval(fetchConversations, 15000);
    return () => clearInterval(iv);
  }, [myId]);

  // Socket: general chat + DM
  useEffect(() => {
    if (!myId) return;
    const socket = connectSocket();
    socket.emit('chat:join');
    socket.emit('dm:join', myId);

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
      // Update conversations
      setConversations(prev => {
        const existing = prev.find(c => c.conversationId === message.conversationId);
        if (existing) {
          return prev.map(c =>
            c.conversationId === message.conversationId
              ? { ...c, lastMessage: message, unreadCount: message.receiverId === myId ? c.unreadCount + 1 : c.unreadCount }
              : c
          );
        }
        return [{
          conversationId: message.conversationId,
          lastMessage: message,
          unreadCount: message.receiverId === myId ? 1 : 0,
          partnerId: message.senderId === myId ? message.receiverId : message.senderId,
          partnerName: message.senderId === myId ? message.receiverName : message.senderName,
          partnerType: message.senderId === myId ? message.receiverType : message.senderType,
        }, ...prev];
      });
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('dm:message', handleDmMessage);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('dm:message', handleDmMessage);
    };
  }, [myId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  // Open DM
  const openDm = async (partnerId: string, partnerName: string, partnerType: string) => {
    setSelectedPartner({ id: partnerId, name: partnerName, type: partnerType });
    setView('dm');
    setDmMessages([]);

    const conversationId = [myId, partnerId].sort().join('_');
    try {
      const { data } = await api.get(`/dm/messages/${conversationId}`, { params: { limit: 100 } });
      setDmMessages(data.messages || []);
      // Mark as read
      await api.patch(`/dm/read/${conversationId}`, { userId: myId });
      setConversations(prev =>
        prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c)
      );
    } catch {}
  };

  // Send general chat
  const handleSendGeneral = async () => {
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
        senderName: myDisplayName,
      });
    } catch {
      try {
        await api.post('/chat', { text, senderType: 'DRIVER', senderId: myId, senderName: myDisplayName });
      } catch {}
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Send DM
  const handleSendDm = async () => {
    if (!newMessage.trim() || sending || !selectedPartner) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    // Optimistic: show message immediately
    const optimisticMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      text,
      senderId: myId,
      senderName: myDisplayName,
      senderType: 'DRIVER',
      receiverId: selectedPartner.id,
      receiverName: selectedPartner.name,
      receiverType: selectedPartner.type,
      conversationId: [myId, selectedPartner.id].sort().join('_'),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setDmMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data } = await api.post('/dm/send', {
        text,
        senderId: myId,
        senderName: myDisplayName,
        senderType: 'DRIVER',
        receiverId: selectedPartner.id,
        receiverName: selectedPartner.name,
        receiverType: selectedPartner.type,
      });
      // Replace optimistic with real message
      setDmMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
    } catch (err: any) {
      console.error('DM send error:', err?.response?.data || err);
      // Keep optimistic message visible even if server fails
    } finally {
      setSending(false);
      inputRef.current?.focus();
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

  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      d.firstName.toLowerCase().includes(q) ||
      d.lastName.toLowerCase().includes(q) ||
      (d.callsign || '').toLowerCase().includes(q) ||
      d.phone.includes(q)
    );
  });

  // Current DM messages
  const currentDmMessages = selectedPartner
    ? dmMessages.filter(m => m.conversationId === [myId, selectedPartner.id].sort().join('_'))
    : [];

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* === TOP TABS (only when not in DM view) === */}
      {view !== 'dm' && (
        <>
          <div className="px-3 py-2 border-b border-white/10 bg-[#0a0a0a] flex gap-2">
            <button
              onClick={() => setView('general')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                view === 'general'
                  ? 'bg-red-600 text-white'
                  : 'bg-white/5 text-gray-400'
              }`}
            >
              <MessageCircle className="w-4 h-4 mx-auto mb-0.5" />
              Жалпы чат
            </button>
            <button
              onClick={() => setView('conversations')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all relative ${
                view === 'conversations'
                  ? 'bg-red-600 text-white'
                  : 'bg-white/5 text-gray-400'
              }`}
            >
              <Users className="w-4 h-4 mx-auto mb-0.5" />
              Жеке чат
              {totalUnread > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </>
      )}

      {/* === GENERAL CHAT === */}
      {view === 'general' && (
        <>
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
                onClick={handleSendGeneral}
                disabled={!newMessage.trim() || sending}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center transition-colors active:scale-95"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* === CONVERSATIONS LIST === */}
      {view === 'conversations' && (
        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="px-3 py-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Водитель издөө..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>

          <div className="px-2 py-2 space-y-0.5">
            {/* Existing conversations */}
            {!searchQuery && conversations.length > 0 && (
              <>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider px-3 py-1 font-semibold">Акыркы сүйлөшүүлөр</p>
                {conversations.map(conv => (
                  <button
                    key={conv.conversationId}
                    onClick={() => openDm(conv.partnerId, conv.partnerName, conv.partnerType)}
                    className="w-full text-left p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-green-400">
                        {conv.partnerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate text-white">{conv.partnerName}</p>
                        <span className="text-[9px] text-gray-500">
                          {formatTime(conv.lastMessage.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{conv.lastMessage.text}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
                <div className="border-t border-white/5 my-2" />
              </>
            )}

            {/* Drivers list */}
            <p className="text-[9px] text-gray-500 uppercase tracking-wider px-3 py-1 font-semibold">
              {searchQuery ? 'Издөө жыйынтыктары' : 'Бардык водителдер'}
            </p>
            {filteredDrivers.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">Водитель табылган жок</p>
            )}
            {filteredDrivers.map(d => (
              <button
                key={d.id}
                onClick={() => openDm(
                  d.id,
                  `${d.firstName} ${d.lastName}${d.callsign ? ` (${d.callsign})` : ''}`,
                  'DRIVER'
                )}
                className="w-full text-left p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 relative">
                  <span className="text-sm font-bold text-green-400">
                    {d.callsign || d.firstName.charAt(0)}
                  </span>
                  {(d.status === 'ONLINE' || d.status === 'BUSY') && (
                    <Circle className="w-2.5 h-2.5 text-green-500 fill-green-500 absolute -bottom-0.5 -right-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-white">{d.firstName} {d.lastName}</p>
                  <p className="text-[11px] text-gray-500">
                    {d.callsign ? `${d.callsign} • ` : ''}{d.phone}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === DM VIEW === */}
      {view === 'dm' && selectedPartner && (
        <>
          {/* DM Header */}
          <div className="px-3 py-2.5 border-b border-white/10 bg-[#0a0a0a] flex items-center gap-3">
            <button
              onClick={() => setView('conversations')}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <span className="text-xs font-bold text-green-400">
                {selectedPartner.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{selectedPartner.name}</p>
              <p className="text-[10px] text-gray-500">Жеке билдирүү</p>
            </div>
          </div>

          {/* DM Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {currentDmMessages.length === 0 && (
              <div className="text-center py-16">
                <MessageCircle className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">Билдирүүлөр жок</p>
                <p className="text-xs text-gray-600 mt-1">Биринчи билдирүүнү жөнөтүңүз!</p>
              </div>
            )}

            {currentDmMessages.map((msg) => {
              const isMe = msg.senderId === myId;

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    isMe
                      ? 'bg-red-600/80 text-white rounded-br-md'
                      : msg.senderType === 'DISPATCHER'
                        ? 'bg-blue-600/30 border border-blue-500/30 text-white rounded-bl-md'
                        : 'bg-white/10 text-white rounded-bl-md'
                  }`}>
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

          {/* DM Input */}
          <div className="px-3 py-2 border-t border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`${selectedPartner.name} га жазуу...`}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                maxLength={500}
                autoFocus
              />
              <button
                onClick={handleSendDm}
                disabled={!newMessage.trim() || sending}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center transition-colors active:scale-95"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
