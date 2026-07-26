# Realtime e push

## Princípio (dia zero)

Push nativo **não é fase futura**. É requisito desde o MVP: deve chegar com telefone bloqueado via FCM/APNs (Expo Push).

Ver catálogo completo e defaults: [11-push-catalogo.md](11-push-catalogo.md).

## Socket.IO (app aberto)

Eventos: `message.received/sent`, `conversation.*`, `assignment.*`, `notification.new`.

## Push nativo

- Registro: `POST /api/auth/device-tokens` após login
- Dispatcher: acoplado a `NotificationsService.create`
- Prefs: `notification_prefs.push` + `categories.*` (tudo ON por default)
- Canal Android alta prioridade `operax-default`
- iOS: `UIBackgroundModes: remote-notification`
- Deep links: `operax://conversation/:id`, `operax://agenda`, etc.

## Código

- `src/features/notifications/catalog.ts`
- `src/features/notifications/push.ts`
- Tela: `app/notification-prefs.tsx`
