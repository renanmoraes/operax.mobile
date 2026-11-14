import axios, { AxiosError, InternalAxiosRequestConfig, isCancel } from 'axios';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { clearTokens, getAccessToken, getRefreshToken, getSavedRole, SavedRole, setTokens } from './token-store';
import { refreshSocketAuth } from '@/src/shared/realtime/socket';
import { reportError, trackAction } from '@/src/shared/telemetry/errorReporter';

// `axios.create` é o uso documentado da biblioteca; o aviso de import nomeado não se aplica.
// eslint-disable-next-line import/no-named-as-default-member
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: {
    'X-Client': MOBILE_CLIENT_HEADER,
    Accept: 'application/json',
  },
});

/** `_role`: a conta (equipe ou cliente) que estava aberta quando a requisição saiu. */
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean; _role?: SavedRole };

// Uma renovação por conta: trocar de conta no meio de uma renovação não mistura os tokens.
const refreshing: Partial<Record<SavedRole, Promise<string | null>>> = {};

async function refreshAccessToken(role: SavedRole): Promise<string | null> {
  // O portal do cliente não tem renovação: sessão vencida = entrar de novo.
  if (role === 'client') return null;
  if (!refreshing[role]) {
    refreshing[role] = (async () => {
      const refresh = await getRefreshToken(role);
      if (!refresh) return null;
      const { data } = await axios.post(
        `${API_URL}/api/auth/refresh`,
        { refresh_token: refresh },
        {
          headers: {
            'X-Client': MOBILE_CLIENT_HEADER,
            Authorization: `Bearer ${refresh}`,
            Accept: 'application/json',
          },
          timeout: 30_000,
        },
      );
      const access = data?.access_token as string | undefined;
      const nextRefresh = (data?.refresh_token as string | undefined) ?? refresh;
      if (!access) return null;
      // Grava na conta que pediu, mesmo que a pessoa já tenha trocado de conta.
      await setTokens(access, nextRefresh, role);
      // O tempo real usa o mesmo token: troca na conexão aberta (senão cai ao vencer).
      if (role === 'staff') void refreshSocketAuth();
      return access;
    })().finally(() => {
      delete refreshing[role];
    });
  }
  return refreshing[role]!;
}

api.interceptors.request.use(async (config) => {
  // Repetição depois de renovar já vem com a conta marcada: mantém a mesma.
  const role = (config as RetriableConfig)._role ?? (await getSavedRole()) ?? 'staff';
  (config as RetriableConfig)._role = role;
  const token = await getAccessToken(role);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client'] = MOBILE_CLIENT_HEADER;
  (config as RetriableConfig & { _t0?: number })._t0 = Date.now();
  return config;
});

/** Chamada à API entra na trilha de ações (método, rota sem query, status e tempo). */
function trackApi(config: InternalAxiosRequestConfig | undefined, status: number | string) {
  if (!config?.url) return;
  const path = String(config.url).split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  if (path.includes('/api/mobile/logs')) return;
  const ms = Date.now() - ((config as { _t0?: number })._t0 ?? Date.now());
  trackAction(`${String(config.method ?? 'get').toUpperCase()} ${path} → ${status}`, { ms }, 'api');
}

const AUTH_ROUTE_PATTERNS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/mfa/',
  '/api/auth/client/login',
  '/api/auth/client/otp/',
];

export function isAuthRoute(url: string): boolean {
  return AUTH_ROUTE_PATTERNS.some((pattern) => url.includes(pattern));
}

api.interceptors.response.use(
  (res) => {
    trackApi(res.config, res.status);
    return res;
  },
  async (error: AxiosError) => {
    trackApi(error.config, error.response?.status ?? error.code ?? 'sem resposta');
    const original = error.config as RetriableConfig | undefined;
    const url = String(original?.url ?? '');

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute(url)) {
      original._retry = true;
      const role = original._role ?? (await getSavedRole()) ?? 'staff';
      try {
        const access = await refreshAccessToken(role);
        if (!access) throw error;
        original.headers.Authorization = `Bearer ${access}`;
        original._role = role;
        return api(original);
      } catch {
        // Só a conta que falhou sai; a outra (talvez a aberta agora) continua.
        await clearTokens(role);
      }
    }
    reportApiFailure(error, url);
    return Promise.reject(error);
  },
);

/**
 * Falha do servidor (5xx) ou sem resposta (rede, tempo esgotado) vira log de erro do celular.
 * 4xx é regra de negócio respondida (senha errada, sem permissão) e não entra. Só método, rota e
 * status: nunca o corpo nem a query (podem ter dado pessoal).
 */
function reportApiFailure(error: AxiosError, url: string) {
  const status = error.response?.status;
  if (status != null && status < 500) return;
  if (isCancel(error)) return;
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  const method = String(error.config?.method ?? 'get').toUpperCase();
  const message = status ? `API ${status} em ${method} ${path}` : `Sem resposta da API em ${method} ${path} (${error.code ?? 'rede'})`;
  // A mensagem curta e estável agrupa o mesmo problema no painel (o objeto do axios variaria a cada vez).
  void reportError(message, {
    context: `api ${method} ${path}`.slice(0, 56),
    level: status ? 'error' : 'warn',
    extra: { request: { method, path, status: status ?? null, code: error.code ?? null, server_message: typeof (error.response?.data as { message?: unknown })?.message === 'string' ? (error.response?.data as { message: string }).message.slice(0, 300) : null } },
  });
}
