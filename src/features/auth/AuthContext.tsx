import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthUser,
  ClientLoginResult,
  ClientUser,
  StaffUser,
  clientLoginApi,
  getClientMeApi,
  getMeApi,
  loginApi,
  logoutApi,
  registerDevicePushToken,
  requestClientOtpApi,
  switchClientTenantApi,
  verifyClientOtpApi,
  verifyMfaApi,
} from '@/src/shared/api/auth.api';
import {
  clearSavedRole,
  clearTokens,
  getAccessToken,
  getSavedRole,
  setSavedRole,
  SavedRole,
} from '@/src/shared/api/token-store';
import { connectSocket, disconnectSocket } from '@/src/shared/realtime/socket';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';

type AuthMode = 'mock' | 'live';
export type Role = SavedRole;

type AuthState = {
  ready: boolean;
  mode: AuthMode;
  role: Role | null;
  isAuthenticated: boolean;
  needsMfa: boolean;
  mfaToken: string | null;
  user: AuthUser | null;
  error: string | null;
  clearError: () => void;
  selectRole: (role: Role) => Promise<void>;
  clearRole: () => Promise<void>;
  login: (email: string, password: string, companyCode: string) => Promise<'mfa' | 'ok'>;
  enterDemo: () => void;
  verifyMfa: (code: string) => Promise<void>;
  clientLogin: (identifier: string, password?: string) => Promise<'blocked' | 'ok'>;
  requestClientOtp: (identifier: string) => Promise<void>;
  verifyClientOtp: (identifier: string, code: string) => Promise<'blocked' | 'ok'>;
  switchTenant: (tenantId: string) => Promise<void>;
  enterClientDemo: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const DEMO_USER: StaffUser = {
  kind: 'staff',
  id: 'u1',
  name: 'Ana Atendente',
  email: 'ana@clinica.exemplo',
  role_code: 'agent',
};

const DEMO_CLIENT_USER: ClientUser = {
  kind: 'client',
  id: 'c1',
  name: 'Marina Duarte',
  email: 'marina.duarte@email.com',
  active_tenant_id: null,
  memberships: [
    { tenant_id: 't1', tenant_name: 'Move Studio' },
    { tenant_id: 't2', tenant_name: 'Studio Bela Vista' },
    { tenant_id: 't3', tenant_name: 'Clínica Vitta' },
  ],
};

const DEMO_FLAG = 'operax_demo_mock';

function readDemoFlag(): boolean {
  try {
    return globalThis.localStorage?.getItem(DEMO_FLAG) === '1';
  } catch {
    return false;
  }
}

function writeDemoFlag(on: boolean) {
  try {
    if (on) globalThis.localStorage?.setItem(DEMO_FLAG, '1');
    else globalThis.localStorage?.removeItem(DEMO_FLAG);
  } catch {
    /* ignore */
  }
}

function messageFromError(err: unknown, fallback: string): string {
  const msg =
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
  return Array.isArray(msg) ? msg.join(', ') : String(msg);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>('live');
  const [role, setRole] = useState<Role | null>(null);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let savedRole: Role | null = null;
    (async () => {
      try {
        if (readDemoFlag()) {
          const demoRole = (await getSavedRole()) ?? 'staff';
          if (!alive) return;
          setMode('mock');
          setRole(demoRole);
          setUser(demoRole === 'client' ? DEMO_CLIENT_USER : DEMO_USER);
          setAuthenticated(true);
          return;
        }

        savedRole = await getSavedRole();
        const token = await getAccessToken();
        if (!token) {
          if (alive) setRole(savedRole);
          return;
        }

        if (savedRole == null) {
          // Instalação de antes deste recurso: só existia staff.
          savedRole = 'staff';
          await setSavedRole('staff');
        }

        if (savedRole === 'staff') {
          const me = await getMeApi();
          if (!alive) return;
          setMode('live');
          setRole('staff');
          setUser(me);
          setAuthenticated(true);
          await connectSocket();
          void registerDevicePushToken();
        } else {
          const me = await getClientMeApi();
          if (!alive) return;
          setMode('live');
          setRole('client');
          setUser(me);
          setAuthenticated(true);
          await connectSocket();
          void registerDevicePushToken();
        }
      } catch {
        try {
          await clearTokens();
        } catch {
          /* web/native store pode estar indisponível no boot */
        }
        // Sessão inválida/expirada: mantém o papel salvo pra cair na tela de
        // login certa (staff ou cliente), não na escolha de papel de novo.
        if (alive) setRole(savedRole);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    function applyClientResult(result: ClientLoginResult): 'blocked' | 'ok' {
      if ('status' in result) {
        return 'blocked';
      }
      setUser(result.user);
      setAuthenticated(true);
      void connectSocket();
      void registerDevicePushToken();
      return 'ok';
    }

    return {
      ready,
      mode,
      role,
      isAuthenticated,
      needsMfa,
      mfaToken,
      user,
      error,
      clearError: () => setError(null),

      selectRole: async (nextRole) => {
        await setSavedRole(nextRole);
        setRole(nextRole);
      },

      clearRole: async () => {
        writeDemoFlag(false);
        await clearSavedRole();
        await clearTokens();
        disconnectSocket();
        setRole(null);
        setAuthenticated(false);
        setNeedsMfa(false);
        setMfaToken(null);
        setUser(null);
        setError(null);
      },

      login: async (email, password, companyCode) => {
        if (!companyCode || companyCode.trim().length !== 4) {
          setError('Informe o código da empresa (4 letras).');
          throw new Error('company_code');
        }
        setError(null);
        setMode('live');
        try {
          const result = await loginApi({ email, password, company_code: companyCode.trim() });
          if ('status' in result && result.status === 'mfa_required') {
            setNeedsMfa(true);
            setMfaToken(result.mfa_token);
            setAuthenticated(false);
            return 'mfa';
          }
          if ('status' in result && result.status === 'mfa_setup_required') {
            setError('Configure o MFA no app web antes de usar o mobile.');
            setNeedsMfa(false);
            setAuthenticated(false);
            throw new Error('mfa_setup_required');
          }
          const bundle = result as { user: StaffUser };
          setUser(bundle.user);
          setNeedsMfa(false);
          setMfaToken(null);
          setAuthenticated(true);
          await connectSocket();
          void registerDevicePushToken();
          return 'ok';
        } catch (err) {
          setError(messageFromError(err, 'Falha no login. Verifique e-mail, senha e conexão.'));
          throw err;
        }
      },

      enterDemo: () => {
        writeDemoFlag(true);
        setMode('mock');
        setRole('staff');
        setNeedsMfa(false);
        setMfaToken(null);
        setAuthenticated(true);
        setUser(DEMO_USER);
        setError(null);
        void registerForPushNotificationsAsync();
      },

      verifyMfa: async (code) => {
        if (mode === 'mock' || !mfaToken) {
          setNeedsMfa(false);
          setAuthenticated(true);
          return;
        }
        setError(null);
        try {
          const result = await verifyMfaApi({ mfa_token: mfaToken, totp_code: code });
          setUser(result.user);
          setNeedsMfa(false);
          setMfaToken(null);
          setAuthenticated(true);
          await connectSocket();
          void registerDevicePushToken();
        } catch (err) {
          setError('Código MFA inválido.');
          throw err;
        }
      },

      clientLogin: async (identifier, password) => {
        setError(null);
        setMode('live');
        try {
          const result = await clientLoginApi({ identifier, password });
          return applyClientResult(result);
        } catch (err) {
          setError(messageFromError(err, 'Falha no login. Verifique os dados e a conexão.'));
          throw err;
        }
      },

      requestClientOtp: async (identifier) => {
        setError(null);
        try {
          await requestClientOtpApi({ identifier });
        } catch (err) {
          setError(messageFromError(err, 'Não foi possível enviar o código. Tente de novo.'));
          throw err;
        }
      },

      verifyClientOtp: async (identifier, code) => {
        setError(null);
        try {
          const result = await verifyClientOtpApi({ identifier, code });
          return applyClientResult(result);
        } catch {
          setError('Código inválido ou expirado.');
          throw new Error('invalid_otp');
        }
      },

      switchTenant: async (tenantId) => {
        if (mode === 'mock') {
          // Modo demo: não existe backend real pra escopar o token, só troca
          // a empresa ativa localmente (ver Task 11/12 do plano).
          setUser((prev) => (prev?.kind === 'client' ? { ...prev, active_tenant_id: tenantId } : prev));
          return;
        }
        await switchClientTenantApi({ tenant_id: tenantId });
        const me = await getClientMeApi();
        setUser(me);
        disconnectSocket();
        await connectSocket();
      },

      enterClientDemo: () => {
        writeDemoFlag(true);
        setMode('mock');
        setRole('client');
        setAuthenticated(true);
        setUser(DEMO_CLIENT_USER);
        setError(null);
      },

      logout: async () => {
        writeDemoFlag(false);
        if (mode === 'live') {
          try {
            await logoutApi();
          } catch {
            await clearTokens();
          }
        } else {
          await clearTokens();
        }
        disconnectSocket();
        setAuthenticated(false);
        setNeedsMfa(false);
        setMfaToken(null);
        setUser(null);
        setMode('live');
      },
    };
  }, [ready, mode, role, isAuthenticated, needsMfa, mfaToken, user, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
