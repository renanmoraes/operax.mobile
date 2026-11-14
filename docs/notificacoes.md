# Notificações do app Operax

Mapa de tudo que avisa o usuário no celular: de onde vem, para onde leva e o que ainda falta.

## Como chega

| Tipo | Quem recebe | Como | App fechado? |
|---|---|---|---|
| Push do Operax | Equipe | Todo aviso criado no Operax (`NotificationsService.create`) vira push para os celulares do usuário (tabela `device_push_tokens`), respeitando as preferências de push dele. | Sim, no app gerado pelo build (EAS). **Não no Expo Go do Android** (o Expo Go não recebe push remoto desde o SDK 53). |
| Tempo real | Equipe | Socket (`notification.new`, mensagens, posse da conversa, chat da equipe). Atualiza as telas e os contadores na hora. | Não (só com o app aberto). |
| Lembrete local | Cliente | Agendado no próprio aparelho a partir da agenda: 1 dia antes, 1 hora antes e 10 minutos antes; aviso na hora de horário novo e de inscrição em aula. | Sim, inclusive no Expo Go. |

## Push da equipe: tipo → tela do app

O push traz o link da tela no Operax web; o app abre a tela equivalente (`src/features/notifications/linkRoute.ts`).

| Tipo (backend) | Quando | Link web | Abre no app |
|---|---|---|---|
| `chat.mention` | Marcaram você no chat da equipe | `/chat/:canal` | Conversa do chat da equipe |
| `chat_urgency` | Cliente esperando resposta há tempo demais | `/inbox/:conversa` | Conversa do atendimento |
| `assignment.expired` | Atendimento voltou para a fila por inatividade | `/inbox/:conversa` | Conversa do atendimento |
| `scheduling.reminder` e avisos de agendamento | Lembrete e mudanças na agenda | `/agenda` | Aba Agenda |
| `kanban.followup_due` | Retorno de cartão do funil vencendo | `/kanban?card=` | Kanban |
| `reminder`, `reminder.due` | Lembretes (inclui Fitness: ficha vencendo, mensagem do aluno) | `/apps/...` | Aba Avisos |
| `report.ready`, `report.failed` | Relatório pronto ou com erro | `/apps/reports/runs/:id` | Aba Avisos |
| `finance.due_digest`, `finance.import_unmatched` | Contas a vencer, extrato sem par | `/apps/finance/...` | Aba Avisos |
| `pos.receivables_overdue` | Recebíveis do PDV atrasados | `/apps/pos/relatorios` | Aba Avisos |
| `menu.order_new` | Pedido novo no cardápio / iFood | `/apps/menu/orders` | Aba Avisos |
| `inventory.expiry` | Lotes perto de vencer | `/apps/inventory-catalog` | Aba Avisos |
| `commercial_hub.*` | Publicação e conferência do hub comercial | `/apps/commercial-hub/...` | Aba Avisos |
| `support.live_chat.message`, `support.ticket.replied` | Suporte Operax respondeu | `/suporte/chamados/:id` | Aba Avisos |
| `bulk_send.*`, `campaign.schedule_missed` | Envio em massa agendado com problema | (sem link) | Aba Avisos |
| `ai.budget.exceeded`, `ai.agent.*` | Limite e alertas da IA | `/admin/ai/...` | Aba Avisos |
| `trial.expiring`, `fitness.tier` | Plano e período de teste | `/settings/billing` | Aba Avisos |
| `wa_backup` | Aviso do backup do WhatsApp | variável | Aba Avisos |

As preferências de push por categoria ficam em Perfil › Preferências de notificação (mesmas categorias do backend, `push-categories.ts`).

## Cliente (portal)

| Evento | Hoje | Falta |
|---|---|---|
| Lembrete de horário e de aula | Local, no aparelho | — |
| Horário novo marcado pela empresa | Local, ao atualizar a agenda | Push do servidor para avisar com o app fechado e sem abrir |
| Inscrição em aula confirmada | Local, na hora | — |
| Resposta da equipe no chat | Só com o app aberto (consulta a cada 3 s) | Push do servidor + tempo real no portal |
| Agendamento aprovado, recusado, remarcado ou cancelado pela empresa | Aparece ao abrir a agenda | Push do servidor |
| Treino novo ou alterado pelo professor | Aparece ao abrir o treino | Push do servidor |
| Vaga na lista de espera da aula | Aparece ao abrir a agenda | Push do servidor (é urgente: a vaga expira) |

**O portal não tem registro de push nem envio no backend.** Para o cliente receber aviso do servidor com o app fechado é preciso:
1. Rota no portal para o celular registrar o token (`POST /api/public/portal/me/device-tokens`), ligada ao acesso (`portal_accesses`).
2. Envio de push nos eventos acima (o `PushDispatchService` da equipe serve de base).
3. Canal em tempo real para o portal (hoje o gateway recusa sessão do portal).

## Equipe: o que ainda falta no backend

- **Mensagem nova de cliente** não gera aviso (`NotificationsService.create`), então não vira push com o app fechado: só aparece pelo socket com o app aberto. O backend precisa criar o aviso (ou mandar push direto) quando chega mensagem numa conversa atribuída ao atendente e na fila dele.

## Para testar o push de verdade

O push remoto só funciona no app gerado pelo EAS (build de desenvolvimento, preview ou produção). No Expo Go dá para testar os lembretes locais, o tempo real e o roteamento ao tocar.
