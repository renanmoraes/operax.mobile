# Checklist — prontidão para App Store + Play

Skills: `app-launch`, `app-rejection-recovery`, `aso-audit`, `android-aso`.

## P0 — Obrigatório antes do upload

### Contas & build

- [ ] Conta Apple Developer + App Store Connect app criado (`digital.operax.mobile`)
- [ ] Conta Google Play Console + app criado
- [x] EAS project real — `projectId` `5dcb948b-9371-4830-8324-29ef9a87e4e3` (conta `operaxdigitals-team`)
- [x] `eas.json` com profiles `preview` e `production`
- [x] Build Android AAB production — ver links abaixo
- [ ] Build iOS production — bloqueado: credenciais Apple interativas (`eas credentials:configure-build -p ios -e production`)
- [x] Version `1.0.0` (remote versioning EAS; Android versionCode 3)

### Privacidade & permissões

- [ ] Privacy Policy URL **pública** (HTTPS) específica do mobile
- [ ] Terms of Use URL (recomendado)
- [ ] App Privacy (ASC) preenchido: fotos, tokens push, identificadores, etc.
- [ ] Play Data Safety form alinhado
- [ ] iOS usage strings (câmera/galeria/docs) — ver `app.json` infoPlist
- [ ] Android: só permissões justificadas (notificações, mídia se pedidas em runtime)
- [ ] **Localização durante o treino com a tela apagada** (gravação de corrida/pedal):
  - Play Console → Conteúdo do app → *Serviços em primeiro plano*: declarar tipo **location**, uso
    "gravar o treino que o aluno iniciou", com vídeo curto (iniciar treino, apagar a tela, aviso fixo do Operax).
    O app **não** pede `ACCESS_BACKGROUND_LOCATION`, então não entra na declaração de localização em segundo plano.
  - Play Data Safety e App Privacy (ASC): localização **precisa** e dados de condicionamento físico, ligados ao usuário,
    usados só para o funcionamento do app.
  - iOS: `UIBackgroundModes: location`; textos de localização em pt/en/es (`app.json` e `locales/ios/*.json`).
  - Áudio do chat não toca em segundo plano: `expo-audio` com `enableBackgroundPlayback: false` (sem serviço
    `mediaPlayback` no Android e sem modo `audio` no iOS). Não religar sem uso real: as duas lojas recusam.
  - No Android aparecem dois avisos fixos durante o treino com GPS (serviço de localização e resumo da tela
    bloqueada, se ligado nos ajustes da gravação).

### Review

- [ ] Conta demo estável (tenant review) sem MFA bloqueante **ou** instruções MFA
- [ ] Review Notes com fluxo (ver `metadata-pt-BR.md`)
- [ ] Review Notes (Apple): a localização em segundo plano só é usada enquanto o aluno grava um treino que ele
  mesmo iniciou e para ao finalizar (ou em até 6 h). O pedido "Sempre" não é usado; as chaves existem pelo modo
  de segundo plano do iOS. Informar login de aluno de teste com Fitness ativo para o revisor gravar uma corrida.
- [ ] Vídeo curto opcional do fluxo Assumir (ajuda Guideline 2.1)
- [ ] Export compliance / encryption (Expo standard answers)
- [ ] Content rights / age rating (Business, 4+)

### Listagem

- [ ] Título + subtítulo / short desc (pt-BR) colados
- [ ] Descrição completa
- [ ] Ícone 1024×1024
- [x] ≥3 screenshots iPhone + ≥2 Android (10 iPhone 6,9"/6,5" e 8 Android em `store-assets/loja/`, ordem em `screenshots-brief.md`)
- [x] Feature graphic Play 1024×500 (`store-assets/loja/android/feature-graphic/`)
- [ ] Categoria Business

## P1 — Fortemente recomendado no 1º submit

- [ ] Support URL + marketing URL (operax.digital)
- [ ] What’s New 1.0.0
- [ ] Crash reporting (Sentry ou similar)
- [ ] Analytics mínimo (sem PII desnecessária)
- [ ] TestFlight / closed testing Play com 10+ internos

## P2 — Pós-lançamento

- [ ] Preview video
- [ ] Rating prompt (`rating-prompt-strategy`)
- [ ] Resposta a reviews (`review-management`)
- [ ] Localização en-US (`localization`)
- [ ] Re-auditar ASO com IDs reais

## Estado atual do repo (2026-07-25)

| Item | Status |
|------|--------|
| Bundle / package IDs | ✅ `digital.operax.mobile` |
| Ícone / splash / brand | ✅ assets presentes |
| Metadados draft | ✅ `docs/aso/metadata-pt-BR.md` |
| Screenshots de loja (captioned) | ✅ `store-assets/loja/` (iOS 6,9"/6,5", Android, GIFs) |
| Feature graphic Play | ✅ `store-assets/loja/android/feature-graphic/` |
| Ícone 1024 opaco | ✅ `store-assets/icon/` |
| Review notes | ✅ `store-assets/review/` |
| Privacy policy draft | ✅ `docs/aso/privacy-policy-mobile.md` (publicar URL) |
| Version 1.0.0 | ✅ `app.json` |
| Screenshots de produto (dev) | ✅ `screenshots/` |
| Screenshots de loja (captioned) | ✅ `store-assets/loja/` (iOS 6,9"/6,5", Android, GIFs) |
| EAS projectId | ✅ `5dcb948b-9371-4830-8324-29ef9a87e4e3` |
| eas.json | ✅ |
| Workflow produção | ✅ `.eas/workflows/create-production-builds.yml` |
| Android AAB 1.0.0 | ✅ ver builds abaixo |
| iOS IPA production | ❌ credenciais Apple (interativo) |
| Privacy policy URL | ⚠️ draft pronto — publicar em operax.digital |
| Usage strings iOS | ✅ `app.json` infoPlist |
| Conta demo documentada | ⚠️ template em metadata / review notes |
| Push produção (FCM/APNs) | ❌ gap conhecido |

## Builds EAS (workflow 2026-07-25)

Workflow: [create-production-builds](https://expo.dev/accounts/operaxdigitals-team/projects/operax/workflows/019f9c08-55fd-766c-a406-56a56d616871)

| Plataforma | Status | Artefato / logs |
|------------|--------|-----------------|
| Android | ✅ SUCCESS | [AAB](https://expo.dev/artifacts/eas/kzHjRDJyc9ECj3HC0TXcnqB-o8djgzzIBE265Y7b8wY.aab) · [build](https://expo.dev/accounts/operaxdigitals-team/projects/operax/builds/e982c498-5a33-4da8-acb7-12f30bbaec1b) |
| iOS | ❌ ERRORED | [build](https://expo.dev/accounts/operaxdigitals-team/projects/operax/builds/3fc79ac3-81b5-4de4-ab93-0f18f07c13f4) — rodar `npx eas-cli credentials:configure-build -p ios -e production` e re-disparar o workflow |

Re-disparar após iOS credentials:

```bash
npx eas-cli@latest workflow:run create-production-builds.yml
```

## Go / No-Go

**No-Go** para upload completo (iOS + Play) até P0 fechado e IPA gerado.  
**Parcial:** AAB Android pronto para Play quando consoles/privacidade/demo estiverem ok.  
**Go** quando checklist P0 estiver 100% e builds instaláveis em device físico.
