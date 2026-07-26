# Redesign de usabilidade — Operax Mobile

**Data:** 2026-07-25  
**Status:** aprovado em conversa (Opção 1)  
**Stack:** Expo SDK 57 · React Native · Expo Router · TypeScript  
**Skills de referência:** ui-skills (`baseline-ui` + redesign), brand Operax existente

---

## 1. Problema

As telas atuais priorizam “cards genéricos” e três segmentos iguais (Ativo / Fila / Histórico). Isso dilui o fluxo real de campo: o atendente precisa **assumir da fila** (posse com tempo máximo; ao expirar volta à fila), sem transformar a home num painel só de fila.

## 2. Objetivo

Redesenho profundo focado em usabilidade operacional:

1. Home = **meus atendimentos** (trabalho do dia).
2. Fila acessível via **hambúrguer → drawer L→R**, com badge de contagem.
3. Conversa otimizada para responder; posse/ações no sheet.
4. Visual Operax (cobalt/navy), menos chrome de card, hierarquia e densidade adequadas a campo.

**Fora de escopo:** push com tela bloqueada/EAS, offline de atendimento, mudança de API.

## 3. Princípios de IA / UX

| Princípio | Aplicação |
|-----------|-----------|
| Job-to-be-done | Abrir app → ver o que é meu → responder; fila a um gesto |
| Posse visível | Countdown / urgência quando a posse está perto do fim |
| Polegar | Ações primárias na metade inferior; drawer da esquerda |
| Sem enviesar demais | Fila não compete com a lista principal; só badge + drawer |
| Menos card soup | Linhas de lista com separadores; cards só onde elevação ajuda |
| Uma ação clara | Na fila: Assumir; na conversa: Enviar |

## 4. Arquitetura de navegação

### 4.1 Bottom tabs (4)

| Tab | Rota | Função |
|-----|------|--------|
| Atendimento | `(app)/inbox` (renome visual) | Home — conversas com posse do usuário |
| Agenda | `(app)/agenda` | Compromissos do dia |
| Avisos | `(app)/notifications` | Inbox de push/eventos |
| Mais | `(app)/more` (nova) | Hub: Kanban, Histórico, Perfil, Prefs, QR, Templates |

Remover tabs diretas de Kanban e Perfil da barra (passam para **Mais**).

### 4.2 Drawer da Fila

- Trigger: ícone hambúrguer no header da home (e opcionalmente nas telas de atendimento).
- Animação: slide **esquerda → direita** (~80–86% da largura).
- Conteúdo: lista de conversas `ownership === queue` / segmento fila.
- Cada item: nome, preview, canal/setor, CTA **Assumir**.
- Assumir bem-sucedido → fecha drawer → navega para `/conversation/[id]`.
- Badge no hambúrguer = contagem da fila (cap em `9+`).
- Overlay escurecido; tap fora ou botão fechar fecha o drawer.
- Empty state: “Ninguém na fila agora” + fechar.

Implementação sugerida: estado global leve (`QueueDrawerProvider`) ou componente no layout `(app)` + `Modal`/`Animated` full-height left panel — sem nova lib obrigatória.

### 4.3 Stacks / modais (inalterados em papel)

- `/conversation/[id]`, `/contact/[id]`
- Modais: quick-replies, templates, notification-prefs

## 5. Telas

### 5.1 Auth — Login

- Brand Operax no topo (mark + wordmark), sem tagline de API em produção (API só em `__DEV__` / mock).
- Campos em superfície clara única (sem “card dentro de card” pesado): código empresa, e-mail, senha.
- Aviso de sessão exclusiva como texto secundário (não caixa navy dominante).
- CTA primário **Entrar**; secundário mock só se `ALLOW_MOCK`.
- Erros inline abaixo do campo/ação.

### 5.2 Auth — MFA

- Título “Verificação”, instrução curta, campo código, Confirmar, Voltar.
- Mesma linguagem visual do login (navy + superfície clara).

### 5.3 Home — Atendimento

- Header: hambúrguer (badge) | título “Atendimento” | (opcional) filtro mínimo.
- Lista flat, sem card por linha:
  - Nome + horário
  - Preview 1 linha
  - Meta: canal · setor
  - Se posse do usuário: indicador de urgência (texto “Posse · Xm” ou barra fina) quando disponível nos dados; se mock sem %, usar placeholder coerente.
- Ordenação: (1) posse perto do fim, (2) não lidas, (3) mais recentes.
- Empty: “Nenhum atendimento com você” + atalho “Ver fila”.
- Pull-to-refresh em modo live.

### 5.4 Drawer — Fila

- Título “Fila” + contagem.
- Linha + botão **Assumir** (ou swipe/ação à direita se couber sem atrito; MVP = botão).
- Após Assumir: toast curto opcional + navegação à conversa.

### 5.5 Conversa

- Header limpo: back | nome (tap → contato) | status (“Com você” / “Na fila”) | menu ⋯.
- Banner 24h só quando necessário → link Templates.
- Bolhas: out = primary; in = superfície clara sem borda pesada.
- Composer dominante: anexo · QR · input · enviar (ícone ou label curto).
- Sheet ⋯: Assumir · Liberar · Transferir · Encerrar · Ver contato.
- Se na fila ao abrir: CTA contextual “Assumir para responder” acima do composer (além do sheet).

### 5.6 Contato

- Nome, telefone, e-mail, tags, notas — layout em blocos simples, sem cards empilhados demais.

### 5.7 Agenda / Avisos

- Listas densas; status como texto/badge discreto; manter dados mock/API atuais.

### 5.8 Mais

- Lista de links: Kanban, Histórico de atendimentos, Preferências de notificação, Respostas rápidas, Templates Meta, Perfil / Sair.
- Histórico: tela ou seção que reutiliza a query/lista de histórico (antiga aba Histórico).

### 5.9 Prefs push / QR / Templates / Kanban / Perfil

- Polimento visual alinhado ao design system (espaçamento, tipografia, menos bordas).
- Sem mudança de regras de negócio.

## 6. Design system

### 6.1 Tokens

- Manter identidade: `primary #1e4ed8`, `chromeNavy #050a14`, texto navy/cinza frio.
- Ajustar: `pageBg` mais neutro, `border` mais suave, raios (lista 0 / sheet 16, botões 10).
- Spacing scale consistente; tipografia Inter (já no app) com hierarquia title/section/body/caption.
- Z-index fixo: overlay drawer `40`, sheet `50`, toast `60`.

### 6.2 Componentes

- Evoluir `Screen`, `Button`, `Field`, `Badge`, `EmptyState`, `Loading`.
- Novos: `ListRow`, `QueueDrawer`, `ScreenHeader` (hambúrguer + título + ações), `OwnershipHint`.
- `Segmented` deixa de ser o eixo da home (pode permanecer para uso pontual).
- Evitar `Card` como default de lista; usar só em hubs (Mais, Perfil).

## 7. Dados e comportamento

- Continuar `mode: mock | live` e APIs existentes.
- Fila: mesmo filtro atual (`segment === 'queue' || ownership === 'queue'`).
- Ativos: `segment === 'active' || ownership === 'mine'`.
- Histórico: rota sob Mais; mesma fonte `getMyHistory` / mock history.
- Assumir: `claimConversation` (live) ou estado local (mock).
- Countdown de posse: se API não expuser %/TTL no mobile ainda, UI mostra status textual “Com você”; quando houver campo de expiração no map, ligar `OwnershipHint`. Não inventar endpoint neste redesenho.

## 8. Erros e estados

| Estado | Tratamento |
|--------|------------|
| Loading lista | Skeleton de 3–5 linhas ou `Loading` central |
| Empty ativos | CTA “Ver fila” abre drawer |
| Empty fila | Mensagem + fechar |
| Falha Assumir | Toast/erro no item; drawer permanece aberto |
| Falha envio | Toast na conversa; draft preservado |
| Sem rede (live) | Mensagem na home; sem fingir offline mode |

## 9. Acessibilidade

- Hambúrguer e ícones com `accessibilityLabel` (“Abrir fila”, “N na fila”).
- Alvos de toque ≥ 44pt.
- Drawer: foco/escape = fechar (web); announce ao abrir.
- Contraste texto muted sobre pageBg dentro do AA quando possível.

## 10. Plano de implementação (alto nível)

1. Tokens + componentes base (`ListRow`, `ScreenHeader`, `QueueDrawer`).
2. Layout tabs: Atendimento / Agenda / Avisos / Mais + provider do drawer.
3. Refatorar inbox → home ativos + drawer fila + tela Histórico.
4. Conversa (header, CTA Assumir, composer, sheets).
5. Login / MFA.
6. Mais + polimento Agenda, Avisos, Prefs, QR, Templates, Kanban, Contato, Perfil.
7. Recaptura de screenshots / galeria.

## 11. Critérios de aceite

- [ ] Home mostra só atendimentos do usuário (não a fila misturada).
- [ ] Hambúrguer abre drawer L→R com a fila e badge correto.
- [ ] Assumir na fila leva à conversa com posse.
- [ ] Bottom nav tem 4 itens; Kanban/Perfil/Histórico acessíveis via Mais.
- [ ] Conversa: enviar é a ação dominante; posse no ⋯ / CTA contextual.
- [ ] Login/MFA alinhados ao novo visual sem regressão de auth.
- [ ] Mock e live continuam funcionando (`ALLOW_MOCK` / API).

## 12. Riscos

| Risco | Mitigação |
|-------|-----------|
| Usuário não acha a fila | Badge + empty state da home com “Ver fila” |
| TTL de posse sem dado na API | UI degradada a status textual até gap de API |
| Drawer no web Expo | Testar com Playwright; fallback Modal full screen |

---

## Decisões fechadas

1. Home = meus atendimentos; fila no drawer L→R (não strip no topo).
2. Não enviesar demais para a fila — badge + gesto, não home da fila.
3. Bottom nav 4 itens com hub **Mais**.
4. Brand Operax preservada; redesign de hierarquia/usabilidade, não rebrand.
