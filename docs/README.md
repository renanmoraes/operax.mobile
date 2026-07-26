# Dossiê Operax Mobile

Documentação de kickoff do app nativo (iOS/Android). Fonte canônica de produto/API continua em `../operax/DOCUMENTS`; este vault registra decisões e escopo **mobile**.

## Índice

| Doc | Assunto |
|-----|---------|
| [00-produto.md](00-produto.md) | Visão, persona, anti-escopo |
| [01-brand.md](01-brand.md) | Tokens, tipografia, tom |
| [02-arquitetura.md](02-arquitetura.md) | Expo, online-first |
| [03-auth-sessao.md](03-auth-sessao.md) | Bearer, SecureStore, sessão exclusiva |
| [04-inbox-atendimento.md](04-inbox-atendimento.md) | Fila, posse, 24h |
| [05-realtime-push.md](05-realtime-push.md) | Socket.IO + FCM/APNs |
| [06-midia.md](06-midia.md) | Imagem, áudio, vídeo, docs |
| [07-mapa-telas.md](07-mapa-telas.md) | Rotas P0–P4 |
| [08-api-contrato.md](08-api-contrato.md) | Endpoints MVP |
| [09-roadmap-estudo.md](09-roadmap-estudo.md) | Prioridades |
| [10-seguranca-compliance.md](10-seguranca-compliance.md) | Segurança |
| [11-push-catalogo.md](11-push-catalogo.md) | Push defaults ON (dia zero) |
| [12-api-gaps.md](12-api-gaps.md) | Gaps do probe automático |
| [adr/](adr/) | ADRs |

## Estado atual

- **Fase 1:** telas navegáveis com mocks (P0–P4)
- **Push:** requisito desde o dia zero (tudo ON por padrão) — ver 11-push-catalogo.md
- Wiring auth Bearer + POST device-tokens no login: próxima entrega
