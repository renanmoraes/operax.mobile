import { api } from './client';
import { clearTokens, setTokens } from './token-store';
import { Platform } from 'react-native';
import { grantedPushToken, registerForPushNotificationsAsync } from '@/src/features/notifications/push';
import { appVersionInfo } from '@/src/shared/updates/appVersion';

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
  /** Empresas do cliente. No portal real, `tenant_id` é o `access_id` daquela empresa. */
  memberships: { tenant_id: string; tenant_name: string; tenant_slug?: string; logo_url?: string | null }[];
  /** Conta da pessoa no Operax (portal real): tem identidade e já criou senha? Ausente no demo. */
  account?: { hasIdentity: boolean; hasPassword: boolean; /** E-mail da conta, mascarado ('r***@x.com'); nulo se a conta não tem; ausente em servidor antigo (a linha de e-mail não aparece). */ email?: string | null };
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

/**
 * O backend não devolve `kind` (é um discriminante só do app). Essas duas
 * funções marcam o objeto de usuário com o `kind` certo assim que a resposta
 * chega — é o único lugar que faz isso, pra não esquecer em nenhuma chamada.
 */
function asStaffUser(raw: unknown): StaffUser {
  return { ...(raw as object), kind: 'staff' } as StaffUser;
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

export type MfaMethod = 'totp' | 'email' | 'whatsapp';

/** Pede o código por e-mail ou WhatsApp (métodos que o login oferece além do autenticador). Devolve o desafio a responder. */
export async function sendMfaChallengeApi(input: { mfa_token: string; method: 'email' | 'whatsapp' }): Promise<{ challenge_id: string; message: string }> {
  const { data } = await api.post('/api/auth/mfa/challenge', { setup_token: input.mfa_token, method: input.method });
  return data as { challenge_id: string; message: string };
}

/** Confere o código de e-mail ou WhatsApp; o do autenticador segue por `verifyMfaApi`. */
export async function verifyMfaMethodApi(input: { mfa_token: string; code: string; method: 'email' | 'whatsapp'; challenge_id: string }): Promise<TokenBundle> {
  const { data } = await api.post('/api/auth/mfa/verify-method', { setup_token: input.mfa_token, code: input.code, method: input.method, challenge_id: input.challenge_id });
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

async function postDevicePushToken(token: string): Promise<void> {
  await api.post('/api/auth/device-tokens', {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
    app_version: appVersionInfo().version,
  });
}

/** Ao entrar na conta da equipe: pede a permissão (se faltar) e liga este aparelho ao usuário para receber push. */
export async function registerDevicePushToken(): Promise<void> {
  const result = await registerForPushNotificationsAsync();
  if (result.status !== 'granted') return;
  await postDevicePushToken(result.token);
}

/** Ao voltar para o app: renova o registro do aparelho, só se a permissão já foi dada (nunca abre o pedido). */
export async function registerDevicePushTokenIfGranted(): Promise<void> {
  const token = await grantedPushToken();
  if (token) await postDevicePushToken(token);
}

