import { api } from './client';
import { clearTokens, setTokens } from './token-store';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  tenant_id?: string;
  role_code?: string;
  notification_prefs?: Record<string, unknown>;
};

type TokenBundle = {
  user: AuthUser;
  access_token?: string;
  refresh_token?: string;
};

type LoginResult =
  | TokenBundle
  | {
      status: 'mfa_required';
      mfa_token: string;
      method?: string;
      enabled_methods?: string[];
    }
  | {
      status: 'mfa_setup_required';
      setup_token: string;
      available_methods?: string[];
    };

export async function loginApi(input: {
  email: string;
  password: string;
  company_code: string;
}): Promise<LoginResult> {
  const { data } = await api.post('/api/auth/login', {
    email: input.email,
    password: input.password,
    company_code: input.company_code.toUpperCase(),
  });
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token);
  }
  return data as LoginResult;
}

export async function verifyMfaApi(input: {
  mfa_token: string;
  totp_code: string;
}): Promise<TokenBundle> {
  const { data } = await api.post('/api/auth/mfa/verify', input);
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token);
  }
  return data as TokenBundle;
}

export async function getMeApi(): Promise<AuthUser> {
  const { data } = await api.get('/api/auth/me');
  return data as AuthUser;
}

export async function logoutApi(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } finally {
    await clearTokens();
  }
}

export async function registerDevicePushToken(): Promise<void> {
  const result = await registerForPushNotificationsAsync();
  if (result.status !== 'granted') return;
  await api.post('/api/auth/device-tokens', {
    token: result.token,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
    app_version: '0.1.0',
  });
}
