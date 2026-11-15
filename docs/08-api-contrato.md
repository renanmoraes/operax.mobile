# Contrato API (MVP)

Base: `https://api.operax.digital/api`

## Auth

- `POST /auth/device-tokens` / `DELETE /auth/device-tokens` (push)
- `POST /auth/login` (+ tokens se client mobile)
- `POST /auth/mfa/verify`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Auth cliente (proposto — ver seção 7 da spec de auth)

- `POST /auth/client/login` (+ tokens)
- `POST /auth/client/otp/request`
- `POST /auth/client/otp/verify` (+ tokens)
- `GET /auth/client/me`
- `POST /auth/client/switch-tenant` (+ tokens novos, escopados à empresa escolhida)

Nenhum desses existe ainda no backend — contrato proposto em
`docs/superpowers/specs/2026-11-13-auth-staff-cliente-design.md`.

## Inbox

- `GET /conversations`, `/:id`, `/:id/messages`
- `POST /:id/claim|release|transfer`
- `POST /:id/messages`, `.../media`, `.../template`
- `GET /media/:id/signed-url`

## Outros P2–P4

- Quick replies, templates, kanban cards, agenda (apps instaláveis)

Header mobile: `X-Client: operax-mobile` + `Authorization: Bearer`.
