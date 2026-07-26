# Segurança

- Sessão exclusiva (`user_sessions.sid`)
- MFA igual ao web
- Tokens só em SecureStore
- Sem bucket R2 público — signed URLs
- RBAC `agent`: `conversations:read_own`, claim, send_*, transfer
- LGPD: não cachear mídia sensível além do necessário
