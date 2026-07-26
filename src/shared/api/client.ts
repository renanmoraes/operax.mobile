import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './token-store';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: {
    'X-Client': MOBILE_CLIENT_HEADER,
    Accept: 'application/json',
  },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = await getRefreshToken();
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
      await setTokens(access, nextRefresh);
      return access;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client'] = MOBILE_CLIENT_HEADER;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = String(original?.url ?? '');
    const isAuthRoute =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/logout') ||
      url.includes('/api/auth/mfa/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        const access = await refreshAccessToken();
        if (!access) throw error;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        await clearTokens();
      }
    }
    return Promise.reject(error);
  },
);
