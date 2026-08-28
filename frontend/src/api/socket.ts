import { io, Socket } from 'socket.io-client';
import { useAuth } from '../store/auth';

let socket: Socket | null = null;

// Single shared WebSocket connection, authenticated with the same JWT as REST calls. This is
// what makes the Kanban board's "instant refresh" real: every connected client is pushed a live
// event the moment anyone changes an item, not just the browser that made the change.
export function getSocket(): Socket | null {
  const token = useAuth.getState().token;
  if (!token) return null;

  if (socket && socket.connected) return socket;

  // In production VITE_API_URL is an absolute URL (e.g. https://backend.up.railway.app/api);
  // strip the trailing /api to get the socket origin. In dev it's unset/relative, so connecting
  // with no URL targets the current page's origin, which Vite's dev proxy forwards to the
  // backend (see vite.config.ts's /socket.io proxy entry), same pattern as the /api proxy.
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const socketUrl = apiUrl?.startsWith('http') ? apiUrl.replace(/\/api\/?$/, '') : undefined;

  if (!socket) {
    socket = io(socketUrl, { auth: { token }, autoConnect: false, transports: ['websocket', 'polling'] });
  } else {
    socket.auth = { token };
  }
  socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
