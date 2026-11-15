# Atendimento no celular

O app tem o mesmo poder do atendimento do Operax web, nas mesmas rotas e permissões.

| Recurso | Onde aparece | Rota | Permissão |
|---|---|---|---|
| Vários números/canais | Selo colorido no card e no topo da conversa; filtro "Todos os números" no atendimento (só com mais de um número) | `GET /api/conversations/inbox-connections`, filtro `connection_id` | `conversations:read_own` |
| Equipe agora | Pílula "N online" no topo do atendimento | `GET /api/users/team-presence` (a cada 60 s) | `users:view_availability` |
| Minha disponibilidade | Dentro do painel "Equipe agora" (Indisponível pede confirmação) | `GET/PATCH /api/users/me/availability` | `users:view_availability` |
| Transferir para atendente | ⋯ › Transferir › Atendente (quem está com o Operax fechado não pode ser escolhido; janela de 24 h fechada só deixa fila) | `POST /:id/transfer` | `conversations:transfer` |
| Transferir para fila | ⋯ › Transferir › Fila | `POST /:id/transfer-queue`, `GET /api/queues` | `conversations:send_handoff` + `queues:read` |
| Resumo da IA | Botão roxo de brilho no topo da conversa | campos `ai_summary*` do `GET /:id`, `POST /:id/summary/regenerate`, `POST /:id/summary/feedback`, socket `conversation.summary` | `ai:use` + app `ia` instalado |
| Sugestões de resposta | Pílulas acima do campo (2 s depois de mensagem do cliente, ou "Sugerir resposta") | `POST /:id/copilot/suggest`, `/copilot/feedback` | idem |
| Melhorar texto | Com 40+ caracteres no rascunho | `POST /:id/copilot/polish-draft` | idem |
| Agendar | ⋯ › anexos › Agendar (já existia) | `/api/scheduling/*` | `bookings:create` |

Regras:
- A cor do número vem do id (a mesma em todas as telas). Com um número só, nada muda na tela.
- A IA só propõe: sugestão e texto melhorado vão para o campo, quem envia é a pessoa.
- "Atendendo" exige disponível **e** conectado (web ou app). Disponível com tudo fechado aparece como aviso.
- Código: `src/features/attendance/` e `src/shared/api/attendance.api.ts`. Textos no namespace `attendance`.
