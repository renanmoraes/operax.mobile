# Mapa de telas

Estado em 2026-11-15 (merge do PR #1 na `main`). Todas as telas funcionam com login real e no modo demonstração.

## Equipe — abas

| Aba | Rota | O que faz |
|-----|------|-----------|
| Atendimento | `/(app)/inbox` | Fila, minhas e todas; filtro por número/canal; "N online" (presença da equipe) |
| Agenda | `/(app)/agenda` | Agenda do dia e da semana (com o app Agenda na empresa) |
| Kanban | `/(app)/kanban` | Funil comercial |
| Avisos | `/(app)/notifications` | Central de notificações |
| Mais | `/(app)/more` | PDV, pacientes, histórico, respostas rápidas, templates, chat da equipe, conta |

## Equipe — telas

| Tela | Rota | Doc |
|------|------|-----|
| Conversa | `/conversation/[id]` | [atendimento.md](atendimento.md) — chip do número, IA (resumo e sugestões), transferir, posse |
| Contato | `/contact/[id]` | — |
| Pacientes | `/pacientes` | — |
| Histórico | `/(app)/history` | — |
| Chat da equipe | `/equipe`, `/equipe/[id]` | — |
| Respostas rápidas / Templates | `/quick-replies`, `/templates` | — |
| **PDV — venda** | `/pdv` | [pdv-mobile.md](pdv-mobile.md) — câmera, peso ou valor, descontos, cliente em passos, receber, comprovante |
| **PDV — vendas do dia** | `/pdv/vendas` | [pdv-mobile.md](pdv-mobile.md) — reenviar, corrigir pagamento, cancelar |
| Preferências de push | `/notification-prefs` | [11-push-catalogo.md](11-push-catalogo.md) |
| Permissões do celular | `/permissoes` | — |
| Perfil | `/(app)/profile` | — |

## Cliente — abas

| Aba | Rota |
|-----|------|
| Início | `/(client)/inicio` |
| Agenda | `/(client)/agenda` |
| Conversas | `/(client)/conversas` |
| Treino | `/(client)/fitness` |
| Perfil | `/(client)/perfil` |

## Cliente — telas

| Tela | Rota | Doc |
|------|------|-----|
| Compromisso / cancelar | `/cliente/compromisso/[id]`, `/cliente/cancelar/[id]` | — |
| Aula (vaga, aceitar, cancelar) | `/cliente/aula/[id]` | — |
| Chat com a empresa | `/cliente/chat/[slug]` | — |
| Ficha de treino | `/cliente/treino/[id]` | — |
| Sessão de musculação (cronômetros) | `/cliente/treino/sessao/[id]` | — |
| Treino concluído (recordes, como foi) | `/cliente/treino/concluido` | — |
| Gravar / registrar parte da ficha | `/cliente/treino/gravar/[id]`, `/cliente/treino/registrar/[id]` | [treino-gravacao.md](treino-gravacao.md) |
| Treino livre (GPS) | `/cliente/treinar`, `/cliente/treinar/[sport]` | [treino-gravacao.md](treino-gravacao.md) |
| Atividade, exercício, histórico, evolução, conquistas, calendário | `/cliente/atividade/[id]`, `/cliente/exercicio/[id]`, `/cliente/historico`, `/cliente/evolucao`, `/cliente/conquistas`, `/cliente/calendario` | — |
| Relógios e Saúde | `/cliente/relogios` | [13-saude-do-celular.md](13-saude-do-celular.md) |

## Entrada

| Tela | Rota |
|------|------|
| Equipe ou cliente | `/(auth)/role-select` |
| Login da equipe / MFA | `/(auth)/login`, `/(auth)/mfa` |
| Login do cliente / código / empresa | `/(auth)/client-login`, `/(auth)/client-otp`, `/(auth)/client-tenant-select` |

Deep link: `operax://`
