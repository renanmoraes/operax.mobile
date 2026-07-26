import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthUser,
  getMeApi,
  loginApi,
  logoutApi,
  registerDevicePushToken,
  verifyMfaApi,
} from '@/src/shared/api/auth.api';
import { clearTokens, getAccessToken } from '@/src/shared/api/token-store';
import { connectSocket, disconnectSocket } from '@/src/shared/realtime/socket';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';

type AuthMode = 'mock' | 'live';

type AuthState = {
  ready: boolean;
  mode: AuthMode;
  isAuthenticated: boolean;
  needsMfa: boolean;
  mfaToken: string | null;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string, companyCode: string) => Promise<'mfa' | 'ok'>;
  enterDemo: () => void;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const DEMO_USER: AuthUser = {
  id: 'u1',
  name: 'Ana Atendente',
  email: 'ana@clinica.exemplo',
  role_code: 'agent',
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>('live');
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (readDemoFlag()) {
          if (!alive) return;
          setMode('mock');
          setUser(DEMO_USER);
          setAuthenticated(true);
          return;
        }
        const token = await getAccessToken();
        if (!token) return;
        const me = await getMeApi();
        if (!alive) return;
        setMode('live');
        setUser(me);
        setAuthenticated(true);
        await connectSocket();
        void registerDevicePushToken();
      } catch {
        try {
          await clearTokens();
        } catch {
          /* web/native store may be unavailable during boot */
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      mode,
      isAuthenticated,
      needsMfa,
      mfaToken,
      user,
      error,
      clearError: () => setError(null),
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
          const bundle = result as { user: AuthUser };
          setUser(bundle.user);
          setNeedsMfa(false);
          setMfaToken(null);
          setAuthenticated(true);
          await connectSocket();
          void registerDevicePushToken();
          return 'ok';
        } catch (err) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Falha no login. Verifique e-mail, senha e conexão.';
          setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
          throw err;
        }
      },
      enterDemo: () => {
        writeDemoFlag(true);
        setMode('mock');
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
    }),
    [ready, mode, isAuthenticated, needsMfa, mfaToken, user, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
