# Operax Mobile

App Expo/React Native do CRM Operax.

- Dossiê: `docs/`
- Telas: `app/`
- DS/tokens: `src/design-system/`
- Mocks Fase 1: `src/mocks/`

Rodar: `npx expo start`

## Idiomas

- Todo texto de tela passa pelo i18n (pt, en, es): nada de texto fixo nem `'pt-BR'` fixo. Ver `docs/i18n.md`.

## Cor na tela: 60-30-10

- Toda tela nova ou refatorada fica perto de 60% base, 30% estrutura e 10% impacto. O impacto vai só na ação que a pessoa deve fazer: uma por tela, nunca de enfeite.
- Paleta geral: impacto `colors.primary`. Telas de fitness do aluno: azul e navy viram estrutura e o impacto é `colors.impactFitness` (ciano) com `colors.impactFitnessText`; ciano só como fundo de botão, nunca como texto ou ícone em fundo claro.
- Papéis em `colorRoles` (`src/design-system/tokens.ts`). Regra completa: `docs/cor-60-30-10.md`. No relatório, diga a paleta e a ação de impacto.

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

