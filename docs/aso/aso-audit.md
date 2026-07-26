# ASO Audit — Operax Mobile (pré-lançamento)

**Data:** 2026-07-25  
**Platforms:** iOS + Android  
**Country:** BR (pt-BR)  
**Skills:** `aso-audit`, `keyword-research`, `metadata-optimization`, `android-aso`, `screenshot-optimization`, `app-launch`, `app-rejection-recovery`  
**Context:** `app-marketing-context.md`

> App ainda **não publicado**. Scores refletem prontidão da listagem/assets, não rankings reais.

## Overall ASO Score: **3.4 / 10** (pré-loja)

| Fator | Peso | Nota | Comentário |
|-------|------|------|------------|
| Title | 20% | 5 | Brand só; falta keyword primária |
| Subtitle (iOS) | 15% | 0 | Não definido |
| Keyword field (iOS) | 15% | 0 | Não definido |
| Description | 10%* | 2 | Não há texto de loja versionado |
| Screenshots | 15% | 3 | Capturas internas OK; falta creative de loja (caption + frame) |
| Preview video | 5% | 0 | Ausente |
| Ratings & reviews | 15% | n/a→0 | Pré-lançamento |
| Icon | 5% | 7 | Mark Operax existe; validar @1024 e legibilidade 60px |
| Keyword rankings | 10% | 0 | Não indexado ainda |

\* Peso médio iOS/Android para descrição.

### Interpretação

Para B2B com login de tenant, o score de “crescimento consumer” importa menos que **aprovação limpa + busca brand + screenshots honestos**. Prioridade: fechar gaps de Review (privacidade, usage strings, EAS, demo account) e publicar metadados brand-first.

---

## Keyword strategy (pt-BR — pesquisa qualitativa)

| Keyword | Volume* | Diff* | Relevance | Uso |
|---------|---------|-------|-----------|-----|
| operax | médio brand | baixa | 10 | Title |
| atendimento | alto | alta | 9 | Title/subtitle |
| fila atendimento | médio | média | 9 | Subtitle / keywords |
| CRM | alto | alta | 7 | Keywords / Play desc |
| whatsapp atendimento | alto | alta | 8 | Keywords (cuidado trademark em creatives) |
| recepção | médio | média | 7 | Keywords |
| posse conversa | baixo | baixa | 6 | Long-tail desc |
| clínica atendimento | médio | média | 7 | Play full desc |

\* Estimativa qualitativa (sem Appeeky/Sensor Tower neste ambiente).

---

## Prioritized action plan

### P0 — Bloqueia submit (esta semana)

1. Usage descriptions iOS (câmera/fotos/mic/docs) + Privacy Policy URL live  
2. App Privacy / Data Safety alinhados ao app (SecureStore, push, fotos)  
3. EAS `projectId` real + builds de produção  
4. Conta demo para App Review + notas de revisão (sessão exclusiva)  
5. Screenshots de loja (mín. 3 iPhone 6.7", 2–4 Play) com UI real

### P1 — Listagem conversível

6. Metadados pt-BR (ver `metadata-pt-BR.md`)  
7. Feature graphic Android 1024×500  
8. Ícone 1024×1024 sem texto  
9. Short/full description Play com keywords naturais

### P2 — Pós-aprovação

10. Preview video 15–30s  
11. Prompt de rating após atendimento bem-sucedido  
12. Localização en-US  
13. ASO audit com IDs reais e rankings

---

## Store Review risk (pré-rejeição)

| Risco | Guideline / Policy | Mitigação |
|-------|-------------------|-----------|
| App “login wall” sem demo | Apple 2.1 | Conta demo + walkthrough na Review Notes |
| Sem privacy policy | 5.1.1 / Play Data Safety | URL pública específica do app |
| Usage strings genéricas/ausentes | 5.1.1 | Strings WHY no Info.plist |
| Screenshots ≠ binary | 2.3.x | Usar builds recentes, sem UI mock inventada |
| Push sem justificativa | 4.5 / Play notif | Declarar e explicar posse/fila |
| EAS projectId placeholder | build fail | Substituir UUID real |

---

## Próximo passo

Executar checklist `store-readiness-checklist.md` item a item até todos P0 verdes antes do primeiro upload.
