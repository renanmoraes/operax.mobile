import axios from 'axios';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { getAccessToken, getSavedRole } from '@/src/shared/api/token-store';
import { addBreadcrumb, bumpErrorAttempts, insertError, markErrorsSent, pendingErrors, recentBreadcrumbs, type Breadcrumb } from '@/src/shared/db/localDb';
import * as Updates from 'expo-updates';
import { appVersionHeader } from '@/src/shared/updates/versionInfo';

/**
 * Erros do app → servidor (`POST /api/mobile/logs`, gravado em `system_logs` com origem `mobile`).
 *
 * Não é telemetria de uso: só vai quando algo QUEBRA (tela que travou, erro solto, chamada à API que
 * falhou por servidor ou rede). Cada erro leva o retrato do aparelho naquele momento — modelo,
 * sistema, versão do app, rede, bateria, tela atual e as últimas telas — para dar para entender
 * a reclamação do usuário. Nunca vai conteúdo de mensagem, dado de paciente nem corpo de requisição.
 * Leva também a última localização conhecida (só se a pessoa liberou a localização, que o app pede
 * para os treinos com GPS) e as últimas ações: telas, toques em botões e chamadas à API.
 *
 * Fica no banco local (SQLite) — sobrevive a sem internet e a fechar o app — e é enviado de tempo em tempo.
 */

export type ErrorLevel = 'error' | 'warn';

const BATCH = 50;
const FLUSH_EVERY_MS = 60_000;

let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;
let hasPending = false;

/** Últimas telas visitadas (só o caminho), para saber o que a pessoa fez antes do erro. */
const routes: string[] = [];
let session: { role?: string; mode?: string; tenant?: string | null } = {};

export function trackRoute(pathname: string): void {
  if (!pathname || routes[routes.length - 1] === pathname) return;
  routes.push(pathname);
  if (routes.length > 12) routes.shift();
  void addBreadcrumb({ at: new Date().toISOString(), kind: 'screen', label: pathname });
}

/** Ação da pessoa (toque num botão, envio de formulário): entra na trilha que acompanha o erro. */
export function trackAction(label: string, data?: Breadcrumb['data'], kind: Breadcrumb['kind'] = 'tap'): void {
  if (!label) return;
  void addBreadcrumb({ at: new Date().toISOString(), kind, label: `${routes[routes.length - 1] ?? ''} · ${label}`, ...(data ? { data } : {}) });
}

/** Última posição conhecida (sem ligar o GPS), só com a permissão já dada. */
async function lastLocation(): Promise<Record<string, unknown> | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const p = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 });
    if (!p) return null;
    const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
    return { lat: r4(p.coords.latitude), lng: r4(p.coords.longitude), accuracy_m: p.coords.accuracy != null ? Math.round(p.coords.accuracy) : null, altitude_m: p.coords.altitude != null ? Math.round(p.coords.altitude) : null, at: new Date(p.timestamp).toISOString() };
  } catch {
    return null;
  }
}

/** Quem está usando (o servidor confere pelo token; isto é só para leitura do log). */
export function setReporterSession(next: typeof session): void {
  session = next;
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
      update_id: Updates.isEnabled ? Updates.updateId : null,
      channel: Updates.isEnabled ? Updates.channel : null,
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
    const [snapshot, location, breadcrumbs] = await Promise.all([deviceSnapshot(), lastLocation(), recentBreadcrumbs(25)]);
    await insertError({
      created_at: new Date().toISOString(),
      level: opts.level ?? 'error',
      message,
      trace: trace ?? null,
      context: opts.context?.slice(0, 56) ?? null,
      meta: { ...snapshot, location, breadcrumbs, ...(opts.extra ?? {}) },
    });
    hasPending = true;
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
    for (;;) {
      const rows = await pendingErrors(BATCH);
      hasPending = rows.length > 0;
      if (!rows.length) break;
      const role = (await getSavedRole()) ?? undefined;
      const token = role ? await getAccessToken(role) : null;
      const entries = rows.map((r) => ({
        level: r.level === 'warn' ? 'warn' : 'error',
        message: r.message,
        ...(r.trace ? { trace: r.trace } : {}),
        ...(r.context ? { context: r.context } : {}),
        occurred_at: r.created_at,
        meta: { ...(r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : {}), send_attempts: r.attempts + 1 },
      }));
      try {
        await axios.post(`${API_URL}/api/mobile/logs`, { entries }, { timeout: 15_000, headers: { 'X-Client': MOBILE_CLIENT_HEADER, 'X-App-Version': appVersionHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      } catch {
        await bumpErrorAttempts(rows.map((r) => r.id));
        break; // sem internet ou servidor fora: fica para o próximo ciclo
      }
      await markErrorsSent(rows.map((r) => r.id));
      if (rows.length < BATCH) break;
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
      if (AppState.currentState === 'active' && hasPending) void flushErrors();
    }, FLUSH_EVERY_MS);
  });
  attempt(() => {
    AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'active') void flushErrors();
    });
  });
  void flushErrors();
}
