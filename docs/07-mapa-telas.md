# Mapa de telas (P0–P4)

## Tabs

| Tab | Rota | Prioridade |
|-----|------|------------|
| Inbox | `/(app)/inbox` | P0 |
| Kanban | `/(app)/kanban` | P3 |
| Agenda | `/(app)/agenda` | P4 |
| Avisos | `/(app)/notifications` | P1 |
| Perfil | `/(app)/profile` | P1 |

## Stack / modais

| Tela | Rota | Prioridade |
|------|------|------------|
| Login / MFA | `/(auth)/*` | P1 |
| Seleção de papel | `/(auth)/role-select` | P0 |
| Login cliente | `/(auth)/client-login` | P0 |
| OTP cliente | `/(auth)/client-otp` | P0 |
| Seleção de empresa | `/(auth)/client-tenant-select` | P0 |
| Conversa | `/conversation/[id]` | P0 |
| Contato | `/contact/[id]` | P2 |
| Quick replies | `/quick-replies` | P2 |
| Templates | `/templates` | P3 |

## Tabs — cliente

| Tab | Rota |
|-----|------|
| Agenda | `/(client)/agenda` |
| Conversas | `/(client)/conversas` |
| Fitness | `/(client)/fitness` |
| Perfil | `/(client)/perfil` |

Deep link scheme: `operax://`
