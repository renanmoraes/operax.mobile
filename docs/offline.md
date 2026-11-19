# Online e offline

## Regra

- **Equipe: tudo online** (ADR 003). Sem internet, a equipe não acessa.
- **Cliente (aluno): o que já foi baixado funciona sem internet.** O app baixa sozinho os treinos dos próximos dias e guarda a última versão do que o aluno viu (agenda, histórico, evolução). Resultado feito sem internet fica guardado e sobe quando ela volta.

## Limite do que se baixa (adotado)

| Item | Valor | Por quê |
|---|---|---|
| Dias à frente | **14** | cobre uma viagem de duas semanas (o técnico adianta as aulas) |
| Fichas baixadas | **40** | 14 dias com até 2–3 fichas por dia |
| Tamanho | **3 MB** de texto | a ficha é só texto (~5–30 KB); sobra folga para celular simples |
| Passou do limite | sai o dia **mais distante** primeiro | o que está perto de acontecer tem prioridade |
| Vídeos e fotos dos exercícios | **não baixam** | são pesados; o treino abre e executa, só o vídeo pede internet |

Constantes em `src/features/fitness/offlineStore.ts` (`HORIZON_DAYS`, `MAX_WORKOUTS`, `MAX_BYTES`).

## Como funciona

1. **Baixar** (`offlineSync.ts`): ao abrir o app, ao voltar para o primeiro plano, quando a internet volta e a cada minuto com o app na frente, o app chama `syncOfflineWorkouts`. No máximo uma vez a cada 30 min (ou logo após subir resultados). Pula o que já foi feito.
2. **Ler sem internet**: `fitnessApi.ts` tenta o servidor; se **não houver resposta** (sem rede, tempo esgotado) usa o que está guardado. Erro do servidor (4xx/5xx) nunca cai no guardado. Leituras com cópia: ficha, treinos do dia, semana, histórico, evolução, avaliações, home/agenda, empresas.
3. **Executar e guardar**: o resultado vai para a fila (`resultsQueue.ts`, banco SQLite do aparelho, por conta). Treino já salvo na fila libera o rascunho.
4. **Subir**: `flushAll` envia em ordem com a mesma `idempotency_key` (o servidor não duplica; 4xx de recusa descarta; 401/408/425/429/5xx/sem rede ficam para depois).
5. **Limpar**: quando o servidor confirma um resultado (`recordResult`), `confirmDone` marca `ficha:dia` como feito e remove a ficha do celular. A limpeza **nunca apaga** ficha com resultado na fila nem treino terminado ainda na tela de conclusão, e o download **nunca baixa de novo** um treino já feito (enviado ou ainda na fila). As marcas de "feito" duram 45 dias.
6. **Aviso** (`OfflineBar.tsx`): faixa no topo das telas do aluno: "Sem internet" e/ou "N treinos esperando internet para enviar". Some sozinha.

## Mapa tela a tela (aluno)

| Tela | Sem internet |
|---|---|
| Início | ok com a última agenda/semana vistas; chat sem atualizar |
| Agenda e detalhe da aula/compromisso | ok com a última agenda baixada (cópia de `me/home`); confirmar/cancelar precisa de internet |
| Treino (aba) | ok: semana vista ou montada com as fichas baixadas; dias futuros abrem |
| Ficha do treino, sessão de séries, gravação, registrar resultado | **ok** com a ficha baixada; salva na fila |
| Conclusão do treino | ok; histórico/recordes vêm da cópia; salva na fila |
| Treinar agora / treino livre (GPS) | ok; mapa base precisa de internet (o caminho é desenhado); salva na fila |
| Histórico, Evolução, Conquistas | ok com a última cópia (Conquistas: só o que já estava na memória) |
| Detalhe do exercício | texto ok; **vídeo/foto precisa de internet** (aviso na tela) |
| Chat, ingressos, relógios/Saúde, compartilhar | precisam de internet |

## Testes

- `src/features/fitness/__tests__/offlineStore.test.ts`: limite, limpeza, não baixar o que foi feito.
- `src/features/fitness/__tests__/offlineFlow.test.ts`: baixa → rede cai → abre ficha futura → executa → fila → rede volta → sobe uma vez só → ficha feita sai e a futura fica.
