# Operax Mobile

App nativo (iOS/Android) do CRM Operax — atendimento em campo com a mesma essência do web.

## Estado

- Telas P0–P4 navegáveis
- Auth live (Bearer + SecureStore) + demo mock
- Inbox / conversa / avisos ligados à API quando logado de verdade
- Push: permissão + registro de device token; catálogo com defaults ON
- Seleção de papel (equipe/cliente); login de cliente (senha/OTP) com modo demo — endpoints reais pendentes

Dossiê: [`docs/`](docs/)

## Stack

Expo SDK 57 · React Native · TypeScript · Expo Router · React Query · Socket.IO · SecureStore

## Config

```bash
cp .env.example .env
# EXPO_PUBLIC_API_URL=https://api.operax.digital
```

## Rodar

```bash
npm install
npx expo start
```

- **Entrar** — login real (`X-Client: operax-mobile`); derruba sessão web
- **Entrar direto (mock)** — navega com fixtures locais

## Push / build nativo

Configure EAS `projectId` em `app.json` e credenciais FCM/APNs para push com tela bloqueada.


## Testes

```bash
npm run test:unit   # unitários
npm run test:api    # probe na API real
npm run test:ci     # unit + api
```
