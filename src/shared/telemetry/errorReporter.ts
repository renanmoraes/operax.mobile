import axios from 'axios';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { getAccessToken, getSavedRole } from '@/src/shared/api/token-store';

/**
 * Erros do app → servidor (`POST /api/mobile/logs`, gravado em `system_logs` com origem `mobile`).
 *
 * Não é telemetria de uso: só vai quando algo QUEBRA (tela que travou, erro solto, chamada à API que
 * falhou por servidor ou rede). Cada erro leva o retrato do aparelho naquele momento — modelo,
 * sistema, versão do app, rede, bateria, tela atual e as últimas telas — para dar para entender
 * a reclamação do usuário. Nunca vai conteúdo de mensagem, dado de paciente nem corpo de requisição.
 * Localização fica de fora: pedir GPS só para log não passa na revisão das lojas e é dado sensível.
 *
 * Fica numa fila no aparelho (sobrevive a sem internet e a fechar o app) e é enviado de tempo em tempo.
 */

export type ErrorLevel = 'error' | 'warn';

type Entry = {
  level: ErrorLevel;
  message: string;
  trace?: string;
  context?: string;
  occurred_at: string;
  meta: Record<string, unknown>;
};

const QUEUE_MAX = 100;
const BATCH = 50;
const FLUSH_EVERY_MS = 60_000;
const FILE = documentDirectory ? `${documentDirectory}operax-error-queue.json` : null;
const WEB_KEY = 'operax_error_queue';

let queue: Entry[] = [];
let loaded = false;
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

/** Últimas telas visitadas (só o caminho), para saber o que a pessoa fez antes do erro. */
const routes: string[] = [];
let session: { role?: string; mode?: string; tenant?: string | null } = {};

export function trackRoute(pathname: string): void {
  if (!pathname || routes[routes.length - 1] === pathname) return;
  routes.push(pathname);
  if (routes.length > 12) routes.shift();
}

/** Quem está usando (o servidor confere pelo token; isto é só para leitura do log). */
export function setReporterSession(next: typeof session): void {
  session = next;
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(WEB_KEY) : FILE ? await readAsStringAsync(FILE) : null;
    const saved = raw ? (JSON.parse(raw) as Entry[]) : [];
    queue = [...saved, ...queue].slice(-QUEUE_MAX);
  } catch {
    // arquivo ainda não existe ou corrompido: começa vazio
  }
}

async function persist(): Promise<void> {
  try {
    const raw = JSON.stringify(queue);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(WEB_KEY, raw);
    else if (FILE) await writeAsStringAsync(FILE, raw);
  } catch {
    // sem espaço: o erro ainda segue na memória
  }
}

/** Retrato do aparelho agora. Cada leitura falha sozinha sem derrubar as outras. */
export async function deviceSnapshot(): Promise<Record<string, unknown>> {
  const safe = async <T,>(fn: () => Promise<T> | T): Promise<T | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  const [net, level, state, lowPower] = await Promise.all([
    safe(() => Network.getNetworkStateAsync()),
    safe(() => Battery.getBatteryLevelAsync()),
    safe(() => Battery.getBatteryStateAsync()),
    safe(() => Battery.isLowPowerModeEnabledAsync()),
  ]);
  const batteryState = state == null ? null : (['unknown', 'unplugged', 'charging', 'full'][state] ?? String(state));
  return {
    app: {
      // Versão do Operax (app.json); a nativa é a do binário instalado (no Expo Go, é a do próprio Expo Go).
      version: Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? null,
      native_version: Application.nativeApplicationVersion ?? null,
      build: Application.nativeBuildVersion ?? null,
      runtime: Constants.executionEnvironment ?? null, // storeClient = Expo Go, standalone = app da loja
      dev: __DEV__,
    },
    device: {
      platform: Platform.OS,
      os: Device.osName ?? Platform.OS,
      os_version: Device.osVersion ?? String(Platform.Version ?? ''),
      brand: Device.brand ?? null,
      model: Device.modelName ?? null,
      emulator: !Device.isDevice,
      memory_gb: Device.totalMemory ? Math.round((Device.totalMemory / 1024 ** 3) * 10) / 10 : null,
    },
    network: net ? { type: String(net.type ?? 'unknown').toLowerCase(), connected: net.isConnected ?? null, internet: net.isInternetReachable ?? null } : null,
    battery: level == null ? null : { level: Math.round(level * 100) / 100, state: batteryState, low_power: lowPower ?? null },
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    app_state: AppState.currentState,
    screen: routes[routes.length - 1] ?? null,
    recent_screens: [...routes],
    session,
  };
}

/** Mesmo erro repetido em sequência (laço, rede caída) conta uma vez a cada 30 s. */
const recent = new Map<string, number>();
function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  recent.set(key, now);
  if (recent.size > 200) recent.clear();
  return last != null && now - last < 30_000;
}

function describe(error: unknown): { message: string; trace?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`.slice(0, 2000), trace: error.stack?.slice(0, 8000) };
  if (typeof error === 'string') return { message: error.slice(0, 2000) };
  try {
    return { message: JSON.stringify(error).slice(0, 2000) };
  } catch {
    return { message: String(error).slice(0, 2000) };
  }
}

/** Registra um erro. Nunca lança: o coletor não pode virar um erro novo. */
export async function reportError(
  error: unknown,
  opts: { context?: string; level?: ErrorLevel; extra?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const { message, trace } = describe(error);
    if (isDuplicate(`${opts.context}|${message}`)) return;
    await load();
    queue.push({
      level: opts.level ?? 'error',
      message,
      trace,
      context: opts.context?.slice(0, 56),
      occurred_at: new Date().toISOString(),
      meta: { ...(await deviceSnapshot()), ...(opts.extra ?? {}) },
    });
    if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
    await persist();
    scheduleFlush(3_000);
  } catch {
    // engolido de propósito
  }
}

function scheduleFlush(delay: number) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushErrors();
  }, delay);
}

/** Envia o que está na fila. Sem internet ou servidor fora: fica para a próxima. */
export async function flushErrors(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    await load();
    while (queue.length) {
      const batch = queue.slice(0, BATCH);
      const role = (await getSavedRole()) ?? undefined;
      const token = role ? await getAccessToken(role) : null;
      await axios.post(
        `${API_URL}/api/mobile/logs`,
        { entries: batch },
        {
          timeout: 15_000,
          headers: { 'X-Client': MOBILE_CLIENT_HEADER, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        },
      );
      queue = queue.slice(batch.length);
      await persist();
    }
  } catch {
    // tenta de novo no próximo ciclo
  } finally {
    flushing = false;
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };

/** Cada passo da instalação é isolado: o coletor nunca pode ser o motivo de o app quebrar. */
function attempt(step: () => void): void {
  try {
    step();
  } catch {
    // API ausente nesta versão do React Native / Expo Go: segue sem este gancho
  }
}

/** Liga a captura de erros soltos e o envio periódico. Chamar uma vez, no início do app. */
export function installErrorReporter(): void {
  if (installed || process.env.NODE_ENV === 'test') return;
  installed = true;

  // Erro não tratado no JavaScript (a "tela vermelha" / app fechando).
  attempt(() => {
    const eu = (globalThis as { ErrorUtils?: Partial<ErrorUtilsLike> }).ErrorUtils;
    if (typeof eu?.setGlobalHandler !== 'function') return;
    const previous = typeof eu.getGlobalHandler === 'function' ? eu.getGlobalHandler() : undefined;
    eu.setGlobalHandler((error, isFatal) => {
      void reportError(error, { context: isFatal ? 'fatal' : 'global', extra: { fatal: !!isFatal } }).then(() => (isFatal ? flushErrors() : undefined));
      if (typeof previous === 'function') previous(error, isFatal);
    });
  });

  // Promessa rejeitada sem tratamento (Hermes).
  attempt(() => {
    const hermes = (globalThis as { HermesInternal?: { enablePromiseRejectionTracker?: unknown } }).HermesInternal;
    const track = hermes?.enablePromiseRejectionTracker;
    if (typeof track !== 'function') return;
    (track as (o: unknown) => void).call(hermes, {
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => void reportError(rejection, { context: 'promise', level: 'warn' }),
      onHandled: () => undefined,
    });
  });

  attempt(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('error', (e) => void reportError(e.error ?? e.message, { context: 'global' }));
    window.addEventListener('unhandledrejection', (e) => void reportError(e.reason, { context: 'promise', level: 'warn' }));
  });

  // Envio periódico com o app na frente, e ao sair dele (antes que o sistema suspenda).
  attempt(() => {
    setInterval(() => {
      if (AppState.currentState === 'active' && queue.length) void flushErrors();
    }, FLUSH_EVERY_MS);
  });
  attempt(() => {
    AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'active') void flushErrors();
    });
  });
  void flushErrors();
}
