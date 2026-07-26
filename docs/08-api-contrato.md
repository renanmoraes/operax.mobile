# Contrato API (MVP)

Base: `https://api.operax.digital/api`

## Auth

- `POST /auth/device-tokens` / `DELETE /auth/device-tokens` (push)
- `POST /auth/login` (+ tokens se client mobile)
- `POST /auth/mfa/verify`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Inbox

- `GET /conversations`, `/:id`, `/:id/messages`
- `POST /:id/claim|release|transfer`
- `POST /:id/messages`, `.../media`, `.../template`
- `GET /media/:id/signed-url`

## Outros P2–P4

- Quick replies, templates, kanban cards, agenda (apps instaláveis)

Header mobile: `X-Client: operax-mobile` + `Authorization: Bearer`.
