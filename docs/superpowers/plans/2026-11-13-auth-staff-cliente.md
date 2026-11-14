# Auth staff vs cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Operax Mobile uma tela inicial que decide "Sou da equipe" / "Sou cliente", um login de cliente (telefone/email, senha ou OTP) com suporte a cliente vinculado a várias empresas, e o casco de navegação de cada lado — sem tocar no conteúdo das abas novas (fica pra specs seguintes) e sem depender de endpoints de backend que ainda não existem (ficam atrás de wrappers de API isolados, fáceis de ajustar quando o contrato real for confirmado).

**Architecture:** Extrai a decisão "qual tela mostrar" pra uma função pura testável (`resolveAuthRoute`) separada do `AuthContext`, que só guarda fatos de sessão (papel salvo, usuário, autenticado). `AuthUser` passa a ser uma union discriminada (`StaffUser | ClientUser`) com `kind` como discriminante. Mesma técnica pra permissão de staff (`hasPermission`, função pura) e pra lista de rotas sem Bearer válido (`isAuthRoute`, extraída e exportada de `client.ts`).

**Tech Stack:** Expo SDK 57 · React Native · TypeScript · Expo Router · Jest (jest-expo)

**Spec de referência:** `docs/superpowers/specs/2026-11-13-auth-staff-cliente-design.md` — leia antes de começar, cada task referencia a seção correspondente.

---

## Checagem de escopo

Esta spec já é o recorte "base de auth" dentro da decomposição maior (conversas/staff, portal, fitness, + esta). Não cobre conteúdo de telas nem backend — só auth, seleção de papel/empresa e o casco de navegação. Cabe num plano só: ao final, dá pra compilar, rodar os testes novos, e navegar manualmente por todo o fluxo (staff inalterado; cliente em modo demo, já que os endpoints reais de `/api/auth/client/*` ainda não existem — ver seção 7 da spec).

## Mapa de arquivos

```
MODIFICAR
  src/shared/api/token-store.ts        + getSavedRole/setSavedRole/clearSavedRole
  src/shared/api/client.ts             + isAuthRoute exportada, rotas de cliente
  src/shared/api/auth.api.ts           AuthUser → union, + API de cliente
  src/features/auth/AuthContext.tsx    + papel, métodos de cliente, boot com migração
  app/index.tsx                        usa resolveAuthRoute
  app/(app)/_layout.tsx                filtro por permissão (mecanismo, sem mapear ainda)
  app/(app)/profile.tsx                corrige acesso a role_code pós-union
  app/notification-prefs.tsx           corrige acesso a notification_prefs pós-union
  docs/00-produto.md, 03-auth-sessao.md, 07-mapa-telas.md, 08-api-contrato.md, README.md

CRIAR
  src/features/auth/resolveAuthRoute.ts (+ __tests__)
  src/features/auth/permissions.ts       (+ __tests__)
  src/shared/api/__tests__/isAuthRoute.test.ts
  app/(auth)/role-select.tsx
  app/(auth)/client-login.tsx
  app/(auth)/client-otp.tsx
  app/(auth)/client-tenant-select.tsx
  app/(client)/_layout.tsx
  app/(client)/agenda.tsx, conversas.tsx, fitness.tsx, perfil.tsx  (placeholders)
```

---

### Task 1: Papel salvo no device (`token-store.ts`)

**Files:**
- Modify: `src/shared/api/token-store.ts`

- [ ] **Step 1: Adicionar as funções de papel salvo**

No fim de `src/shared/api/token-store.ts`, adicione:

```ts
const ROLE_KEY = 'operax_role';

export type SavedRole = 'staff' | 'client';

export async function getSavedRole(): Promise<SavedRole | null> {
  const value = await getItem(ROLE_KEY);
  return value === 'staff' || value === 'client' ? value : null;
}

export async function setSavedRole(role: SavedRole): Promise<void> {
  await setItem(ROLE_KEY, role);
}

export async function clearSavedRole(): Promise<void> {
  await deleteItem(ROLE_KEY);
}
```

Reaproveita os helpers privados `getItem`/`setItem`/`deleteItem` que já existem no arquivo (SecureStore nativo, `localStorage` no web) — não precisa de lib nova.

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros vindos deste arquivo (os erros de `profile.tsx`/`notification-prefs.tsx` da Task 3 ainda não existem nesse ponto).

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/token-store.ts
git commit -m "feat: persistir papel (staff/cliente) escolhido no login"
```

---

### Task 2: Extrair `isAuthRoute` de `client.ts`

**Files:**
- Modify: `src/shared/api/client.ts`
- Test: `src/shared/api/__tests__/isAuthRoute.test.ts`

- [ ] **Step 1: Escrever o teste (vai falhar — a função ainda não é exportada)**

Crie `src/shared/api/__tests__/isAuthRoute.test.ts`:

```ts
import { isAuthRoute } from '../client';

describe('isAuthRoute', () => {
  it('reconhece as rotas de staff sem Bearer válido ainda', () => {
    expect(isAuthRoute('/api/auth/login')).toBe(true);
    expect(isAuthRoute('/api/auth/refresh')).toBe(true);
    expect(isAuthRoute('/api/auth/logout')).toBe(true);
    expect(isAuthRoute('/api/auth/mfa/verify')).toBe(true);
  });

  it('reconhece as rotas de cliente sem Bearer válido ainda', () => {
    expect(isAuthRoute('/api/auth/client/login')).toBe(true);
    expect(isAuthRoute('/api/auth/client/otp/request')).toBe(true);
    expect(isAuthRoute('/api/auth/client/otp/verify')).toBe(true);
  });

  it('NÃO marca switch-tenant nem /client/me — são chamadas autenticadas normais', () => {
    expect(isAuthRoute('/api/auth/client/switch-tenant')).toBe(false);
    expect(isAuthRoute('/api/auth/client/me')).toBe(false);
  });

  it('não marca rotas de negócio', () => {
    expect(isAuthRoute('/api/conversations')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest isAuthRoute`
Expected: FAIL — `isAuthRoute` não é exportado por `client.ts`.

- [ ] **Step 3: Extrair e exportar a função, com as rotas de cliente**

Em `src/shared/api/client.ts`, substitua o bloco que hoje calcula `isAuthRoute` inline dentro do interceptor:

```ts
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
```

E no interceptor de resposta, troque o cálculo inline por uma chamada à função:

```ts
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = String(original?.url ?? '');

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute(url)) {
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
```

Note que `switch-tenant` e `/client/me` **não** entram em `AUTH_ROUTE_PATTERNS` — elas passam pelo fluxo padrão de refresh+retry, igual qualquer outra chamada autenticada (é o ponto que a revisão da spec pegou).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest isAuthRoute`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/client.ts src/shared/api/__tests__/isAuthRoute.test.ts
git commit -m "refactor: extrair isAuthRoute e incluir rotas de login de cliente"
```

---

### Task 3: `AuthUser` como union + API de cliente (`auth.api.ts`)

**Files:**
- Modify: `src/shared/api/auth.api.ts`
- Modify: `app/(app)/profile.tsx`
- Modify: `app/notification-prefs.tsx`

- [ ] **Step 1: Reescrever `auth.api.ts`**

Substitua o conteúdo de `src/shared/api/auth.api.ts` por:

```ts
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

export async function getMeApi(): Promise<StaffUser> {
  const { data } = await api.get('/api/auth/me');
  return data as StaffUser;
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
    await setTokens(data.access_token, data.refresh_token);
  }
  return data as ClientLoginResult;
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
    await setTokens(data.access_token, data.refresh_token);
  }
  return data as ClientLoginResult;
}

export async function getClientMeApi(): Promise<ClientUser> {
  const { data } = await api.get('/api/auth/client/me');
  return data as ClientUser;
}

export async function switchClientTenantApi(input: {
  tenant_id: string;
}): Promise<ClientTokenBundle> {
  const { data } = await api.post('/api/auth/client/switch-tenant', input);
  if (data?.access_token && data?.refresh_token) {
    await setTokens(data.access_token, data.refresh_token);
  }
  return data as ClientTokenBundle;
}
```

Os endpoints `/api/auth/client/*` são os propostos na seção 5.2/7 da spec — ainda não existem no backend. Rodar contra a API real vai dar 404 até lá; o modo demo (Task 6) é o que permite testar a UI sem isso.

- [ ] **Step 2: Corrigir os dois call sites que quebram com a union**

`AuthUser` agora só expõe `role_code`/`notification_prefs` quando `kind === 'staff'`. Em `app/(app)/profile.tsx`, troque:

```tsx
{mode === 'live' ? 'Online' : 'Mock'} · {user?.role_code || '—'}
```

por:

```tsx
{mode === 'live' ? 'Online' : 'Mock'} · {(user?.kind === 'staff' && user.role_code) || '—'}
```

Em `app/notification-prefs.tsx`, troque:

```ts
const remote = user?.notification_prefs as Partial<NotificationPrefsState> | undefined;
```

por:

```ts
const remote = (user?.kind === 'staff' ? user.notification_prefs : undefined) as
  | Partial<NotificationPrefsState>
  | undefined;
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `AuthUser`/`role_code`/`notification_prefs`. (A Task 6 ainda vai introduzir `DEMO_USER` sem `kind` — se o tsc já reclamar disso agora, é porque `AuthContext.tsx` importa `AuthUser`; normal, resolve na Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/auth.api.ts app/\(app\)/profile.tsx app/notification-prefs.tsx
git commit -m "feat: AuthUser como union staff/cliente + API de login de cliente"
```

---

### Task 4: `resolveAuthRoute` — a decisão de rota, isolada e testada

**Files:**
- Create: `src/features/auth/resolveAuthRoute.ts`
- Test: `src/features/auth/__tests__/resolveAuthRoute.test.ts`

- [ ] **Step 1: Escrever os testes primeiro**

Crie `src/features/auth/__tests__/resolveAuthRoute.test.ts`:

```ts
import { resolveAuthRoute } from '../resolveAuthRoute';

describe('resolveAuthRoute', () => {
  it('sem papel salvo, pede a escolha', () => {
    expect(resolveAuthRoute({ phase: 'role_unselected' })).toBe('/(auth)/role-select');
  });

  it('staff sem sessão vai pro login', () => {
    expect(resolveAuthRoute({ phase: 'staff', authenticated: false, needsMfa: false })).toBe(
      '/(auth)/login',
    );
  });

  it('staff com mfa pendente vai pro mfa', () => {
    expect(resolveAuthRoute({ phase: 'staff', authenticated: false, needsMfa: true })).toBe(
      '/(auth)/mfa',
    );
  });

  it('staff autenticado vai pro shell (inbox)', () => {
    expect(resolveAuthRoute({ phase: 'staff', authenticated: true, needsMfa: false })).toBe(
      '/(app)/inbox',
    );
  });

  it('cliente sem sessão vai pro login de cliente', () => {
    expect(
      resolveAuthRoute({ phase: 'client', authenticated: false, activeTenantId: null }),
    ).toBe('/(auth)/client-login');
  });

  it('cliente autenticado sem empresa ativa vai pro seletor (cobre 2+ vínculos e o caso raro de 1 vínculo sem escopo)', () => {
    expect(
      resolveAuthRoute({ phase: 'client', authenticated: true, activeTenantId: null }),
    ).toBe('/(auth)/client-tenant-select');
  });

  it('cliente autenticado com empresa ativa vai pro shell de cliente', () => {
    expect(
      resolveAuthRoute({ phase: 'client', authenticated: true, activeTenantId: 't1' }),
    ).toBe('/(client)/agenda');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest resolveAuthRoute`
Expected: FAIL — módulo `../resolveAuthRoute` não existe.

- [ ] **Step 3: Implementar**

Crie `src/features/auth/resolveAuthRoute.ts`:

```ts
export type AuthRouteInput =
  | { phase: 'role_unselected' }
  | { phase: 'staff'; authenticated: boolean; needsMfa: boolean }
  | { phase: 'client'; authenticated: boolean; activeTenantId: string | null };

export type AuthRoute =
  | '/(auth)/role-select'
  | '/(auth)/login'
  | '/(auth)/mfa'
  | '/(app)/inbox'
  | '/(auth)/client-login'
  | '/(auth)/client-tenant-select'
  | '/(client)/agenda';

export function resolveAuthRoute(input: AuthRouteInput): AuthRoute {
  if (input.phase === 'role_unselected') return '/(auth)/role-select';

  if (input.phase === 'staff') {
    if (input.authenticated) return '/(app)/inbox';
    return input.needsMfa ? '/(auth)/mfa' : '/(auth)/login';
  }

  if (!input.authenticated) return '/(auth)/client-login';
  return input.activeTenantId == null ? '/(auth)/client-tenant-select' : '/(client)/agenda';
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest resolveAuthRoute`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/resolveAuthRoute.ts src/features/auth/__tests__/resolveAuthRoute.test.ts
git commit -m "feat: resolveAuthRoute — decisão de tela pura e testada"
```

---

### Task 5: `hasPermission` — mecanismo de nav por permissão (staff)

**Files:**
- Create: `src/features/auth/permissions.ts`
- Test: `src/features/auth/__tests__/permissions.test.ts`

- [ ] **Step 1: Escrever os testes primeiro**

Crie `src/features/auth/__tests__/permissions.test.ts`:

```ts
import { hasPermission } from '../permissions';

describe('hasPermission', () => {
  it('sem permissão exigida, libera pra todo staff', () => {
    expect(hasPermission([], undefined)).toBe(true);
    expect(hasPermission(undefined, undefined)).toBe(true);
  });

  it('bloqueia quando falta a permissão exigida', () => {
    expect(hasPermission(['conversations:read_own'], 'kanban:manage')).toBe(false);
  });

  it('libera quando a permissão exigida está na lista', () => {
    expect(hasPermission(['conversations:read_own', 'kanban:manage'], 'kanban:manage')).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest permissions`
Expected: FAIL — módulo `../permissions` não existe.

- [ ] **Step 3: Implementar**

Crie `src/features/auth/permissions.ts`:

```ts
export function hasPermission(permissions: string[] | undefined, required?: string): boolean {
  if (!required) return true;
  return (permissions ?? []).includes(required);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest permissions`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/permissions.ts src/features/auth/__tests__/permissions.test.ts
git commit -m "feat: hasPermission — mecanismo de nav por permissão"
```

---

### Task 6: Reescrever `AuthContext.tsx`

**Files:**
- Modify: `src/features/auth/AuthContext.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

Substitua todo o conteúdo de `src/features/auth/AuthContext.tsx` por:

```tsx
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
  name: 'Cliente Demo',
  email: 'cliente@demo.exemplo',
  active_tenant_id: null,
  memberships: [
    { tenant_id: 't1', tenant_name: 'Clínica Exemplo' },
    { tenant_id: 't2', tenant_name: 'Studio Fit Exemplo' },
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

        let savedRole = await getSavedRole();
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
      if ('status' in result && result.status === 'no_portal_access') {
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
        const result = await switchClientTenantApi({ tenant_id: tenantId });
        setUser(result.user);
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
```

Note que `switchTenant` reconecta o socket depois de trocar de empresa (o token mudou — seção 3/5.2 da spec), e `enterClientDemo` entra com `active_tenant_id: null` e 2 memberships, pra exercitar o fluxo completo (login → seletor → shell) manualmente sem o backend novo existir ainda.

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (os outros arquivos que ainda importam a API antiga de `app/index.tsx`, `app/(auth)/login.tsx`, `app/(app)/_layout.tsx` continuam funcionando porque `login`/`verifyMfa`/`logout`/`enterDemo`/`ready`/`isAuthenticated`/`needsMfa`/`user`/`error`/`mode` têm a mesma assinatura de antes).

- [ ] **Step 3: Rodar a suíte toda**

Run: `npm run test:unit`
Expected: PASS em todos os testes (os novos + os já existentes de inbox/notifications/client).

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/AuthContext.tsx
git commit -m "feat: AuthContext com papel staff/cliente, login de cliente e migração de instalações antigas"
```

---

### Task 7: Rewire `app/index.tsx`

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Substituir o arquivo**

```tsx
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/features/auth/AuthContext';
import { colors } from '@/src/design-system/tokens';
import { resolveAuthRoute } from '@/src/features/auth/resolveAuthRoute';

export default function Index() {
  const { ready, role, isAuthenticated, needsMfa, user } = useAuth();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.chromeNavy,
        }}
      >
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (role == null) {
    return <Redirect href={resolveAuthRoute({ phase: 'role_unselected' })} />;
  }

  if (role === 'staff') {
    return (
      <Redirect
        href={resolveAuthRoute({ phase: 'staff', authenticated: isAuthenticated, needsMfa })}
      />
    );
  }

  const activeTenantId = user?.kind === 'client' ? user.active_tenant_id : null;
  return (
    <Redirect
      href={resolveAuthRoute({ phase: 'client', authenticated: isAuthenticated, activeTenantId })}
    />
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "refactor: app/index.tsx usa resolveAuthRoute pra decidir a tela inicial"
```

---

### Task 8: Tela `role-select.tsx`

**Files:**
- Create: `app/(auth)/role-select.tsx`

- [ ] **Step 1: Criar a tela**

```tsx
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function RoleSelectScreen() {
  const insets = useSafeAreaInsets();
  const { selectRole } = useAuth();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.brand}>
        <Image
          source={require('../../assets/brand/operax-mark.png')}
          style={styles.mark}
          contentFit="contain"
        />
        <Image
          source={require('../../assets/brand/operax-logo-full.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>

      <View style={styles.choices}>
        <Body style={{ color: colors.text, textAlign: 'center' }}>Como você vai entrar?</Body>

        <Button
          label="Sou da equipe"
          onPress={async () => {
            await selectRole('staff');
            router.replace('/(auth)/login');
          }}
        />
        <Button
          label="Sou cliente"
          variant="secondary"
          onPress={async () => {
            await selectRole('client');
            router.replace('/(auth)/client-login');
          }}
        />
        <Muted style={{ textAlign: 'center' }}>
          Equipe: atendentes e administradores do tenant. Cliente: quem usa o portal de uma
          empresa atendida por aqui.
        </Muted>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.chromeNavy,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  brand: { alignItems: 'center', gap: spacing.md },
  mark: { width: 72, height: 72 },
  logo: { width: 180, height: 40 },
  choices: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
```

- [ ] **Step 2: Verificar manualmente**

Run: `npx expo start --web` (ou `--ios`/`--android`), limpe o storage do app (reinstala ou `expo start -c`) pra cair sem `role` salvo.
Expected: abre em `role-select`, cada botão navega pro login certo.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/role-select.tsx"
git commit -m "feat: tela de seleção de papel (equipe/cliente)"
```

---

### Task 9: Tela `client-login.tsx`

**Files:**
- Create: `app/(auth)/client-login.tsx`

- [ ] **Step 1: Criar a tela**

```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { ALLOW_MOCK } from '@/src/shared/config';

type Method = 'password' | 'otp';

export default function ClientLoginScreen() {
  const insets = useSafeAreaInsets();
  const { clientLogin, requestClientOtp, clearRole, enterClientDemo, error, clearError } =
    useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<Method>('password');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function submit() {
    setLoading(true);
    setBlocked(false);
    try {
      if (method === 'otp') {
        await requestClientOtp(identifier.trim());
        router.push({
          pathname: '/(auth)/client-otp',
          params: { identifier: identifier.trim() },
        } as never);
        return;
      }
      const outcome = await clientLogin(identifier.trim(), password);
      if (outcome === 'blocked') {
        setBlocked(true);
        return;
      }
      router.replace('/(auth)/client-tenant-select');
    } catch {
      /* erro já fica em `error` */
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + spacing.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Field
            label="Telefone ou e-mail"
            value={identifier}
            onChangeText={(v) => {
              clearError();
              setBlocked(false);
              setIdentifier(v);
            }}
            placeholder="seu@email.com ou (11) 90000-0000"
          />

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setMethod('password')}
              style={[styles.toggle, method === 'password' && styles.toggleActive]}
            >
              <Body style={method === 'password' ? styles.toggleTextActive : styles.toggleText}>
                Senha
              </Body>
            </Pressable>
            <Pressable
              onPress={() => setMethod('otp')}
              style={[styles.toggle, method === 'otp' && styles.toggleActive]}
            >
              <Body style={method === 'otp' ? styles.toggleTextActive : styles.toggleText}>
                Receber código
              </Body>
            </Pressable>
          </View>

          {method === 'password' ? (
            <Field
              label="Senha"
              value={password}
              onChangeText={(v) => {
                clearError();
                setPassword(v);
              }}
              secureTextEntry
              placeholder="Sua senha"
            />
          ) : null}

          {blocked ? (
            <Body style={{ color: colors.danger, fontSize: 13 }}>
              Nenhuma das suas empresas tem o portal disponível. Fale com elas pra habilitar.
            </Body>
          ) : error ? (
            <Body style={{ color: colors.danger, fontSize: 13 }}>{error}</Body>
          ) : null}

          <Button
            label={loading ? 'Entrando…' : method === 'otp' ? 'Enviar código' : 'Entrar'}
            disabled={loading || !identifier.trim() || (method === 'password' && !password)}
            onPress={submit}
          />

          {ALLOW_MOCK ? (
            <Button
              label="Entrar direto (demo cliente)"
              variant="ghost"
              onPress={() => {
                enterClientDemo();
                router.replace('/(auth)/client-tenant-select');
              }}
            />
          ) : null}

          <Pressable onPress={() => clearRole().then(() => router.replace('/(auth)/role-select'))}>
            <Muted style={styles.switchRole}>Não é você? Entrar como equipe</Muted>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chromeNavy },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  form: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: colors.pageBg,
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
  switchRole: { textAlign: 'center', marginTop: spacing.sm },
});
```

- [ ] **Step 2: Verificar manualmente (modo demo)**

Garanta `EXPO_PUBLIC_ALLOW_MOCK=1` no `.env`, rode `npx expo start`, escolha "Sou cliente" na role-select, toque "Entrar direto (demo cliente)".
Expected: vai pro seletor de empresa (Task 11) com as duas empresas demo.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/client-login.tsx"
git commit -m "feat: tela de login de cliente (senha ou OTP)"
```

---

### Task 10: Tela `client-otp.tsx`

**Files:**
- Create: `app/(auth)/client-otp.tsx`

- [ ] **Step 1: Criar a tela**

```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Muted, Title } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientOtpScreen() {
  const insets = useSafeAreaInsets();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const { verifyClientOtp, requestClientOtp, error } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function resend() {
    if (cooldown > 0 || !identifier) return;
    await requestClientOtp(identifier);
    setCooldown(30);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        <Title style={{ color: '#fff' }}>Verificação</Title>
        <Muted style={{ color: '#9aa8bd' }}>Digite o código enviado pra {identifier}.</Muted>
      </View>

      <View style={styles.card}>
        <Field
          label="Código"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="000000"
        />
        {blocked ? (
          <Body style={{ color: colors.danger, fontSize: 13 }}>
            Nenhuma das suas empresas tem o portal disponível. Fale com elas pra habilitar.
          </Body>
        ) : error ? (
          <Body style={{ color: colors.danger, fontSize: 13 }}>{error}</Body>
        ) : null}
        <Button
          label={loading ? 'Confirmando…' : 'Confirmar'}
          disabled={loading || !code}
          onPress={async () => {
            if (!identifier) return;
            setLoading(true);
            try {
              const outcome = await verifyClientOtp(identifier, code);
              if (outcome === 'blocked') {
                setBlocked(true);
                return;
              }
              router.replace('/(auth)/client-tenant-select');
            } catch {
              /* erro já fica em `error` */
            } finally {
              setLoading(false);
            }
          }}
        />
        <Button
          label={cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar código'}
          variant="ghost"
          disabled={cooldown > 0}
          onPress={resend}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.replace('/(auth)/client-login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chromeNavy, justifyContent: 'space-between' },
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
```

- [ ] **Step 2: Verificar manualmente**

Sem o backend ainda, só dá pra chegar nessa tela via "Receber código" em `client-login.tsx` — `requestClientOtp` vai falhar contra a API real (endpoint não existe, seção 7 da spec), o que é esperado até o backend ser confirmado. Confirme ao menos que a navegação e o layout aparecem corretamente (ex.: usando `--web` e chamando a tela direto por URL, ou comentando temporariamente a chamada pra navegar).

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/client-otp.tsx"
git commit -m "feat: tela de verificação de código (OTP) do cliente"
```

---

### Task 11: Tela `client-tenant-select.tsx`

**Files:**
- Create: `app/(auth)/client-tenant-select.tsx`

- [ ] **Step 1: Criar a tela**

```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Muted, Title } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientTenantSelectScreen() {
  const insets = useSafeAreaInsets();
  const { user, switchTenant } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const memberships = user?.kind === 'client' ? user.memberships : [];

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        <Title style={{ color: '#fff' }}>Qual empresa?</Title>
        <Muted style={{ color: '#9aa8bd' }}>
          Você tem portal em mais de uma empresa. Escolha onde entrar.
        </Muted>
      </View>

      <View style={styles.list}>
        {memberships.map((m) => (
          <Pressable
            key={m.tenant_id}
            disabled={loadingId !== null}
            onPress={async () => {
              setLoadingId(m.tenant_id);
              try {
                await switchTenant(m.tenant_id);
                router.replace('/(client)/agenda');
              } finally {
                setLoadingId(null);
              }
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Body style={styles.name}>{m.tenant_name}</Body>
            {loadingId === m.tenant_id ? <Muted>Entrando…</Muted> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chromeNavy },
  list: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md },
  pressed: { backgroundColor: colors.pageBg },
  name: { fontSize: 16 },
});
```

Nota: em modo demo, `switchTenant` chama `switchClientTenantApi` de verdade (vai falhar contra a API real, endpoint não existe ainda). Pra testar o seletor manualmente de ponta a ponta sem backend, a Task 13 (Perfil) usa o mesmo botão — documentado como limitação conhecida até o backend confirmar o contrato (seção 7 da spec). Não é bloqueante pra esta spec: a tela e a navegação já ficam prontas pra quando o endpoint existir.

- [ ] **Step 2: Commit**

```bash
git add "app/(auth)/client-tenant-select.tsx"
git commit -m "feat: tela de seleção de empresa ativa do cliente"
```

---

### Task 12: Shell `(client)` com abas placeholder

**Files:**
- Create: `app/(client)/_layout.tsx`
- Create: `app/(client)/agenda.tsx`
- Create: `app/(client)/conversas.tsx`
- Create: `app/(client)/fitness.tsx`
- Create: `app/(client)/perfil.tsx`

- [ ] **Step 1: Layout das tabs**

```tsx
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientLayout() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || user?.kind !== 'client') return <Redirect href="/(auth)/role-select" />;
  if (user.active_tenant_id == null) return <Redirect href="/(auth)/client-tenant-select" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.chromeNavy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.cardBg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversas"
        options={{
          title: 'Conversas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fitness"
        options={{
          title: 'Fitness',
          tabBarIcon: ({ color, size }) => <Ionicons name="fitness" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Telas placeholder de conteúdo**

`app/(client)/agenda.tsx`:

```tsx
import { View } from 'react-native';
import { Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function ClientAgendaScreen() {
  return (
    <Screen>
      <ScreenHeader title="Agenda" />
      <View style={{ padding: spacing.xl }}>
        <Muted>Em breve: agenda e serviços da empresa.</Muted>
      </View>
    </Screen>
  );
}
```

`app/(client)/conversas.tsx` (mesmo padrão, troque título/texto):

```tsx
import { View } from 'react-native';
import { Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function ClientConversasScreen() {
  return (
    <Screen>
      <ScreenHeader title="Conversas" />
      <View style={{ padding: spacing.xl }}>
        <Muted>Em breve: conversas com a empresa.</Muted>
      </View>
    </Screen>
  );
}
```

`app/(client)/fitness.tsx` (mesmo padrão):

```tsx
import { View } from 'react-native';
import { Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function ClientFitnessScreen() {
  return (
    <Screen>
      <ScreenHeader title="Fitness" />
      <View style={{ padding: spacing.xl }}>
        <Muted>Em breve: fitness e integração com relógios.</Muted>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Perfil (com troca de empresa, logout e trocar de papel)**

`app/(client)/perfil.tsx`:

```tsx
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientPerfilScreen() {
  const { user, logout, clearRole, switchTenant } = useAuth();
  const memberships = user?.kind === 'client' ? user.memberships : [];
  const activeTenantId = user?.kind === 'client' ? user.active_tenant_id : null;
  const secondaryLine = user?.email || (user?.kind === 'client' ? user.phone : undefined) || '—';

  return (
    <Screen>
      <ScreenHeader title="Perfil" />
      <View style={styles.user}>
        <Body style={styles.name}>{user?.name || 'Cliente'}</Body>
        <Muted>{secondaryLine}</Muted>
      </View>

      {memberships.length > 1 ? (
        <View style={styles.section}>
          <Muted style={styles.sectionLabel}>Empresa ativa</Muted>
          {memberships.map((m) => (
            <Pressable key={m.tenant_id} onPress={() => switchTenant(m.tenant_id)} style={styles.row}>
              <Body>{m.tenant_name}</Body>
              {m.tenant_id === activeTenantId ? (
                <Body style={{ color: colors.primary }}>Ativa</Body>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.row} onPress={() => logout()}>
        <Body>Sair</Body>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => clearRole().then(() => router.replace('/(auth)/role-select'))}
      >
        <Body>Entrar como equipe</Body>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  user: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
    gap: 2,
  },
  name: { fontFamily: typography.fontFamilySemiBold, fontSize: 17 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  sectionLabel: { paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
```

- [ ] **Step 4: Verificar manualmente de ponta a ponta (modo demo)**

Com `EXPO_PUBLIC_ALLOW_MOCK=1`: role-select → "Sou cliente" → "Entrar direto (demo cliente)" → seletor de empresa → escolhe uma → cai no shell com as 4 tabs → Perfil mostra a troca de empresa (vai falhar a chamada real de `switchTenant`, mas a navegação e a UI devem renderizar).

- [ ] **Step 5: Commit**

```bash
git add "app/(client)"
git commit -m "feat: casco de navegação do cliente (agenda/conversas/fitness/perfil placeholder)"
```

---

### Task 13: Mecanismo de permissão no shell de staff

**Files:**
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Aplicar o filtro (sem mudar o que é visível hoje)**

Substitua `app/(app)/_layout.tsx` por:

```tsx
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { QueueDrawerProvider } from '@/src/features/queue/QueueDrawerContext';
import { hasPermission } from '@/src/features/auth/permissions';

// Nenhuma aba exige permissão ainda — é só o mecanismo. Specs futuras preenchem
// isto conforme admin/atendente precisarem ver coisas diferentes.
const TAB_PERMISSIONS: Record<string, string | undefined> = {
  'inbox/index': undefined,
  agenda: undefined,
  notifications: undefined,
  more: undefined,
};

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const permissions = user?.kind === 'staff' ? user.permissions : undefined;
  const visible = (tab: keyof typeof TAB_PERMISSIONS) =>
    hasPermission(permissions, TAB_PERMISSIONS[tab]);

  return (
    <QueueDrawerProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.chromeNavy },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.cardBg,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="inbox/index"
          options={{
            title: 'Atendimento',
            headerShown: false,
            href: visible('inbox/index') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Agenda',
            href: visible('agenda') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Avisos',
            href: visible('notifications') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'Mais',
            headerShown: false,
            href: visible('more') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="ellipsis-horizontal-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="kanban" options={{ href: null, title: 'Kanban' }} />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Perfil' }} />
        <Tabs.Screen name="history" options={{ href: null, title: 'Histórico' }} />
      </Tabs>
    </QueueDrawerProvider>
  );
}
```

- [ ] **Step 2: Verificar manualmente**

Login de staff (demo ou real) deve continuar mostrando exatamente as mesmas 4 tabs de antes — `TAB_PERMISSIONS` todo `undefined` não esconde nada.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/_layout.tsx"
git commit -m "feat: mecanismo de nav por permissão no shell de staff (sem mapear abas ainda)"
```

---

### Task 14: Atualizar a documentação

**Files:**
- Modify: `docs/00-produto.md`
- Modify: `docs/03-auth-sessao.md`
- Modify: `docs/07-mapa-telas.md`
- Modify: `docs/08-api-contrato.md`
- Modify: `README.md`

- [ ] **Step 1: `docs/00-produto.md`**

No "Anti-escopo (v1)", remova a linha `- Portal do cliente` e adicione, no fim do arquivo:

```markdown
## Cliente final (em desenvolvimento)

Ver `docs/superpowers/specs/2026-11-13-auth-staff-cliente-design.md` — base de auth que
cliente final do tenant também usa o app, com login próprio e portal/fitness vindo em
specs seguintes.
```

- [ ] **Step 2: `docs/03-auth-sessao.md`**

Adicione uma seção no fim:

```markdown
## Cliente (alvo)

Login por telefone/email, senha ou OTP, sem `company_code` — conta pode ter vínculo com
várias empresas (tenants) com portal habilitado. Mesma política de sessão única (`sid`)
do staff. Detalhe completo em
`docs/superpowers/specs/2026-11-13-auth-staff-cliente-design.md`.
```

- [ ] **Step 3: `docs/07-mapa-telas.md`**

Adicione linhas na tabela de "Stack / modais":

```markdown
| Seleção de papel | `/(auth)/role-select` | P0 |
| Login cliente | `/(auth)/client-login` | P0 |
| OTP cliente | `/(auth)/client-otp` | P0 |
| Seleção de empresa | `/(auth)/client-tenant-select` | P0 |
```

E uma nova seção de tabs do cliente:

```markdown
## Tabs — cliente

| Tab | Rota |
|-----|------|
| Agenda | `/(client)/agenda` |
| Conversas | `/(client)/conversas` |
| Fitness | `/(client)/fitness` |
| Perfil | `/(client)/perfil` |
```

- [ ] **Step 4: `docs/08-api-contrato.md`**

Adicione, após a seção "Auth":

```markdown
## Auth cliente (proposto — ver seção 7 da spec de auth)

- `POST /auth/client/login` (+ tokens)
- `POST /auth/client/otp/request`
- `POST /auth/client/otp/verify` (+ tokens)
- `GET /auth/client/me`
- `POST /auth/client/switch-tenant` (+ tokens novos, escopados à empresa escolhida)

Nenhum desses existe ainda no backend — contrato proposto em
`docs/superpowers/specs/2026-11-13-auth-staff-cliente-design.md`.
```

- [ ] **Step 5: `README.md`**

No bloco "## Estado", adicione uma linha:

```markdown
- Seleção de papel (equipe/cliente); login de cliente (senha/OTP) com modo demo — endpoints reais pendentes
```

- [ ] **Step 6: Commit**

```bash
git add docs/00-produto.md docs/03-auth-sessao.md docs/07-mapa-telas.md docs/08-api-contrato.md README.md
git commit -m "docs: documentar seleção de papel e login de cliente"
```

---

## Verificação final

- [ ] `npm run test:unit` — todos os testes passam (novos + existentes).
- [ ] `npx tsc --noEmit` — sem erros.
- [ ] Manual, staff: login (real ou demo) inalterado, mesmas 4 tabs.
- [ ] Manual, cliente (modo demo): role-select → client-login → demo → seletor de empresa → shell `(client)` com 4 tabs → Perfil troca de empresa e tem "Entrar como equipe"/"Sair".
- [ ] Manual, migração: com um token de staff salvo de antes desta mudança e sem `role` salvo, o boot cai direto no shell de staff (não pede seleção de papel).
