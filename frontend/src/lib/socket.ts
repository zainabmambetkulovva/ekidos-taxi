import { io, Socket } from 'socket.io-client';

// HARDCODED production URL - not dependent on env vars
const SOCKET_URL = 'https://ekidos-taxi-production-587e.up.railway.app';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id);
    });
    socket.on('connect_error', (err) => {
      console.log('[Socket] Error:', err.message);
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
