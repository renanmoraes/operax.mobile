# Pacote de submit — Operax Mobile 1.0.0

Assets e metadados prontos para colar nas lojas. Builds via EAS Workflows.

## Conteúdo

| Pasta / arquivo | Uso |
|-----------------|-----|
| `icon/icon-1024.png` | Ícone App Store / Play (1024×1024, opaco) |
| `feature-graphic/feature-graphic-1024x500.png` | Feature graphic Google Play |
| `screenshots/ios/*-1290x2796.png` | 8 capturas iPhone 6.7" com headline |
| `screenshots/android/*-1080x1920.png` | 8 capturas Play phone |
| `review/APP_REVIEW_NOTES.md` | Notas + conta demo (preencher senha) |
| `../docs/aso/metadata-pt-BR.md` | Título, keywords, descrições |

## Ordem das screenshots (já numeradas)

1. Assuma a fila agora  
2. Seus atendimentos no bolso  
3. Responda sem perder a posse  
4. Avisos que chegam a tempo  
5. Preferências sob controle  
6. Tudo em um só lugar  
7. Agenda do dia  
8. Entre com sua empresa  

## EAS — project & workflow

- Conta / owner: `operaxdigitals-team` · projeto `operax`
- `projectId`: `5dcb948b-9371-4830-8324-29ef9a87e4e3`
- Workflow: [`.eas/workflows/create-production-builds.yml`](../.eas/workflows/create-production-builds.yml)

```bash
# Builds Android + iOS (paralelo)
npx eas-cli@latest workflow:run create-production-builds.yml

# Se iOS falhar por assinatura (interativo, uma vez):
npx eas-cli credentials:configure-build -p ios -e production
```

## Artefatos de produção (último workflow)

Workflow: https://expo.dev/accounts/operaxdigitals-team/projects/operax/workflows/019f9c08-55fd-766c-a406-56a56d616871

| Plataforma | Status | Link |
|------------|--------|------|
| Android AAB `1.0.0` (versionCode 3) | ✅ | [Download AAB](https://expo.dev/artifacts/eas/kzHjRDJyc9ECj3HC0TXcnqB-o8djgzzIBE265Y7b8wY.aab) · [build](https://expo.dev/accounts/operaxdigitals-team/projects/operax/builds/e982c498-5a33-4da8-acb7-12f30bbaec1b) |
| iOS IPA | ❌ pendente credentials Apple | [build falho](https://expo.dev/accounts/operaxdigitals-team/projects/operax/builds/3fc79ac3-81b5-4de4-ab93-0f18f07c13f4) |

## Checklist rápido no console

- [ ] Upload ícone 1024  
- [ ] Upload feature graphic (Play)  
- [ ] Upload screenshots 1–8  
- [ ] Colar metadados de `docs/aso/metadata-pt-BR.md`  
- [ ] Privacy URL live: `https://operax.digital/privacidade-mobile`  
- [ ] Preencher senha demo em `review/APP_REVIEW_NOTES.md`  
- [x] Build Android AAB (link acima)  
- [ ] Build iOS após `credentials:configure-build`  
- [ ] `eas submit` (precisa `ascAppId` + Play service account)  
