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
| [13-saude-do-celular.md](13-saude-do-celular.md) | Apple Saúde e Health Connect (Galaxy): o que lê e o contrato de envio |
| [atendimento.md](atendimento.md) | Números/canais, presença, transferir, IA no atendimento |
| [pdv-mobile.md](pdv-mobile.md) | PDV no celular (venda, comprovante, vendas do dia) |
| [treino-gravacao.md](treino-gravacao.md) | Gravação de treino e treino livre com GPS |
| [offline.md](offline.md) | Online/offline do aluno: limite, fila, limpeza, mapa de telas |
| [notificacoes.md](notificacoes.md) | Lembretes locais e avisos |
| [i18n.md](i18n.md) | Idiomas (pt, en, es) |
| [aso/](aso/) | Publicação nas lojas: metadados, checklist, prints |
| [adr/](adr/) | ADRs |

## Estado atual (2026-11-15)

- App ligado à API real para equipe e cliente; modo demonstração para teste e prints.
- PR #1 (redesign + atendimento + treino + PDV Fase 1) mergeado na `main`.
- API com as rotas do app em produção: `backend-v2.172.34` (ver [12-api-gaps.md](12-api-gaps.md)).
- Próximo: prints e envio às lojas (ver [aso/store-readiness-checklist.md](aso/store-readiness-checklist.md)); PDV Fase 2.
