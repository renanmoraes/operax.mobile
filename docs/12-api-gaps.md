# Gaps da API

Nenhum gap bloqueante em 2026-11-15. As rotas que o app precisava e não existiam entraram no release
`backend-v2.172.34` do Operax (deploy em 2026-11-15):

| Rota | Para quê | Detalhe |
|------|----------|---------|
| `POST /api/public/portal/fitness/activities` | Treino livre gravado no celular (GPS, tipo, séries, como foi) | Janela de 14 dias (fora dela 422); chave de idempotência por aluno |
| `POST /api/mobile/logs` | Erros do app (antes e depois do login) | Até 50 por envio, limite por IP real, segredos tirados da mensagem e da pilha |
| `POST /api/apps/pos/sales/:id/receipt/send` | Comprovante do PDV pelo WhatsApp ou e-mail da empresa | `pos:receipt_reprint`; 422 `template_required` fora das 24 h sem modelo aprovado |
| `GET /api/public/pdv/comprovante/:token` (e `app.operax.digital/comprovante/<token>`) | PDF do comprovante para o cliente | Token HMAC, sem login |

## Notas conhecidas

- Agenda pode retornar **403** se Scheduling não estiver no plano — a tela Agenda trata isso.
- Push real no aparelho exige EAS projectId + FCM/APNs.
- O modelo de WhatsApp `operax_pdv_comprovante` é pedido à Meta no primeiro envio fora da janela; até aprovar, o app orienta usar o PDF ou o e-mail.
