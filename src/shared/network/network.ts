import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Se o celular está com internet. Fica de fora do `onlineManager` do react-query de propósito: a troca de conta
 * já pausa as consultas por ali, e as duas coisas não podem se atropelar.
 * "Sem internet" = sem conexão alguma, ou conectado a uma rede que não chega à internet.
 */
let online = true;
const listeners = new Set<() => void>();
const reconnect = new Set<() => void>();

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l());
  if (next) reconnect.forEach((l) => l());
}

const fromState = (s: { isConnected?: boolean; isInternetReachable?: boolean | null }) => !(s.isConnected === false || s.isInternetReachable === false);

let started = false;
function start() {
  if (started) return;
  started = true;
  try {
    void Network.getNetworkStateAsync().then((s) => set(fromState(s)));
    Network.addNetworkStateListener((s) => set(fromState(s)));
  } catch {
    // sem módulo de rede: segue como online e deixa cada tela tratar a própria falha
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    set(navigator.onLine !== false);
    window.addEventListener('online', () => set(true));
    window.addEventListener('offline', () => set(false));
  }
}

export const isOnline = (): boolean => online;

/** `true` enquanto o celular está com internet. */
export function useOnline(): boolean {
  start();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => online,
    () => true,
  );
}

/** Chama `fn` toda vez que a internet volta. Devolve quem cancela. */
export function onReconnect(fn: () => void): () => void {
  start();
  reconnect.add(fn);
  return () => reconnect.delete(fn);
}

/** Falha de rede (sem resposta do servidor): sem internet, sinal fraco ou o servidor fora do ar. */
export function isNetworkError(e: unknown): boolean {
  const err = e as { response?: unknown; code?: string; message?: string; request?: unknown } | null;
  if (!err || typeof err !== 'object') return false;
  if (err.response) return false;
  return err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message === 'Network Error' || !!err.request;
}

/** Só para teste: volta ao estado inicial. */
export function __resetNetworkForTests(value = true) {
  online = value;
  listeners.clear();
  reconnect.clear();
}
