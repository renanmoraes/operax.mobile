import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { API_URL } from '@/src/shared/config';

/**
 * Se o celular está com internet. Fica de fora do `onlineManager` do react-query de propósito: a troca de conta
 * já pausa as consultas por ali, e as duas coisas não podem se atropelar.
 *
 * "Sem internet" só vale quando é certo: o celular sem conexão nenhuma, ou o nosso servidor sem responder.
 * O aviso do Android de que a rede "não chega à internet" vem falso com frequência (Wi-Fi validando, volta do
 * segundo plano, economia de bateria da Samsung): ele só dispara uma conferência com o servidor, nunca a faixa sozinho.
 * Qualquer resposta do servidor prova que há internet e tira a faixa na hora.
 */
let online = true;
const listeners = new Set<() => void>();
const reconnect = new Set<() => void>();

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l());
  if (next) reconnect.forEach((l) => l());
  // Fora do ar: reconfere de tempos em tempos, para a faixa não ficar presa se o Android não avisar a volta.
  if (next) stopRetry();
  else startRetry();
}

const PROBE_TIMEOUT_MS = 10_000;
/** Última vez que o servidor respondeu: conferência que começou antes disso e falhou não vale mais. */
let lastReach = 0;
const RETRY_MS = 15_000;
let probing: Promise<boolean> | null = null;

/**
 * Pergunta ao servidor se ele responde. Só vale a resposta do nosso servidor: a página de login de um Wi-Fi de
 * academia ou hotel também responde, mas não é internet.
 */
function probe(): Promise<boolean> {
  if (probing) return probing;
  const started = Date.now();
  probing = (async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}/api/health`, { method: 'GET', cache: 'no-store', signal: ctrl?.signal });
      const body = (await res.json().catch(() => null)) as { status?: string } | null;
      return body?.status === 'ok';
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      probing = null;
    }
  })().then((ok) => ok || lastReach > started);
  return probing;
}

type State = { isConnected?: boolean; isInternetReachable?: boolean | null };

/** Sistema diz que não há conexão ou que ela não chega à internet: confere com o servidor antes de mostrar a faixa. */
async function apply(s: State) {
  if (s.isConnected === false || s.isInternetReachable === false) {
    set(await probe());
    return;
  }
  set(true);
}

let retry: ReturnType<typeof setInterval> | null = null;
function startRetry() {
  if (retry) return;
  retry = setInterval(() => void probe().then((ok) => ok && set(true)), RETRY_MS);
}
function stopRetry() {
  if (retry) clearInterval(retry);
  retry = null;
}

/** Chamado pelo cliente da API a cada resposta: se o servidor respondeu, há internet. */
export function markServerReached() {
  lastReach = Date.now();
  set(true);
}

let started = false;
function start() {
  if (started) return;
  started = true;
  try {
    void Network.getNetworkStateAsync().then((s) => apply(s));
    Network.addNetworkStateListener((s) => void apply(s));
  } catch {
    // sem módulo de rede: segue como online e deixa cada tela tratar a própria falha
  }
  // Volta do segundo plano: o Android pode não ter avisado nada enquanto o app dormia. Reconfere ao abrir.
  AppState.addEventListener('change', (st) => {
    if (st !== 'active') return;
    if (!online) void probe().then((ok) => ok && set(true));
    else void Network.getNetworkStateAsync().then((s) => apply(s)).catch(() => undefined);
  });
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

/** Só para teste: aplica um estado de rede como se viesse do sistema. */
export const __applyForTests = apply;

/** Só para teste: volta ao estado inicial. */
export function __resetNetworkForTests(value = true) {
  online = value;
  stopRetry();
  probing = null;
  lastReach = 0;
  listeners.clear();
  reconnect.clear();
}
