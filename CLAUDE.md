# Operax Mobile

App Expo/React Native do CRM Operax.

- Dossiê: `docs/`
- Telas: `app/`
- DS/tokens: `src/design-system/`
- Mocks Fase 1: `src/mocks/`

Rodar: `npx expo start`

## Antes de cada push

- `npm run lint` (expo lint), `npx tsc --noEmit --noUnusedLocals` e `npx jest` passando.

## Publicação nas lojas (App Store e Google Play)

- Os screenshots da loja são gerados com a skill **`app-store-screenshots`**
  (instalada em `~/.claude/skills/app-store-screenshots`, fonte: github.com/ParthJadhav/app-store-screenshots).
  Ela monta um editor Next.js fora do app (em `store-assets/screenshots-editor/`), com molduras de aparelho,
  títulos e exportação nas resoluções exigidas pela Apple e pelo Google.
- Ordem das telas e títulos: `docs/aso/screenshots-brief.md`. Metadados: `docs/aso/metadata-pt-BR.md`.
  Checklist de envio: `docs/aso/store-readiness-checklist.md`.
- Capturas de tela: rodar `npx expo start --web`, entrar no modo demo (equipe e cliente) e capturar em 430×932
  (iPhone 6,7") ou direto no iPhone com o Expo Go.

