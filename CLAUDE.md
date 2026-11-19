# Operax Mobile

App Expo/React Native do CRM Operax.

- Dossiê: `docs/`
- Telas: `app/`
- DS/tokens: `src/design-system/`
- Mocks Fase 1: `src/mocks/`

Rodar: `npx expo start`

## Idiomas

- Todo texto de tela passa pelo i18n (pt, en, es): nada de texto fixo nem `'pt-BR'` fixo. Ver `docs/i18n.md`.

## Antes de cada push

- `npm run lint` (expo lint), `npx tsc --noEmit --noUnusedLocals` e `npx jest` passando.
- `npm run wiki:mapa` passando (ver "Caminho exato na wiki", abaixo).

## Caminho exato na wiki (a Lia lê dali)

A Lia, assistente do Operax, só sabe o que a wiki escreve. Em 19/11/2026 ela mandou abrir **Mais → Pedidos** no app, item que não existe. Por isso:

- Aba nova, item novo no **Mais**, nome trocado ou item removido: atualizar na mesma entrega a seção **Mapa do app** do guia `operax-backend/src/wiki-content/guides/app-celular.md`, no repositório `operax` (`npm run wiki:mapa -- --imprimir` gera o texto pronto). O guia sobe junto, com o `catalog_version` aumentado.
- Tela que só existe no site não entra no mapa: o guia diz que é pelo site.
- Recurso novo que a pessoa usa pelo app ganha, no guia do recurso, o caminho no app com o nome exato da aba, do item e do botão, como está no texto da tela (pt).
- `npm run wiki:mapa` lê as abas (`app/(app)/_layout.tsx`, `app/(client)/_layout.tsx`), o **Mais** (`app/(app)/more.tsx`) e os textos em `src/i18n/locales/pt/`, e falha se o mapa da wiki não citar cada nome. Repositório `operax` em outra pasta: `OPERAX_REPO=<pasta>`.

## Publicação nas lojas (App Store e Google Play)

- Os screenshots da loja são gerados com a skill **`app-store-screenshots`**
  (instalada em `~/.claude/skills/app-store-screenshots`, fonte: github.com/ParthJadhav/app-store-screenshots).
  Ela monta um editor Next.js fora do app (em `store-assets/screenshots-editor/`), com molduras de aparelho,
  títulos e exportação nas resoluções exigidas pela Apple e pelo Google.
- Ordem das telas e títulos: `docs/aso/screenshots-brief.md`. Metadados: `docs/aso/metadata-pt-BR.md`.
  Checklist de envio: `docs/aso/store-readiness-checklist.md`.
- Capturas de tela: rodar `npx expo start --web`, entrar no modo demo (equipe e cliente) e capturar em 430×932
  (iPhone 6,7") ou direto no iPhone com o Expo Go.

