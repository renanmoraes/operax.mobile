import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/src/shared/config';
import { getAccessToken, getSavedRole } from '@/src/shared/api/token-store';

/**
 * Tempo real da equipe (mesmo socket do Operax web).
 *
 * O gateway do backend só lê a sessão do cookie `access_token`. No celular (iOS/Android) o
 * WebSocket aceita cabeçalhos, então mandamos o token como esse cookie; no navegador o cookie
 * é do próprio navegador. O portal do cliente não tem socket (o backend recusa): lá o "ao vivo"
 * é consulta curta enquanto a tela está aberta.
 */

let socket: Socket | null = null;
const listeners = new Set<(s: Socket | null) => void>();

function setSocket(next: Socket | null) {
  socket = next;
  listeners.forEach((fn) => fn(next));
}

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (Platform.OS !== 'web') headers.Cookie = `access_token=${token}`;
  return headers;
}

/** Só a equipe tem socket; o cliente (portal) usa consulta curta. */
async function staffToken(): Promise<string | null> {
  if ((await getSavedRole()) === 'client') return null;
  return getAccessToken('staff');
}

export async function connectSocket(): Promise<Socket | null> {
  const token = await staffToken();
  if (!token) return null;
  if (socket) {
    await refreshSocketAuth();
    return socket;
  }

  const s = io(API_URL, {
    transports: ['websocket'],
    auth: { token },
    extraHeaders: authHeaders(token),
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    autoConnect: true,
  });
  // Servidor derrubou (token vencido): pega o token atual e tenta de novo.
  s.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') void refreshSocketAuth();
  });
  setSocket(s);
  return s;
}

/** Atualiza o token da conexão (depois de renovar a sessão ou ao voltar para o app) e reconecta se caiu. */
export async function refreshSocketAuth(): Promise<void> {
  if (!socket) return;
  const token = await staffToken();
  if (!token) return;
  socket.auth = { token };
  const opts = socket.io.opts as { extraHeaders?: Record<string, string> };
  opts.extraHeaders = authHeaders(token);
  if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  setSocket(null);
}

export function getSocket(): Socket | null {
  return socket;
}

// Voltou para o app: garante a conexão (o sistema costuma derrubar o socket em segundo plano).
AppState.addEventListener('change', (state) => {
  if (state === 'active') void refreshSocketAuth();
});

type Handler = (payload: unknown) => void;

/**
 * Escuta eventos do socket enquanto a tela está montada. Se inscreve de novo quando a conexão
 * é criada depois (login, troca de conta), então a tela não fica surda por ter aberto antes.
 */
export function useSocketEvents(handlers: Record<string, Handler>, enabled = true): void {
  const ref = useRef(handlers);
  // Sempre a versão mais nova das funções, sem refazer a inscrição a cada render.
  useEffect(() => {
    ref.current = handlers;
  });
  const events = Object.keys(handlers).sort().join('|');

  useEffect(() => {
    if (!enabled) return;
    const names = events.split('|').filter(Boolean);
    let current: Socket | null = null;
    const bound = names.map((name) => [name, (p: unknown) => ref.current[name]?.(p)] as const);
    const attach = (s: Socket | null) => {
      if (current) bound.forEach(([n, fn]) => current!.off(n, fn));
      current = s;
      if (s) bound.forEach(([n, fn]) => s.on(n, fn));
    };
    attach(socket);
    listeners.add(attach);
    return () => {
      listeners.delete(attach);
      attach(null);
    };
  }, [events, enabled]);
}

/**
 * Entra na sala da conversa aberta (`join:conversation`, o mesmo do web) para receber as mensagens
 * dela na hora. Entra de novo a cada reconexão, porque o servidor esquece as salas ao cair.
 */
export function useConversationRoom(conversationId: string | undefined, enabled = true): void {
  useEffect(() => {
    if (!enabled || !conversationId) return;
    let current: Socket | null = null;
    const join = () => current?.emit('join:conversation', { conversationId });
    const attach = (s: Socket | null) => {
      current?.off('connect', join);
      current = s;
      if (!s) return;
      s.on('connect', join);
      if (s.connected) join();
    };
    attach(socket);
    listeners.add(attach);
    return () => {
      listeners.delete(attach);
      attach(null);
    };
  }, [conversationId, enabled]);
}
