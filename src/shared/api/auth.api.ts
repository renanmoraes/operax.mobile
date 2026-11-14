import { api } from './client';
import { clearTokens, setTokens } from './token-store';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';

export type StaffUser = {
  kind: 'staff';
  id: string;
  name: string;
  email: string;
  tenant_id?: string;
  role_code?: string;
  permissions?: string[];
  notification_prefs?: Record<string, unknown>;
};

export type ClientUser = {
  kind: 'client';
  id: string;
  name: string;
  email?: string;
  phone?: string;
  active_tenant_id: string | null;
  memberships: { tenant_id: string; tenant_name: string }[];
};

export type AuthUser = StaffUser | ClientUser;

type TokenBundle = {
  user: StaffUser;
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

export type ClientTokenBundle = {
  user: ClientUser;
  access_token: string;
  refresh_token: string;
};

export type ClientLoginResult = ClientTokenBundle | { status: 'no_portal_access' };

/**
 * O backend não devolve `kind` (é um discriminante só do app). Essas duas
 * funções marcam o objeto de usuário com o `kind` certo assim que a resposta
 * chega — é o único lugar que faz isso, pra não esquecer em nenhuma chamada.
 */
function asStaffUser(raw: unknown): StaffUser {
  return { ...(raw as object), kind: 'staff' } as StaffUser;
}

function asClientUser(raw: unknown): ClientUser {
  return { ...(raw as object), kind: 'client' } as ClientUser;
}

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
    await setTokens(data.access_token, data.refresh_token, 'staff');
  }
  if (data?.user) {
    return { ...data, user: asStaffUser(data.user) } as LoginResult;
  }
  return data as LoginResult; // status: mfa_required | mfa_setup_required
}

export async function verifyMfaApi(input: {
  mfa_token: string;
  totp_code: string;
}): Promise<TokenBundle> {
  const { data } = await api.post('/api/auth/mfa/verify', input);
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token, 'staff');
  }
  return { ...data, user: asStaffUser(data.user) } as TokenBundle;
}

export async function getMeApi(): Promise<StaffUser> {
  const { data } = await api.get('/api/auth/me');
  return asStaffUser(data);
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

export async function clientLoginApi(input: {
  identifier: string;
  password?: string;
}): Promise<ClientLoginResult> {
  const { data } = await api.post('/api/auth/client/login', input);
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token, 'client');
  }
  if (data?.user) {
    return { ...data, user: asClientUser(data.user) } as ClientLoginResult;
  }
  return data as ClientLoginResult; // { status: 'no_portal_access' }
}

export async function requestClientOtpApi(input: { identifier: string }): Promise<void> {
  await api.post('/api/auth/client/otp/request', input);
}

export async function verifyClientOtpApi(input: {
  identifier: string;
  code: string;
}): Promise<ClientLoginResult> {
  const { data } = await api.post('/api/auth/client/otp/verify', input);
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token, 'client');
  }
  if (data?.user) {
    return { ...data, user: asClientUser(data.user) } as ClientLoginResult;
  }
  return data as ClientLoginResult; // { status: 'no_portal_access' }
}

export async function getClientMeApi(): Promise<ClientUser> {
  const { data } = await api.get('/api/auth/client/me');
  return asClientUser(data);
}

export async function switchClientTenantApi(input: { tenant_id: string }): Promise<void> {
  const { data } = await api.post('/api/auth/client/switch-tenant', input);
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token, 'client');
  }
}
