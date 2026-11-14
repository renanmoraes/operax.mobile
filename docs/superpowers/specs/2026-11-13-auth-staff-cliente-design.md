# Arquitetura de auth — staff vs cliente — Operax Mobile

**Data:** 2026-11-13
**Status:** desenhado em conversa, aguardando revisão do dono
**Stack:** Expo SDK 57 · React Native · Expo Router · TypeScript
**Sub-spec de:** revival do Operax Mobile. Frentes combinadas:
- Conversas/staff (já existe, religar na API real)
- Portal do cliente (agenda/serviços)
- Fitness/wearables
- **Esta spec:** a base de auth que as três anteriores dependem

---

## 1. Problema

O app hoje só serve o lado **staff/atendente** do CRM: login com `company_code` + email/senha (+MFA), sessão única que derruba o desktop, navegação fixa igual pra qualquer staff. `docs/00-produto.md` lista **"Portal do cliente"** como anti-escopo explícito da v1 — ou seja, nada de identidade de cliente final existe hoje no auth nem na API mobile.

O dono quer reviver o app cobrindo também o cliente final do tenant (fitness, conversas, portal — agenda/serviços), com um login que primeiro decide **quem está entrando** (equipe do tenant ou cliente do tenant) antes de pedir credenciais.

Esta spec cobre só a base: autenticação, seleção/troca de papel e de empresa ativa, e o "casco" de navegação de cada lado. As telas de conteúdo (Portal, Fitness) são specs seguintes que plugam nesse casco.

## 2. Objetivo

1. Uma tela inicial que decide **"Sou da equipe" / "Sou cliente"** antes de qualquer credencial.
2. Staff: fluxo de login inalterado; navegação passa a ser dirigida por permissão (admin vs atendente) em vez de fixa.
3. Cliente: login por telefone/email, com senha **ou** código (OTP), sem `company_code`. Uma conta de cliente pode ter vínculo com várias empresas (tenants) que deram acesso a portal — mas só entra se tiver pelo menos uma com portal habilitado.
4. Troca de empresa ativa (cliente) sem relogar, via seletor no menu.

**Fora de escopo desta spec:**
- Conteúdo das abas novas do cliente (Agenda/Serviços, Conversas do ponto de vista do cliente, Fitness/wearables) — ficam pra specs seguintes.
- Fluxo de convite/onboarding que cria o primeiro vínculo cliente↔tenant (quem envia o convite, como o cliente aceita) — pertence à spec do Portal.
- Diferenças finas de permissão dentro do staff (o que exatamente um admin vê que um atendente não vê) — só o mecanismo (nav dirigida por `permissions`) entra aqui; o mapeamento aba-a-aba de permissão fica pra quando essas telas forem desenhadas.
- Qualquer mudança no backend — os endpoints novos abaixo são **propostos**, não confirmados (ver seção 7).

## 3. Modelo de papéis e navegação

Tela inicial com dois botões: **"Sou da equipe"** / **"Sou cliente"**. A escolha é persistida no `SecureStore` (mesmo módulo já usado pros tokens, por simplicidade — não é dado sensível) até logout explícito com troca de papel; logout normal mantém o papel salvo e volta direto pra tela de login daquele papel. `logout()` continua limpando a flag de demo (`writeDemoFlag(false)`) como hoje, sem tocar no papel salvo.

- **Sou da equipe** → fluxo atual (`company_code` + email/senha + MFA), sem mudança de telas. Shell `(app)` passa a filtrar tabs/ações por `user.permissions` em vez de mostrar tudo pra qualquer staff.
- **Sou cliente** → fluxo novo (seção 4). Shell novo `(client)`, com tabs placeholder (Agenda, Conversas, Fitness, Perfil) até as specs de conteúdo chegarem.

**Isolamento multi-tenant do cliente:** a conta do cliente guarda só a *lista de vínculos* (quais empresas, com portal habilitado). Cada chamada de API sempre viaja escopada a **um** tenant ativo por vez (ver seção 5) — nunca mistura dados de duas empresas na mesma tela. É o mesmo padrão de "trocar de workspace" comum em produtos B2B2C; não compromete a separação por tenant que já existe hoje pro staff.

**Gate de portal:** o endpoint de login/me do cliente devolve só os vínculos com o módulo de portal habilitado no plano do tenant (mesmo conceito do gate que já existe pra Agenda/Scheduling, citado em `docs/12-api-gaps.md`). Zero vínculos válidos → login bloqueado com mensagem clara, sem entrar no app. Um vínculo → entra direto nele. Mais de um → seletor de empresa ativa.

**Sessão e paridade com o staff:** cliente usa a mesma política de sessão única (`sid`) que o staff já tem hoje (ADR-002) — login novo em outro device revoga o anterior; não é um app "sempre logado em vários aparelhos". Login/troca de empresa do cliente também disparam `connectSocket()` e `registerDevicePushToken()`, igual já acontece no login do staff; como a troca de empresa reemite o token (seção 5.2), o socket precisa reconectar com o token novo nesse momento.

## 4. Telas e máquina de estado do login

Rotas novas, ao lado das existentes em `app/(auth)/`:

```
app/(auth)/role-select.tsx          ← novo, primeira tela
app/(auth)/login.tsx                ← staff, inalterado
app/(auth)/mfa.tsx                  ← staff, inalterado
app/(auth)/client-login.tsx         ← novo
app/(auth)/client-otp.tsx           ← novo (só se escolher código)
app/(auth)/client-tenant-select.tsx ← novo (só se >1 empresa)
```

Estados do `AuthContext` (estendendo o que já existe):

```
booting
  → role_unselected            (role-select.tsx)
  → staff_unauthenticated      (login.tsx)
  → staff_mfa_pending          (mfa.tsx)
  → staff_authenticated        → /(app)/...   [shell atual]
  → client_unauthenticated     (client-login.tsx)
  → client_otp_pending         (client-otp.tsx)
  → client_blocked_no_portal   (mensagem bloqueante, inline — não navega)
  → client_tenant_pending      (client-tenant-select.tsx)
  → client_authenticated       → /(client)/... [shell novo]
```

`app/index.tsx` passa a ser o único ponto de decisão: lê o `role` salvo no device + o estado de auth e redireciona pro passo certo (hoje só olha `needsMfa`/`isAuthenticated`).

**Instalações existentes (migração):** quem já tem o app instalado tem token salvo mas nunca teve `role` salvo (campo é novo). Regra: se existe token válido e `role` está vazio, assume `staff` (é o único papel que existia antes) em vez de cair em `role_unselected` — evita deslogar usuários existentes.

`client_blocked_no_portal` não é um estado persistido no `AuthContext` — é só o resultado de uma chamada (`{status:'no_portal_access'}`) tratado como erro local na tela `client-login.tsx`/`client-otp.tsx`, igual já acontece hoje com erro de credencial inválida. Não precisa de teste de resolver de rota para ele.

**`client-login.tsx`:** campo único (telefone ou email, detectado pelo formato) + toggle "senha" / "receber código".
- Senha → campo de senha normal, botão Entrar.
- Código → botão "Enviar código" leva pro `client-otp.tsx` (campo de 6 dígitos + "reenviar" com cooldown de 30–60s, visual análogo ao `mfa.tsx` atual).

**Depois de autenticado como cliente, escopo do token por caso** (ver shapes em 5.2):

- **0 vínculos válidos:** o backend não emite tokens — a resposta é só o status de bloqueio. Nada pra guardar, nada pra limpar; a tela de login mostra a mensagem e permanece.
- **1 vínculo válido:** o backend já emite os tokens **escopados a esse tenant** (`active_tenant_id` já vem preenchido) — vai direto pro shell cliente, sem chamar `switch-tenant`.
- **2+ vínculos válidos:** o backend emite tokens **de identidade, sem tenant ativo** (`active_tenant_id: null`). Esses tokens já são guardados no `SecureStore` normalmente, mas só servem pra duas coisas: chamar `GET /client/me` e `POST /client/switch-tenant`. Qualquer endpoint tenant-scoped (agenda, conversas, fitness) rejeita um token sem tenant ativo — não é um problema desta spec resolver no backend, só documentar que o app não tenta chamar nada tenant-scoped nesse estado. Usuário escolhe em `client-tenant-select.tsx` → `switch-tenant` reemite os tokens já escopados → shell cliente.

**Boot com sessão já salva:** no boot, se `role === 'client'` e há token salvo, chama `GET /client/me` (equivalente ao `getMeApi` do staff). Se vier com `active_tenant_id` preenchido → `client_authenticated`, vai pro shell. Se vier `active_tenant_id: null` e `memberships.length > 1` → `client_tenant_pending`, mostra `client-tenant-select.tsx` de novo (cobre o caso do app ser matado antes de escolher a empresa). `active_tenant_id` nulo com só 1 membership não deveria acontecer (o login já teria escopado); se acontecer, trata como `client_tenant_pending` também, por segurança.

**Trocar de perfil:** link discreto "Não é você? Entrar como [equipe/cliente]" no rodapé de `login.tsx` e `client-login.tsx` — limpa o role salvo e volta pro `role-select.tsx`.

## 5. Dados, contrato de API e sessão

### 5.1 `AuthUser` (extensão de `src/shared/api/auth.api.ts`)

```ts
type StaffUser = {
  kind: 'staff';
  id: string; name: string; email: string;
  tenant_id: string;
  role_code: string;
  permissions: string[];        // novo — já existe no RBAC do backend, não chegava no mobile
};

type ClientUser = {
  kind: 'client';
  id: string; name: string;
  email?: string; phone?: string;
  active_tenant_id: string | null;  // null = autenticado, mas sem empresa ativa (caso 2+ vínculos, ainda não escolheu)
  memberships: { tenant_id: string; tenant_name: string }[]; // só os com portal habilitado
};

type AuthUser = StaffUser | ClientUser;
```

Modo demo (`enterDemo`, hoje `DEMO_USER`) continua existindo só pro lado staff; o objeto mock passa a incluir `kind: 'staff'` pra satisfazer a union — nenhuma mudança de comportamento, só o campo novo.

### 5.2 Endpoints novos (propostos — ver seção 7)

```
POST /api/auth/client/login          { identifier, password? }
POST /api/auth/client/otp/request    { identifier }
POST /api/auth/client/otp/verify     { identifier, code }
GET  /api/auth/client/me
POST /api/auth/client/switch-tenant  { tenant_id } → novo access_token/refresh_token
```

`login` e `otp/verify` devolvem um de três formatos (mesmo espírito do `LoginResult` que já existe pro staff em `auth.api.ts`, com `mfa_required`/`mfa_setup_required`):

```ts
type ClientLoginResult =
  | { status: 'no_portal_access' }                         // 0 vínculos — sem tokens
  | { user: ClientUser; access_token: string; refresh_token: string }; // 1 vínculo: active_tenant_id já setado
                                                              // 2+ vínculos: active_tenant_id null, token só serve pra /me e /switch-tenant
```

`switch-tenant` reemite os tokens já escopados à empresa escolhida (em vez de um header dinâmico por request). Mantém o padrão atual de "token = 1 contexto" — nenhuma outra chamada de API do lado cliente precisa saber que houve troca; só o token guardado no `SecureStore` muda, igual já acontece num login normal. `refresh` e `logout` continuam os mesmos endpoints de hoje, agnósticos a staff/cliente.

### 5.3 Navegação dirigida por papel/permissão

- Staff: cada item de tab/ação no shell `(app)` declara `requiredPermission?: string`; filtra contra `user.permissions`. Sem permissão declarada = visível pra todo staff (comportamento atual preservado).
- Cliente: shell novo `(client)` com tabs placeholder (Agenda, Conversas, Fitness, Perfil) — cada uma por ora é uma tela "em breve"; a troca de empresa ativa vive no Perfil.

## 6. Erros e testes

**Erros:**
- Credencial inválida (staff ou cliente): mensagem inline, igual já funciona em `login.tsx`.
- OTP errado/expirado: mensagem inline no `client-otp.tsx`; reenvio com cooldown.
- `switch-tenant` falha com 401 (ex. sessão expira no meio): **não** entra em `isAuthRoute` — é uma chamada autenticada normal, então passa pelo fluxo padrão do interceptor (tenta `refresh`, repete a chamada; se o refresh também falhar, `clearTokens()` e `index.tsx` redireciona pro login do papel salvo). Mesmo comportamento que qualquer outra chamada tenant-scoped já tem hoje — nenhuma lógica nova.
- Sessão revogada em outro device: já funciona hoje (`clearTokens()` → `isAuthenticated=false` → redirect); como o `role` salvo é independente do token, cai automaticamente na tela de login certa (staff ou cliente) sem lógica nova.
- Ajuste necessário em `src/shared/api/client.ts`: incluir **apenas** `/api/auth/client/login` e `/api/auth/client/otp/` na lista `isAuthRoute` (são chamadas pré-autenticação, sem Bearer válido ainda — mesmo tratamento que `/api/auth/login` e `/api/auth/mfa/` já têm). `switch-tenant` e `/client/me` ficam **fora** dessa lista, porque são chamadas autenticadas que precisam do retry de refresh.

**Testes** (lógica pura, sem renderizar UI — padrão já usado em `src/features/*/__tests__`):
- Resolver de rota: `role` + estado de auth (incluindo boot com `active_tenant_id: null`) → qual tela, isolado de componente.
- Filtro de memberships: 0 → bloqueia / 1 → auto-seleciona, token já escopado / 2+ → mostra seletor, token sem tenant ativo.
- `isAuthRoute` do `client.ts` cobrindo as rotas novas — confirmando que `switch-tenant` e `/client/me` **não** entram nessa lista (mesmo padrão de `client.headers.test.ts`).

## 7. Pendências / dependências de backend a confirmar

Estas decisões estão fora do controle deste repositório (mobile-only) — são a proposta de contrato, a confirmar com quem mantém `api.operax.digital` antes de implementar:

- Os endpoints `/api/auth/client/*` da seção 5.2 não existem ainda.
- O backend precisa filtrar memberships do cliente por "portal habilitado no plano do tenant" (equivalente ao gate que já existe pra Agenda/Scheduling).
- O mecanismo de troca de empresa via reemissão de token (em vez de header por request) precisa ser aceito por quem mantém a API.
- `POST /api/auth/refresh` precisa preservar o estado "sem tenant ativo" (caso 2+ vínculos) ao renovar o token — o refresh não pode forçar um tenant nem exigir um.
