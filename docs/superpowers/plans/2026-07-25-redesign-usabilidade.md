# Redesign usabilidade Operax Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o app mobile Operax para home = meus atendimentos, fila em drawer L→R, nav de 4 abas com hub Mais, e conversa otimizada para responder.

**Architecture:** Provider `QueueDrawer` no layout `(app)`; home reusa queries de inbox filtrando só `mine/active`; drawer lista `queue` e chama `claim`; hub `more` concentra Kanban/Histórico/Perfil/atalhos; design system ganha `ListRow`, `ScreenHeader`, tokens refinados.

**Tech Stack:** Expo 57 · React Native · Expo Router · TypeScript · React Query · Reanimated (já no projeto) · Jest unit

**Spec:** `docs/superpowers/specs/2026-07-25-redesign-usabilidade-design.md`

## Global Constraints

- Preservar brand Operax: primary `#1e4ed8`, chromeNavy `#050a14`, Inter.
- Não migrar styling stack; StyleSheet + tokens.
- Mock (`ALLOW_MOCK=1`) e live continuam válidos.
- Sem novos endpoints; TTL de posse degradado a texto se API não expuser.
- Drawer: slide esquerda→direita; badge `9+`.
- Bottom tabs: Atendimento · Agenda · Avisos · Mais (só 4).
- Commits só se o usuário pedir.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/design-system/tokens.ts` | Cores, spacing, radii, zIndex |
| `src/design-system/ui.tsx` | Primitivos + ListRow, ScreenHeader, OwnershipHint |
| `src/features/queue/QueueDrawerContext.tsx` | open/close + queueCount |
| `src/features/queue/QueueDrawer.tsx` | Painel L→R + lista Assumir |
| `src/features/inbox/sortConversations.ts` | Ordenação urgência |
| `app/(app)/_layout.tsx` | 4 tabs + provider drawer |
| `app/(app)/inbox/index.tsx` | Home Atendimento |
| `app/(app)/history.tsx` | Histórico (nova) |
| `app/(app)/more.tsx` | Hub Mais (nova) |
| `app/(app)/kanban.tsx`, `profile.tsx` | `href: null` nas tabs (ocultos) |
| `app/conversation/[id].tsx` | Header/composer/CTA Assumir |
| `app/(auth)/login.tsx`, `mfa.tsx` | Visual auth |
| Demais telas | Polimento ListRow / spacing |

---

### Task 1: Design system base

**Files:**
- Modify: `src/design-system/tokens.ts`
- Modify: `src/design-system/ui.tsx`
- Test: `src/design-system/__tests__/sortConversations.test.ts` (Task 2 cobre sort; aqui smoke opcional)

**Produces:**
- `colors.zIndex = { drawer: 40, sheet: 50, toast: 60 }`
- `ListRow`, `ScreenHeader`, `OwnershipHint` exportados de `ui.tsx`
- Botões com `pressed` opacity; `Card` permanece para hub

- [ ] **Step 1:** Atualizar `tokens.ts` com `pageBg: '#f0f2f5'`, `border: '#e5e9f0'`, `zIndex`, radii `list: 0`, `sheet: 16`, `control: 10`.
- [ ] **Step 2:** Em `ui.tsx`, adicionar:

```tsx
export function ScreenHeader({
  title,
  onMenuPress,
  menuBadge,
  right,
}: {
  title: string;
  onMenuPress?: () => void;
  menuBadge?: number;
  right?: ReactNode;
}) { /* hambúrguer + título + right */ }

export function ListRow({
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  urgencyLabel,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  urgencyLabel?: string;
}) { /* linha sem card, borderBottom */ }

export function OwnershipHint({ label }: { label: string }) { /* texto caption warn/primary */ }
```

- [ ] **Step 3:** Ajustar `Button`/`Field`/`Badge` para `radii.control`, menos borda em bubble contexts.
- [ ] **Step 4:** `npx tsc --noEmit` (ou `npm run test:unit`) — sem erros de tipo nos exports.

---

### Task 2: Ordenação da inbox

**Files:**
- Create: `src/features/inbox/sortConversations.ts`
- Create: `src/features/inbox/__tests__/sortConversations.test.ts`

**Produces:**
- `sortForHome(conversations): Conversation[]` — unread desc, then updatedAt heuristic

- [ ] **Step 1:** Teste:

```ts
import { sortForHome } from '../sortConversations';

test('unread first then recent', () => {
  const a = { id: '1', unread: 0, updatedAt: '11:00', ownership: 'mine' as const };
  const b = { id: '2', unread: 2, updatedAt: '10:00', ownership: 'mine' as const };
  expect(sortForHome([a, b]).map((c) => c.id)).toEqual(['2', '1']);
});
```

- [ ] **Step 2:** Implementar `sortForHome` comparando `unread` desc, depois string `updatedAt` (mock já usa HH:mm / "Ontem" — unread é o sinal forte).
- [ ] **Step 3:** `npm run test:unit -- --testPathPattern=sortConversations` → PASS.

---

### Task 3: QueueDrawer provider + UI

**Files:**
- Create: `src/features/queue/QueueDrawerContext.tsx`
- Create: `src/features/queue/QueueDrawer.tsx`

**Produces:**
- `useQueueDrawer(): { open, close, toggle, visible, setQueueCount, queueCount }`
- `QueueDrawer` consome lista via props `items` + `onClaim(id)`

- [ ] **Step 1:** Context com `useState` para `visible` e `queueCount`.
- [ ] **Step 2:** `QueueDrawer` — `Modal` transparente + `Animated.View` width 86% from left (Reanimated `translateX` -width → 0), overlay pressable, header “Fila”, `FlatList` de `ListRow` + `Button` Assumir.
- [ ] **Step 3:** Empty state “Ninguém na fila agora”.
- [ ] **Step 4:** `accessibilityLabel` no fechar e Assumir.

---

### Task 4: App tabs layout + Mais + Histórico

**Files:**
- Modify: `app/(app)/_layout.tsx`
- Create: `app/(app)/more.tsx`
- Create: `app/(app)/history.tsx`
- Modify: `app/(app)/kanban.tsx` / `profile.tsx` options via layout `href: null`

**Produces:**
- Tabs: `inbox/index` title Atendimento, agenda, notifications, more
- `kanban` e `profile` ocultos (`href: null`) mas navegáveis via router
- Provider envolve Tabs

- [ ] **Step 1:** Wrap `QueueDrawerProvider` em `_layout.tsx`; tabs 4 ícones Ionicons.
- [ ] **Step 2:** `more.tsx` — links Pressable para `/kanban`, `/history`, `/notification-prefs`, `/quick-replies`, `/templates`, `/profile`.
- [ ] **Step 3:** `history.tsx` — lista segmento history (extrair lógica do inbox antigo).
- [ ] **Step 4:** Verificar rotas Expo Router resolvem (`npx expo customize` não necessário; smoke web depois).

---

### Task 5: Home Atendimento + integrar drawer

**Files:**
- Modify: `app/(app)/inbox/index.tsx`

**Produces:**
- Sem Segmented; `ScreenHeader` com menu → `open()`; lista só ativos; `setQueueCount` a partir do filtro fila; empty com “Ver fila”

- [ ] **Step 1:** Remover Segmented; filtrar `active/mine` + `sortForHome`.
- [ ] **Step 2:** Contar fila e `setQueueCount`; render `<QueueDrawer items={queueItems} onClaim={...} />`.
- [ ] **Step 3:** `onClaim` mock seta ownership / live `claimConversation` → `router.push(/conversation/id)` → `close()`.
- [ ] **Step 4:** `ListRow` com badge unread no `trailing`.

---

### Task 6: Conversa usável

**Files:**
- Modify: `app/conversation/[id].tsx`

**Produces:**
- Header nome+status+⋯; CTA “Assumir para responder” se queue; composer com ícones; sheets intactos em função

- [ ] **Step 1:** Trocar topBar para layout spec; `Ionicons` ellipsis / attach / send.
- [ ] **Step 2:** Se `ownership === 'queue'`, banner CTA Assumir acima do composer.
- [ ] **Step 3:** Manter modais actions/attach/transfer; labels claros.
- [ ] **Step 4:** Smoke manual / capture script paths.

---

### Task 7: Auth visual

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/mfa.tsx`

- [ ] **Step 1:** Login — API URL só se `__DEV__`; notice como `Muted`; form sem caixa navy interna.
- [ ] **Step 2:** MFA — alinhar tipografia/spacing ao login.

---

### Task 8: Polimento secundário

**Files:**
- Modify: `app/(app)/agenda.tsx`, `notifications.tsx`, `kanban.tsx`, `profile.tsx`
- Modify: `app/contact/[id].tsx`, `notification-prefs.tsx`, `quick-replies.tsx`, `templates.tsx`

- [ ] **Step 1:** Trocar cards de lista por `ListRow` onde couber; headers com `Title` consistente.
- [ ] **Step 2:** Profile — manter Sair; links já cobertos no Mais (perfil pode ser só conta + sair).

---

### Task 9: Verificação

**Files:**
- Modify: `scripts/capture-screens.mjs` (rotas: home, abrir drawer via menu, mais, history)

- [ ] **Step 1:** `npm run test:unit`
- [ ] **Step 2:** Expo web + `node scripts/capture-screens.mjs` (atualizar seletores: “Atendimento”, “Mais”, “Fila” no drawer)
- [ ] **Step 3:** Atualizar galeria HTML se necessário

---

## Spec coverage

| Spec § | Task |
|--------|------|
| Nav 4 tabs + Mais | 4 |
| Drawer L→R + badge | 3, 5 |
| Home ativos + sort | 2, 5 |
| Conversa composer / Assumir | 6 |
| Auth | 7 |
| Design system | 1 |
| Agenda/Avisos/polimento | 8 |
| Aceite / capturas | 9 |

## Execution

Inline neste chat (usuário pediu “Segue”).
