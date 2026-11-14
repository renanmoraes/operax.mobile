import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { clearTokens, getAccessToken, getRefreshToken, getSavedRole, SavedRole, setTokens } from './token-store';

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
  return config;
});

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
  (res) => res,
  async (error: AxiosError) => {
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
    return Promise.reject(error);
  },
);
