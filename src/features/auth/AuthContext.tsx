import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthUser, ClientUser, StaffUser, getMeApi, loginApi, logoutApi, registerDevicePushToken, verifyMfaApi } from '@/src/shared/api/auth.api';
import {
  PortalLoginResult,
  portalHome,
  portalLogout,
  portalMyCompanies,
  portalPasswordLogin,
  portalRequestCode,
  portalSelectCompany,
  portalSetPassword,
  portalSwitch,
  portalVerifyCode,
} from '@/src/shared/api/portal.api';
import { portalUser, portalUserWithoutSession } from '@/src/features/client/portalMapping';
import { setClientDataMode } from '@/src/features/client/dataMode';
import {
  AccountSummary,
  clearSavedRole,
  clearTokens,
  getAccountSummary,
  getRefreshToken,
  getSavedRole,
  hasSession,
  migrateLegacyTokens,
  saveAccountSummary,
  setRefreshToken,
  setSavedRole,
  setTokens,
  SavedRole,
} from '@/src/shared/api/token-store';
import { connectSocket, disconnectSocket } from '@/src/shared/realtime/socket';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';

type AuthMode = 'mock' | 'live';
export type Role = SavedRole;
export type { AccountSummary };
type Accounts = Partial<Record<Role, AccountSummary>>;

export const otherRole = (r: Role): Role => (r === 'staff' ? 'client' : 'staff');

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
  /** Código certo: entra (ok), ou no primeiro acesso pede para criar a senha (set_password). */
  verifyClientOtp: (identifier: string, code: string) => Promise<'blocked' | 'ok' | 'set_password'>;
  /** Primeiro acesso pelo código: cria a senha e entra. */
  setClientPassword: (password: string) => Promise<'blocked' | 'ok'>;
  switchTenant: (tenantId: string) => Promise<void>;
  enterClientDemo: () => void;
  logout: () => Promise<void>;
  /** Contas guardadas no aparelho (no máximo uma de equipe e uma de cliente). */
  accounts: Accounts;
  /** Troca para a outra conta já guardada, sem novo login. */
  switchAccount: (role: Role) => Promise<void>;
  /** Abre o login do outro lado sem sair da conta atual. */
  addAccount: (role: Role) => Promise<void>;
  /** Papel para onde voltar se a pessoa desistir de adicionar a conta. */
  returnRole: Role | null;
  /** `true` quando voltou para a conta anterior; em falha passageira fica no login para tentar de novo. */
  cancelAddAccount: () => Promise<boolean>;
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

/** Usuário cliente a partir da sessão da empresa no portal (me/home + empresas). */
async function loadPortalUser(fallbackCompanies: Parameters<typeof portalUser>[1] = []): Promise<ClientUser> {
  const [home, companies] = await Promise.all([portalHome(), portalMyCompanies().catch(() => fallbackCompanies)]);
  return portalUser(home, companies.length ? companies : fallbackCompanies);
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
  const [accounts, setAccounts] = useState<Accounts>({});
  const [returnRole, setReturnRole] = useState<Role | null>(null);
  // Portal do cliente: identidade (lista/escolha de empresa), desafio do código e ticket do primeiro acesso.
  const portalIdentity = useRef<string | null>(null);
  const portalChallenge = useRef<string | null>(null);
  const portalSetup = useRef<string | null>(null);
  /** Guarda a empresa escolhida no demo de cliente entre uma troca e outra. */
  const demoClientRef = useRef<ClientUser>(DEMO_CLIENT_USER);

  useEffect(() => {
    let alive = true;
    let savedRole: Role | null = null;
    (async () => {
      try {
        await migrateLegacyTokens();
        const [staffSummary, clientSummary] = await Promise.all([getAccountSummary('staff'), getAccountSummary('client')]);
        const known: Accounts = {};
        if (staffSummary && (staffSummary.demo || (await hasSession('staff')))) known.staff = staffSummary;
        if (clientSummary && (clientSummary.demo || (await hasSession('client')))) known.client = clientSummary;
        if (alive) setAccounts(known);

        savedRole = await getSavedRole();

        // Adicionar conta interrompido (app fechado no meio do login): volta para a conta salva que
        // existe, inclusive se ela for demo. Resolve isso antes de decidir entre demo e sessão real.
        if (savedRole && !known[savedRole]?.demo && !(await hasSession(savedRole))) {
          const other = otherRole(savedRole);
          if (known[other]) {
            savedRole = other;
            await setSavedRole(other);
          }
        }

        const legacyDemo = readDemoFlag() && !staffSummary && !clientSummary;
        const active = savedRole ? known[savedRole] : undefined;

        if (legacyDemo || active?.demo) {
          const demoRole = savedRole ?? 'staff';
          if (!alive) return;
          setMode('mock');
          setRole(demoRole);
          setUser(demoRole === 'client' ? DEMO_CLIENT_USER : DEMO_USER);
          setAuthenticated(true);
          return;
        }

        if (savedRole == null && (await hasSession('staff'))) {
          // Instalação de antes deste recurso: só existia staff.
          savedRole = 'staff';
          await setSavedRole('staff');
        }

        if (savedRole == null || !(await hasSession(savedRole))) {
          if (alive) setRole(savedRole);
          return;
        }

        // Sessão restaurada sem resumo (veio de instalação antiga): registra na troca de contas.
        const registerIfMissing = (r: Role, u: AuthUser) => {
          if (known[r]) return;
          const summary: AccountSummary = { role: r, name: u.name || (r === 'staff' ? 'Equipe' : 'Cliente'), email: u.email ?? undefined, demo: false };
          void saveAccountSummary(summary);
          setAccounts((prev) => ({ ...prev, [r]: summary }));
        };

        if (savedRole === 'staff') {
          const me = await getMeApi();
          if (!alive) return;
          registerIfMissing('staff', me);
          setMode('live');
          setRole('staff');
          setUser(me);
          setAuthenticated(true);
          await connectSocket();
          void registerDevicePushToken();
        } else {
          // Cliente: sessão da empresa no portal (me/home + empresas).
          const me = await loadPortalUser();
          if (!alive) return;
          registerIfMissing('client', me);
          setMode('live');
          setRole('client');
          setUser(me);
          setAuthenticated(true);
        }
      } catch {
        try {
          await clearTokens(savedRole ?? undefined);
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

  // As funções de dados do cliente (agenda, chat, treino) seguem o modo do login.
  useEffect(() => {
    setClientDataMode(mode);
  }, [mode]);

  const value = useMemo<AuthState>(() => {
    function remember(r: Role, u: AuthUser, demo: boolean) {
      const summary: AccountSummary = { role: r, name: u.name || (r === 'staff' ? 'Equipe' : 'Cliente'), email: u.email ?? undefined, demo };
      void saveAccountSummary(summary);
      setAccounts((prev) => ({ ...prev, [r]: summary }));
    }

    function forget(r: Role) {
      setAccounts((prev) => {
        const next = { ...prev };
        delete next[r];
        return next;
      });
    }

    /**
     * Resultado de login do portal: guarda a identidade, abre a sessão da empresa (se veio uma)
     * e monta o usuário. Sem empresa ainda, vai para a escolha de empresa.
     */
    async function enterPortal(result: PortalLoginResult): Promise<'blocked' | 'ok'> {
      if (!result.session && result.companies.length === 0) return 'blocked';
      // Antes de qualquer chamada `me/*`: o token de cliente é o que vai no cabeçalho.
      await setSavedRole('client');
      setMode('live');
      if (result.identity_token) {
        portalIdentity.current = result.identity_token;
        await setRefreshToken(result.identity_token, 'client');
      }
      let next: ClientUser;
      if (result.session) {
        await setTokens(result.session.access_token, portalIdentity.current ?? '', 'client');
        next = await loadPortalUser(result.companies);
      } else {
        next = portalUserWithoutSession(result.companies);
      }
      setUser(next);
      setAuthenticated(true);
      setRole('client');
      setReturnRole(null);
      remember('client', next, false);
      return 'ok';
    }

    /**
     * Abre a conta salva `target`. `leaving`: a conta atual acabou de sair (logout) e não existe
     * mais para onde voltar. `returnRole` só é limpo quando a troca dá certo, para "Voltar" poder
     * tentar de novo depois de uma falha passageira.
     */
    async function switchTo(target: Role, known: Accounts, opts?: { leaving?: boolean }): Promise<boolean> {
      const summary = known[target];
      if (!summary) return false;
      disconnectSocket();
      await setSavedRole(target);
      setNeedsMfa(false);
      setMfaToken(null);
      setError(null);
      if (summary.demo) {
        setMode('mock');
        setRole(target);
        setUser(target === 'client' ? demoClientRef.current : DEMO_USER);
        setAuthenticated(true);
        setReturnRole(null);
        return true;
      }
      try {
        const me = target === 'staff' ? await getMeApi() : await loadPortalUser();
        setMode('live');
        setRole(target);
        setUser(me);
        setAuthenticated(true);
        setReturnRole(null);
        await connectSocket();
        void registerDevicePushToken();
        return true;
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          // Sessão daquela conta foi recusada pelo servidor: cai no login dela.
          await clearTokens(target);
          forget(target);
          setMode('live');
          setRole(target);
          setUser(null);
          setAuthenticated(false);
          setReturnRole(null);
          return false;
        }
        if (opts?.leaving) {
          // A conta de onde saiu já não tem sessão: nada de voltar para ela. Fica no login da outra
          // conta (o acesso salvo dela continua guardado e volta a valer ao abrir o app de novo).
          setMode('live');
          setRole(target);
          setUser(null);
          setAuthenticated(false);
          setError('Você saiu da conta, mas não foi possível abrir a outra agora. Confira a internet e tente de novo.');
          return false;
        }
        // Falha passageira (sem internet, servidor fora): a conta salva continua guardada e
        // a pessoa segue onde estava, podendo tentar trocar de novo.
        if (role && role !== target) {
          await setSavedRole(role);
          if (isAuthenticated) void connectSocket();
        }
        setError('Não foi possível trocar de conta agora. Confira a internet e tente de novo.');
        return false;
      }
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
        if (role && !accounts[role]) await clearTokens(role);
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
          setRole('staff');
          setReturnRole(null);
          await setSavedRole('staff');
          remember('staff', bundle.user, false);
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
        setReturnRole(null);
        void setSavedRole('staff');
        remember('staff', DEMO_USER, true);
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
          setRole('staff');
          setReturnRole(null);
          await setSavedRole('staff');
          remember('staff', result.user, false);
          await connectSocket();
          void registerDevicePushToken();
        } catch (err) {
          setError('Código MFA inválido.');
          throw err;
        }
      },

      clientLogin: async (identifier, password) => {
        setError(null);
        try {
          return await enterPortal(await portalPasswordLogin(identifier, password ?? ''));
        } catch (err) {
          setError(messageFromError(err, 'Falha no login. Verifique os dados e a conexão.'));
          throw err;
        }
      },

      requestClientOtp: async (identifier) => {
        setError(null);
        try {
          const r = await portalRequestCode(identifier);
          portalChallenge.current = r.challenge_id;
        } catch (err) {
          setError(messageFromError(err, 'Não foi possível enviar o código. Tente de novo.'));
          throw err;
        }
      },

      verifyClientOtp: async (_identifier, code) => {
        setError(null);
        try {
          if (!portalChallenge.current) throw new Error('sem_desafio');
          const r = await portalVerifyCode(portalChallenge.current, code);
          if ('step' in r && r.step === 'password') {
            portalSetup.current = r.setup_ticket;
            return 'set_password';
          }
          return await enterPortal(r as PortalLoginResult);
        } catch (err) {
          setError(messageFromError(err, 'Código inválido ou expirado.'));
          throw new Error('invalid_otp');
        }
      },

      setClientPassword: async (password) => {
        setError(null);
        try {
          if (!portalSetup.current) throw new Error('sem_ticket');
          const r = await portalSetPassword(portalSetup.current, password);
          portalSetup.current = null;
          return await enterPortal(r);
        } catch (err) {
          setError(messageFromError(err, 'Não foi possível criar a senha. Tente de novo.'));
          throw err;
        }
      },

      switchTenant: async (tenantId) => {
        if (mode === 'mock') {
          // Modo demo: não existe backend real pra escopar o token, só troca
          // a empresa ativa localmente.
          setUser((prev) => {
            if (prev?.kind !== 'client') return prev;
            const next = { ...prev, active_tenant_id: tenantId };
            demoClientRef.current = next;
            return next;
          });
          return;
        }
        // `tenantId` é o access_id da empresa no portal. Com sessão aberta troca por ela;
        // logo após o login (sem empresa ainda) escolhe com o token de identidade.
        const hasCompany = user?.kind === 'client' && !!user.active_tenant_id && (await hasSession('client'));
        if (hasCompany) {
          await enterPortal(await portalSwitch(tenantId));
          return;
        }
        const identity = portalIdentity.current ?? (await getRefreshToken('client'));
        if (!identity) throw new Error('Sessão expirada. Entre de novo.');
        await enterPortal(await portalSelectCompany(identity, tenantId));
      },

      enterClientDemo: () => {
        writeDemoFlag(true);
        setMode('mock');
        setRole('client');
        setAuthenticated(true);
        demoClientRef.current = DEMO_CLIENT_USER;
        setUser(DEMO_CLIENT_USER);
        setError(null);
        setReturnRole(null);
        void setSavedRole('client');
        remember('client', DEMO_CLIENT_USER, true);
      },

      logout: async () => {
        const current = role;
        if (mode === 'live' && current === 'client') {
          await portalLogout().catch(() => undefined);
          await clearTokens('client');
          portalIdentity.current = null;
        } else if (mode === 'live') {
          try {
            await logoutApi();
          } catch {
            await clearTokens(current ?? undefined);
          }
        } else {
          await clearTokens(current ?? undefined);
        }
        disconnectSocket();
        const remaining: Accounts = { ...accounts };
        if (current) {
          delete remaining[current];
          forget(current);
        }
        // A conta que saiu deixa de valer já, antes de tentar abrir a outra.
        setAuthenticated(false);
        setUser(null);
        const other = current ? otherRole(current) : null;
        if (other && remaining[other]) {
          await switchTo(other, remaining, { leaving: true });
          return;
        }
        writeDemoFlag(false);
        setAuthenticated(false);
        setNeedsMfa(false);
        setMfaToken(null);
        setUser(null);
        setMode('live');
      },

      accounts,
      returnRole,

      switchAccount: async (target) => {
        await switchTo(target, accounts);
      },

      addAccount: async (target) => {
        disconnectSocket();
        setReturnRole(role);
        await setSavedRole(target);
        setRole(target);
        setUser(null);
        setAuthenticated(false);
        setNeedsMfa(false);
        setMfaToken(null);
        setError(null);
        setMode('live');
      },

      cancelAddAccount: async () => (returnRole ? switchTo(returnRole, accounts) : false),
    };
  }, [ready, mode, role, isAuthenticated, needsMfa, mfaToken, user, error, accounts, returnRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
