import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/src/shared/config';
import { getAccessToken } from '@/src/shared/api/token-store';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket | null> {
  const token = await getAccessToken();
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(API_URL, {
    transports: ['websocket'],
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
