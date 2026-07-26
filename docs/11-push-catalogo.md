# Catálogo de push — desde o dia zero

## Princípio

Push nativo (FCM/APNs via Expo) é **requisito de produto desde o momento zero**, não fase opcional.
Deve chegar **com o telefone bloqueado / app em background**, com prioridade alta e deep link para a tela certa.

Master `push: true` e **todas as categorias ligadas por padrão**. O usuário pode desligar por categoria no Perfil.

## Categorias (default = ON)

| ID | Título na UI | Quando dispara | Deep link |
|----|--------------|----------------|-----------|
| `queue_new` | Novo atendimento na fila | Conversa humana entrou na fila do agente | `/conversation/:id` |
| `claimed_message` | Nova mensagem no atendimento | Inbound em conversa assumida por mim | `/conversation/:id` |
| `ownership_expiring` | Atendimento perto do vencimento | Tiers de urgência de posse (70/85/90%) | `/conversation/:id` |
| `assignment_expired` | Posse expirada | Worker de expire devolveu à fila | `/conversation/:id` ou Inbox Fila |
| `chat_message` | Mensagem no chat interno | Nova msg em canal interno | chat interno (web hoje; deep link futuro) |
| `chat_mention` | Marcação no chat interno | `@menção` | chat interno |
| `booking_new` | Novo agendamento | Booking criado | `/agenda` |
| `booking_reschedule` | Reagendamento | Horário mudou / pendente manual | `/agenda` |
| `reminder` | Lembretes | Lembrete de agenda / follow-up | `/agenda` ou kanban |
| `transfer` | Transferência de conversa | Transferida para mim/fila | `/conversation/:id` |
| `urgency` | Urgência no atendimento | Escalonamento crítico | `/conversation/:id` |
| `kanban_followup` | Follow-up do funil | Follow-up due / won / lost | `/kanban` |

## Prefs na API

```ts
notification_prefs: {
  sound: true,
  desktop: false,       // web
  email_digest: false,
  push: true,           // master mobile — DEFAULT true
  categories: {         // omitido = tudo true
    queue_new: true,
    claimed_message: true,
    // ...
  }
}
```

## Comportamento técnico

1. `NotificationsService.create` → persiste in-app + WS + **enqueue push**
2. Push só se usuário tem `device_push_tokens` ativo e `prefs.push !== false`
3. Categoria desligada → não envia push (in-app pode continuar)
4. iOS: permissão + Background Modes remote-notification; Android: canal alta prioridade
5. App registra token no login (`POST /api/auth/device-tokens`)

## Gaps de emissão a fechar no backend

Já emitem in-app (viram push automaticamente via dispatcher):

- `conversation.message`, `chat_urgency`, `chat.message`, `kanban.*`, parte de suporte/IA

Precisam passar a emitir notificação formal (hoje só WS ou nada):

- `queue.new` (fila — hoje parcial via conversation.message)
- `chat.mention` (hoje só WS `mention.received`)
- `assignment.expired` / transfer dedicados
- `scheduling.booking_new` / `scheduling.booking_reschedule`
- `scheduling.reminder` para staff (além do WhatsApp ao cliente)

## Código mobile

- Catálogo: `src/features/notifications/catalog.ts`
- Prefs UI: `app/(app)/notification-prefs.tsx`
- Permissão: `src/features/notifications/push.ts`
