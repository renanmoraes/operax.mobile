# Execução de treino: clareza de estado, navegação sequencial e tempo ativo/descanso

Data: 16/11/2026. Status: aprovado pelo usuário; revisado (v2) para fechar pontos que a revisão automática
apontou como ambíguos para o plano.

## O cenário

Hoje a tela de execução (`app/cliente/treino/sessao/[id].tsx`) tem três problemas de usabilidade e um problema de dado:

1. **Pouca clareza de estado.** Treinando, descansando e esperando pra começar o próximo exercício se parecem
   demais visualmente.
2. **Navegação livre entre exercícios.** Tocar num exercício na lista ("Ver treino") ou nos segmentos do topo
   troca o exercício ativo na hora (`goTo(i)`), mesmo que o atual não tenha terminado — dá pra começar a
   registrar séries de um exercício sem nunca fechar o anterior.
3. **Progresso que mente.** O preenchimento de cada segmento do topo usa `i < idx ? 1 : ...`: qualquer exercício
   "antes" do índice atual aparece 100% feito mesmo que tenha sido pulado ou ficado pela metade
   (`app/cliente/treino/sessao/[id].tsx:251`).
4. **Sem distinção entre treinar e descansar/trocar de estação, para fins de relatório.** O relógio de treino
   (`clock`) só para no pausar manual; o tempo entre terminar um exercício e começar o próximo (ir no banheiro,
   esperar um equipamento) conta como se fosse treino ativo. Não há como separar isso depois para um relatório
   de performance (tempo ativo x descanso x calorias).

A ficha do treino (`app/cliente/treino/[id].tsx`) também não diferencia "nunca comecei" de "já estou treinando":
o botão é sempre "Começar treino" e a lista de exercícios não mostra status nenhum.

## Modelo de estado por exercício

Cada linha de `flattenWorkout` (um `ExerciseRow`) ganha um status derivado das séries já logadas, calculado a
partir de `logs[i]` — não precisa de campo novo no tipo, é uma função pura:

| Status | Condição | Resumível depois? |
| --- | --- | --- |
| `pending` | não é o `idx` atual e `logs[i].length === 0` | sim, normalmente (vira `active` quando chegar a vez) |
| `active` | é o `idx` atual da sessão | — |
| `done` | `logs[i].length >= sets.length` | não precisa |
| `incomplete` | não é o `idx` atual e `0 < logs[i].length < sets.length` | sim, pelo fluxo de prévia |

Não existe status `skipped` separado: pular um exercício sem logar nenhuma série (pelo botão "Pular" ou
indo direto pra outro pela prévia) deixa ele como `pending` de novo — não há nada pra "lembrar" além do que
`logs` já guarda, então não precisa de array novo pra isso (resolve a dúvida do review sobre migração de um
campo `visited`: ele não existe).

### Tempo ativo x descanso (fundação do relatório)

O draft (`SessionDraft` em `src/features/fitness/sessionStore.ts`) ganha dois acumuladores por exercício,
paralelos a `logs`:

```ts
export type SessionDraft = {
  workoutId: string;
  idx: number;
  logs: SetLog[][];
  elapsed: number;
  started: boolean[];      // novo — true depois que tocou "Iniciar exercício" para aquele índice
  activeSeconds: number[]; // novo — por exercício, só conta depois do toque em "Iniciar exercício"
  restSeconds: number[];   // novo — por exercício: descanso entre séries + transição até o "Iniciar"
};
```

`started[i]` não serve pro status (isso é só `logs`, ver tabela acima) — ele serve só pra decidir qual relógio
está correndo para o `idx` atual, inclusive ao reabrir o app (ver "Retomar o draft" abaixo). Regra única, sem
exceção: `started[i]` vira `false` toda vez que o `idx` sai de `i` (seja terminando o exercício, pulando, ou
trocando pela prévia). Então **toda troca de exercício sempre passa pelo estado 4** de novo, mesmo que aquele
exercício já tivesse sido iniciado antes (um `incomplete` retomado também exige o toque em "Iniciar
exercício") — o único jeito de pular o estado 4 é reabrir o app **sem** o `idx` ter mudado (ver "Retomar o
draft").

Regra de contagem, reaproveitando o relógio de parede que já existe (`wallClock`, `clock.since`/`base`): em
todo momento, exatamente **um** acumulador está "ligado" (recebendo o tempo que passa), e cada evento abaixo
troca qual é esse acumulador — igual ao `clock.since`/`base` de hoje, só que agora pode apontar pra
`restSeconds[i]` ou `activeSeconds[i]` de um índice `i` específico, não só um relógio único:

- **Exercício `idx` em `pending`, tela "Pronto pra começar" (estado 4) ou o anel/cronômetro de transição
  (estado 3):** o acumulador ligado é `restSeconds[idx]`. É o estado inicial de qualquer exercício, inclusive
  o primeiro do treino (que também abre em "Pronto pra começar", item 1).
- **Toque em "Iniciar exercício":** `started[idx] = true`, e o acumulador ligado passa a ser
  `activeSeconds[idx]`.
- **Descanso entre séries do mesmo exercício já iniciado** (como já funciona hoje, `startRest`): o acumulador
  ligado volta a ser `restSeconds[idx]` enquanto o anel conta, e volta pra `activeSeconds[idx]` assim que a
  próxima série é registrada (ou o descanso é pulado).
- **Transição para o próximo exercício** (depois da última série de um exercício, ver "Estado 3" abaixo): o
  `idx` já avança para o próximo exercício (chamemos de B) assim que a última série do atual (A) é registrada
  — a tela de transição já mostra nome/prescrição de B. Por isso o acumulador ligado durante o anel/cronômetro
  de transição é `restSeconds[idx]` **de B**, não de A: é o tempo de preparação pra B, mesmo que a duração
  mostrada no anel venha do descanso programado de A. Isso vale também quando a troca acontece pela prévia
  ("Finalizar e vir para cá") ou pelo "Pular" do rodapé — o `idx` muda na hora do toque, e o acumulador segue
  o `idx` novo.
- **Pausar (`togglePause`)** congela o acumulador que estiver ligado no momento, igual já acontece hoje com
  `clock`/`restUntil` — só estende a mesma lógica pros acumuladores por índice.

### Retomar o draft (reabrir o app, ou voltar pela ficha com "Continuar treino")

Ao carregar o draft (`loadDraft`), o `idx` salvo é restaurado e a tela decide o que mostrar olhando só
`started[idx]`:

- `started[idx] === false` → mostra o estado 4 ("Pronto pra começar"), com o acumulador `restSeconds[idx]`
  ligado a partir de agora (o tempo que passou com o app fechado conta como descanso/transição — coerente
  com o item 8, já que o aluno não tocou "Iniciar").
- `started[idx] === true` → mostra o estado 1 ("Treinando"), pronto pra próxima série, com
  `activeSeconds[idx]` ligado a partir de agora. Um descanso entre séries que estava rodando no fechamento do
  app não é retomado em contagem regressiva (como já é hoje — `restUntil` não é persistido); o aluno só vê o
  passo seguinte liberado. Fica fora do escopo melhorar essa lacuna específica, que já existe hoje.
- Drafts salvos antes dessa mudança não têm `started`/`activeSeconds`/`restSeconds`: tratar como
  `started = logs.map(l => l.length > 0)` (se já tinha série feita, considera iniciado) e os dois arrays de
  segundos como zero — o treino continua de onde parou, só sem retroativo de tempo ativo/descanso.

Isso é só a fundação: a tela de conclusão (`concluido.tsx`) ganha um resumo simples (ativo total x descanso
total, somando os dois arrays), sem criar tela de relatório nova agora.

## Tela de execução — estados visuais (item 1)

Quatro visuais distintos, reaproveitando o `ProgressRing` que já existe:

1. **Treinando** (como hoje): fundo/crachá azul "TREINANDO", relógio grande do treino.
2. **Descansando entre séries** (como hoje, sem mudança): anel laranja regressivo com os segundos do
   `rest_seconds` da série, botão "Pular descanso".
3. **Descansando/trocando de exercício** (novo, só existe quando ainda há um próximo exercício — ver nota
   sobre o último exercício abaixo): ao registrar a última série de um exercício (A), o `idx` avança na hora
   para o próximo (B) e a tela mostra o anel laranja ou o cronômetro crescente, conforme o descanso
   **explicitamente definido no último set de A** (`A.sets[A.sets.length - 1]?.rest`, o campo opcional que
   `flatten.ts` só preenche quando a API manda `rest_seconds` naquele set — **não** usar `row.restSeconds`,
   que tem um padrão de 60s embutido em `flatten.ts` e por isso nunca reflete "sem descanso programado"):
   - `rest` é um número `> 0`: anel regressivo com esse tanto de segundos, botão "Pular descanso".
   - `rest` é `undefined` ou `0`: cronômetro **crescendo** (0, 1, 2…) no lugar do anel, sem meta, sem "Pular
     descanso" (não tem o que pular).
   O cartão mostra "✓ {nome de A} concluído · volume" + nome/prescrição de B embutido.
4. **Pronto pra começar** (novo, substitui o antigo card "Próximo: Nome do exercício" com toque manual): crachá
   neutro "PRONTO PRA COMEÇAR", nome/prescrição do exercício B, botão primário **"Iniciar exercício"**.
   Chega-se aqui automaticamente quando o anel do estado 3 zera, quando não há descanso programado, ou ao tocar
   "Pular descanso". Fica parado até o toque — esse é o evento que liga `activeSeconds` (item 8). Vale também
   para o primeiro exercício do treino (hoje o treino já "começa treinando" ao abrir a sessão; passa a abrir
   nesse estado, exigindo o toque inicial).

O ponto de entrada no código de hoje é `completeSet` (`app/cliente/treino/sessao/[id].tsx:194-210`): a função
que decide "ainda tem série, chama `startRest`" vs "exercício acabou" é onde o estado 3/4 entra no lugar do
card `exDone` atual (`app/cliente/treino/sessao/[id].tsx:332-341`).

**Último exercício do treino:** ao registrar a última série dele, não há um B para transicionar — os estados
3 e 4 não acontecem, e a tela vai direto pra tela de resumo/"Finalizar treino" que já existe hoje (sem
mudança nesse trecho).

Removida a ideia de um botão com preenchimento automático temporizado: o anel/cronômetro do estado 3 já cobre
a sensação de "o treino está me levando pro próximo", e o toque explícito do estado 4 é inegociável (item 8).

Pausar / Pular / Encerrar (o `ActionRow` do rodapé) ficam visíveis e funcionando nos quatro estados, inclusive
na prévia (abaixo). "Pular" e o "próximo" automático (depois da última série) sempre vão para o **próximo
exercício ainda não `done` na ordem do treino, procurando só pra frente a partir do `idx` atual** (sem dar a
volta pros de trás) — não necessariamente `idx + 1`, que pode já estar `done` se o aluno terminou ele antes
pela prévia. Um `incomplete` conta como "não `done`" pra essa busca (entra na lista de próximos). Se não
sobrar nenhum exercício não-`done` daí pra frente, é tratado como se fosse o último (vai direto pro
resumo/"Finalizar treino", sem estados 3/4) — mesmo que exista algum `pending`/`incomplete` antes do `idx`
atual (ficou pra trás por ter sido pulado via prévia); esses só voltam a ser alcançáveis pela prévia
("Ver treino" → "Finalizar e vir para cá"), nunca pelo fluxo automático.

## Navegação sequencial (itens 2, 4, 6)

Tocar num exercício diferente do ativo — pela lista do `BottomSheet` ("Ver treino") ou pelos segmentos do
topo — **não troca mais o `idx` direto**. Abre uma **prévia somente leitura** daquele exercício, dentro da
mesma tela de sessão (um sub-estado, não uma rota nova):

- Mostra nome, mídia/thumb, prescrição, histórico de carga — igual ao cabeçalho de hoje, sem steppers, sem
  pills de série, sem botão de completar série.
- Mostra o status dele (concluído com volume / incompleto com X de Y séries / pendente).
- Se o exercício em preview já está **`done`**: não existe o que "finalizar e vir para cá" fazer (não dá pra
  retomar séries de um exercício já fechado nessa versão — ver "Fora do escopo"), então só mostra o resumo
  (volume, séries) e o botão "Voltar ao treino". Não troca o `idx`.
- Se o exercício em preview está **`pending` ou `incomplete`**, mostra o botão primário
  **"Finalizar e vir para cá"**:
  - Se o exercício ativo (`idx` atual) já está `done`, só troca o `idx` para o escolhido.
  - Se o ativo tem séries pendentes, deixa como está (fica `incomplete`, sem apagar o que já foi logado — o
    status é sempre recalculado de `logs`, não precisa de ação explícita de "marcar") e troca o `idx` para o
    escolhido.
  - O exercício escolhido vira o novo `idx` e cai no estado 4 "Pronto pra começar" — sempre, mesmo que seja
    um `incomplete` que já tinha sido iniciado antes (regra única da seção anterior: trocar de exercício
    sempre reseta `started` para `false`; só reabrir o app no mesmo `idx` pula direto pro estado 1).
- Botão secundário "Voltar ao treino" fecha a prévia e volta pro exercício ativo, sem mudar nada (cobre o
  item 6 — espiar o próximo exercício numa pausa e voltar).

Um exercício `incomplete` pode ser reaberto depois pelo mesmo caminho (prévia dele → "Finalizar e vir para
cá"), continuando do número de séries já feitas (`nextPrescription` já faz isso). Depois de terminá-lo (ou de
sair dele de novo), o "próximo" (automático ou pelo botão "Pular") segue a regra acima — vai para o próximo
não-`done` na ordem do treino, não necessariamente para onde ele estava antes de ser interrompido.

## Progresso real (item 5)

Dois ajustes em `app/cliente/treino/sessao/[id].tsx`:

- `frac` de cada segmento do topo passa a ser sempre `(logs[i]?.length ?? 0) / r.sets.length` (capado em 1),
  removendo o caso especial `i < idx ? 1`. Um exercício pulado ou incompleto nunca aparece cheio.
- O texto "Exercício X de Y" ganha a contagem real: "Exercício {idx+1} de {total} · {concluídos} concluídos",
  usando a mesma contagem de `done`/`incomplete` que alimenta a ficha.

## Ficha do treino (itens 3, 6) — já validado com mockup

`app/cliente/treino/[id].tsx` passa a carregar o draft da sessão (`loadDraft(workout.id)`, já existe em
`sessionStore.ts`) para decidir o que mostrar:

- **Sem draft (nunca começou hoje):** como é hoje — "Começar treino".
- **Com draft (treino em andamento):** `HeroCard` muda para um estilo "ao vivo" (ponto vermelho + "EM
  ANDAMENTO" + tempo decorrido do `elapsed`), com a barra de progresso real (mesma conta do item 5) e o botão
  do rodapé vira **"Continuar treino"**.
- Cada linha de exercício na lista de força ganha um indicador de status (✓ concluído / "AGORA" em destaque /
  incompleto com aviso / sem marca = pendente), reaproveitando a mesma função de status do modelo acima.

## Tela de conclusão (item 8, resumo)

`app/cliente/treino/concluido.tsx` ganha uma linha de resumo simples (ex.: "42 min ativo · 9 min de
descanso"), somando `activeSeconds`/`restSeconds` do `FinishedSession` (que herda de `SessionDraft`, então os
dois arrays novos já viajam de graça). Sem gráfico novo, sem tela de relatório — só a fundação pedida.

## Fora do escopo

- Reabrir/editar séries de um exercício já `done` pela prévia — a prévia de um `done` é só leitura (resumo),
  sem ação de voltar a logar série nele.
- Tela/relatório dedicado de performance (calorias, histórico de ativo x descanso ao longo do tempo).
- Mudar o formato enviado ao backend (`buildResultBodies`/`RecordResultBody`) — os novos campos ficam só no
  draft local, por enquanto.
- Qualquer mudança em treinos sem exercício de força (`NoSetsSession`).

## Nota sobre o relógio "TREINANDO" (estado 1)

O número grande continua sendo o `elapsed` do treino todo (igual a hoje — tempo total desde o início, ativo
+ descanso somados), não o `activeSeconds` do exercício atual. `activeSeconds`/`restSeconds` por exercício são
dados novos, paralelos, usados só no resumo da tela de conclusão (e numa futura tela de relatório) — não
substituem o relógio grande que o aluno já conhece.

## Testes

O projeto não tem infraestrutura de teste de componente de tela hoje (`npm run test:unit` roda só `src/`, sem
`@testing-library/react-native`), então a lógica nova vai para funções puras em `src/features/fitness/`
(ao lado de `flatten.ts`), testáveis sem renderizar tela — a tela só as chama:

- Status do exercício (`pending/active/done/incomplete`) e "próximo índice não-`done` a partir de X": testes
  unitários puros a partir de combinações de `logs`/`idx`.
- Descanso de transição: função pura que decide anel-com-segundos vs. cronômetro-crescente a partir do `rest`
  do último set de um `ExerciseRow`, testada para `rest` ausente, `0` e um número positivo.
- `sessionStore.ts`: round-trip do draft com os campos novos (`started`, `activeSeconds`, `restSeconds`),
  compatível com drafts antigos salvos sem esses campos (migração: `started = logs.map(l => l.length > 0)`,
  os dois arrays de segundos como zero).
- Comportamento de tela (anel entre exercícios, prévia + "Finalizar e vir para cá", "Pular" pulando um já
  `done`, bloqueio do primeiro exercício em "Pronto pra começar") verificado manualmente no app rodando
  (`npx expo start --web`), não por teste de componente.
