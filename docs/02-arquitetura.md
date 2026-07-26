# Arquitetura

## Stack

- Expo SDK 57 + React Native + TypeScript
- Expo Router (file-based)
- Online-first (sem SQLite de conversas)

## Camadas (alvo)

```
app/          rotas
src/design-system/
src/features/
src/mocks/    Fase 1
src/shared/api/     Fase 2+
src/shared/realtime/ Fase 3+
```

## Princípios

1. Mesma API que o web (`api.operax.digital`)
2. Auth staff com sessão `sid` exclusiva
3. WS só em foreground; push fora do app
