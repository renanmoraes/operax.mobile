# Arquitetura de auth — staff vs cliente — Operax Mobile

**Data:** 2026-11-13
**Status:** desenhado em conversa, aguardando revisão do dono
**Stack:** Expo SDK 57 · React Native · Expo Router · TypeScript
**Sub-spec de:** revival do Operax Mobile (3 frentes: conversas/staff, portal do cliente, fitness/wearables + esta, a base de auth)

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

Tela inicial com dois botões: **"Sou da equipe"** / **"Sou cliente"**. A escolha é persistida no device até logout explícito com troca de papel; logout normal mantém o papel salvo e volta direto pra tela de login daquele papel.

- **Sou da equipe** → fluxo atual (`company_code` + email/senha + MFA), sem mudança de telas. Shell `(app)` passa a filtrar tabs/ações por `user.permissions` em vez de mostrar tudo pra qualquer staff.
- **Sou cliente** → fluxo novo (seção 4). Shell novo `(client)`, com tabs placeholder (Agenda, Conversas, Fitness, Perfil) até as specs de conteúdo chegarem.

**Isolamento multi-tenant do cliente:** a conta do cliente guarda só a *lista de vínculos* (quais empresas, com portal habilitado). Cada chamada de API sempre viaja escopada a **um** tenant ativo por vez (ver seção 5) — nunca mistura dados de duas empresas na mesma tela. É o mesmo padrão de "trocar de workspace" comum em produtos B2B2C; não compromete a separação por tenant que já existe hoje pro staff.

**Gate de portal:** o endpoint de login/me do cliente devolve só os vínculos com o módulo de portal habilitado no plano do tenant (mesmo conceito do gate que já existe pra Agenda/Scheduling, citado em `docs/12-api-gaps.md`). Zero vínculos válidos → login bloqueado com mensagem clara, sem entrar no app. Um vínculo → entra direto nele. Mais de um → seletor de empresa ativa.

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

**`client-login.tsx`:** campo único (telefone ou email, detectado pelo formato) + toggle "senha" / "receber código".
- Senha → campo de senha normal, botão Entrar.
- Código → botão "Enviar código" leva pro `client-otp.tsx` (campo de 6 dígitos + "reenviar" com cooldown de 30–60s, visual análogo ao `mfa.tsx` atual).

**Depois de autenticado como cliente:** a resposta já traz a lista de empresas com portal habilitado. 0 → mensagem bloqueante na própria tela. 1 → seta como ativa, vai direto pro shell cliente. 2+ → `client-tenant-select.tsx` (lista simples, escolhe, vai pro shell).

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
  active_tenant_id: string;
  memberships: { tenant_id: string; tenant_name: string }[]; // só os com portal habilitado
};

type AuthUser = StaffUser | ClientUser;
```

### 5.2 Endpoints novos (propostos — ver seção 7)

```
POST /api/auth/client/login          { identifier, password? }
POST /api/auth/client/otp/request    { identifier }
POST /api/auth/client/otp/verify     { identifier, code }
GET  /api/auth/client/me
POST /api/auth/client/switch-tenant  { tenant_id } → novo access_token/refresh_token
```

`switch-tenant` reemite os tokens já escopados à empresa escolhida (em vez de um header dinâmico por request). Mantém o padrão atual de "token = 1 contexto" — nenhuma outra chamada de API do lado cliente precisa saber que houve troca; só o token guardado no `SecureStore` muda, igual já acontece num login normal. `refresh` e `logout` continuam os mesmos endpoints de hoje, agnósticos a staff/cliente.

### 5.3 Navegação dirigida por papel/permissão

- Staff: cada item de tab/ação no shell `(app)` declara `requiredPermission?: string`; filtra contra `user.permissions`. Sem permissão declarada = visível pra todo staff (comportamento atual preservado).
- Cliente: shell novo `(client)` com tabs placeholder (Agenda, Conversas, Fitness, Perfil) — cada uma por ora é uma tela "em breve"; a troca de empresa ativa vive no Perfil.

## 6. Erros e testes

**Erros:**
- Credencial inválida (staff ou cliente): mensagem inline, igual já funciona em `login.tsx`.
- OTP errado/expirado: mensagem inline no `client-otp.tsx`; reenvio com cooldown.
- `switch-tenant` falha (ex. sessão expira no meio): cai no mesmo tratamento de 401 que já existe em `client.ts` — limpa tokens, `index.tsx` redireciona pro login do papel salvo.
- Sessão revogada em outro device: já funciona hoje (`clearTokens()` → `isAuthenticated=false` → redirect); como o `role` salvo é independente do token, cai automaticamente na tela de login certa (staff ou cliente) sem lógica nova.
- Ajuste necessário em `src/shared/api/client.ts`: incluir `/api/auth/client/login`, `/api/auth/client/otp/` e `/api/auth/client/switch-tenant` na lista `isAuthRoute`, pra não entrarem no retry-loop automático de refresh.

**Testes** (lógica pura, sem renderizar UI — padrão já usado em `src/features/*/__tests__`):
- Resolver de rota: `role` + estado de auth → qual tela, isolado de componente.
- Filtro de memberships: 0 → bloqueia / 1 → auto-seleciona / 2+ → mostra seletor.
- `isAuthRoute` do `client.ts` cobrindo as rotas novas (mesmo padrão de `client.headers.test.ts`).

## 7. Pendências / dependências de backend a confirmar

Estas decisões estão fora do controle deste repositório (mobile-only) — são a proposta de contrato, a confirmar com quem mantém `api.operax.digital` antes de implementar:

- Os endpoints `/api/auth/client/*` da seção 5.2 não existem ainda.
- O backend precisa filtrar memberships do cliente por "portal habilitado no plano do tenant" (equivalente ao gate que já existe pra Agenda/Scheduling).
- O mecanismo de troca de empresa via reemissão de token (em vez de header por request) precisa ser aceito por quem mantém a API.
