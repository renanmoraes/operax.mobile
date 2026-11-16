# Execução de treino: clareza de estado, navegação sequencial e tempo ativo/descanso

Data: 16/11/2026. Status: aprovado pelo usuário, pronto para virar plano de implementação.

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
| `pending` | `logs[i].length === 0` e nunca foi o `idx` ativo | — (ainda nem começou) |
| `active` | é o `idx` atual da sessão | — |
| `done` | `logs[i].length >= sets.length` | não precisa |
| `incomplete` | já foi ativo, saiu antes de terminar, `0 < logs[i].length < sets.length` | sim, pelo fluxo de prévia |
| `skipped` | já foi ativo, saiu sem logar nenhuma série, `logs[i].length === 0` mas já passou por ele | sim, pelo fluxo de prévia |

`incomplete` e `skipped` são tratados igual na prática (mesma cor/aviso, rótulo diferente só por
`logs[i].length`); não precisam de enum próprio, só de saber "já foi visitado e não terminou" — basta guardar
no draft o **conjunto de índices já visitados** (`visited: number[]` ou `Set<number>` serializado como array).

### Tempo ativo x descanso (fundação do relatório)

O draft (`SessionDraft` em `src/features/fitness/sessionStore.ts`) ganha dois acumuladores por exercício,
paralelos a `logs`:

```ts
export type SessionDraft = {
  workoutId: string;
  idx: number;
  logs: SetLog[][];
  elapsed: number;
  visited: number[];       // novo — índices que já foram ativos alguma vez
  activeSeconds: number[]; // novo — por exercício, só conta depois do toque em "Iniciar exercício"
  restSeconds: number[];   // novo — por exercício: descanso entre séries + transição até o "Iniciar"
};
```

Regra de contagem, reaproveitando o relógio de parede que já existe (`wallClock`, `clock.since`/`base`):

- **Enquanto o exercício está `pending` esperando o toque em "Iniciar exercício"** (tela nova, ver abaixo): o
  tempo correndo vai para `restSeconds[idx]` daquele exercício (é transição/descanso, mesmo que não tenha
  descanso programado).
- **Depois do toque em "Iniciar exercício"**: o tempo passa a correr em `activeSeconds[idx]`, igual ao
  `clock` de hoje.
- **Descanso entre séries do mesmo exercício** (como já funciona hoje, `startRest`): vai para
  `restSeconds[idx]`.
- **Pausar (`togglePause`)** congela o que estiver correndo no momento (ativo ou descanso), igual já acontece
  hoje com `clock`/`restUntil` — só estende a mesma lógica para os dois novos acumuladores.

Isso é só a fundação: a tela de conclusão (`concluido.tsx`) ganha um resumo simples (ativo total x descanso
total, somando os dois arrays), sem criar tela de relatório nova agora.

## Tela de execução — estados visuais (item 1)

Quatro visuais distintos, reaproveitando o `ProgressRing` que já existe:

1. **Treinando** (como hoje): fundo/crachá azul "TREINANDO", relógio grande do treino.
2. **Descansando entre séries** (como hoje, sem mudança): anel laranja regressivo com os segundos do
   `rest_seconds` da série, botão "Pular descanso".
3. **Descansando/trocando de exercício** (novo): mesmo anel laranja, mas usa o descanso programado do
   **último set do exercício que terminou** (`row.sets[row.sets.length - 1].rest ?? row.restSeconds`) — hoje
   esse valor existe no dado mas é ignorado na troca de exercício (`completeSet` só chama `startRest` quando
   `doneCount < row.sets.length`). O cartão mostra "✓ concluído · volume" + nome do próximo embutido.
   **Se não há descanso programado** (valor 0/ausente), mostra um cronômetro **crescendo** (0, 1, 2…) no lugar
   do anel, só para registrar quanto tempo passou — sem meta, sem "Pular descanso" (não tem o que pular).
4. **Pronto pra começar** (novo, substitui o antigo card "Próximo: Nome do exercício" com toque manual): crachá
   neutro "PRONTO PRA COMEÇAR", nome/prescrição do próximo exercício, botão primário **"Iniciar exercício"**.
   Chega-se aqui automaticamente quando o anel do estado 3 zera, quando não há descanso programado, ou ao tocar
   "Pular descanso". Fica parado até o toque — esse é o evento que liga `activeSeconds` (item 8). Vale também
   para o primeiro exercício do treino (hoje o treino já "começa treinando" ao abrir a sessão; passa a abrir
   nesse estado, exigindo o toque inicial).

Removida a ideia de um botão com preenchimento automático temporizado: o anel/cronômetro do estado 3 já cobre
a sensação de "o treino está me levando pro próximo", e o toque explícito do estado 4 é inegociável (item 8).

Pausar / Pular / Encerrar (o `ActionRow` do rodapé) ficam visíveis e funcionando nos quatro estados, inclusive
na prévia (abaixo). "Pular" sempre avança um exercício por vez a partir do `idx` atual.

## Navegação sequencial (itens 2, 4, 6)

Tocar num exercício diferente do ativo — pela lista do `BottomSheet` ("Ver treino") ou pelos segmentos do
topo — **não troca mais o `idx` direto**. Abre uma **prévia somente leitura** daquele exercício, dentro da
mesma tela de sessão (um sub-estado, não uma rota nova):

- Mostra nome, mídia/thumb, prescrição, histórico de carga — igual ao cabeçalho de hoje, sem steppers, sem
  pills de série, sem botão de completar série.
- Mostra o status dele (concluído / incompleto com X de Y séries / pendente).
- Botão primário **"Finalizar e vir para cá"**:
  - Se o exercício ativo já está `done`, só troca o `idx` para o escolhido.
  - Se o ativo tem séries pendentes, marca ele como `incomplete`/`skipped` (sem apagar o que já foi logado) e
    troca o `idx`.
  - O exercício escolhido entra como `pending`, caindo no estado "Pronto pra começar" (item 8 se aplica —
    precisa do toque em "Iniciar exercício", não resume direto nas séries).
- Botão secundário "Voltar ao treino" fecha a prévia e volta pro exercício ativo, sem mudar nada (cobre o
  item 6 — espiar o próximo exercício numa pausa e voltar).

Um exercício `incomplete`/`skipped` pode ser reaberto depois pelo mesmo caminho (prévia dele →
"Finalizar e vir para cá"), continuando do número de séries já feitas (`nextPrescription` já faz isso).

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

- Tela/relatório dedicado de performance (calorias, histórico de ativo x descanso ao longo do tempo).
- Mudar o formato enviado ao backend (`buildResultBodies`/`RecordResultBody`) — os novos campos ficam só no
  draft local, por enquanto.
- Qualquer mudança em treinos sem exercício de força (`NoSetsSession`).

## Testes

- `flatten.ts`/lógica de status: testes unitários puros para `pending/active/done/incomplete/skipped` a partir
  de combinações de `logs`/`visited`.
- `sessionStore.ts`: round-trip do draft com os campos novos (`visited`, `activeSeconds`, `restSeconds`),
  compatível com drafts antigos salvos sem esses campos (tratar `undefined` como array de zeros).
- Fluxo de sessão: teste de componente cobrindo — pular descanso sem meta (cronômetro crescente), prévia +
  "Finalizar e vir para cá" marcando o anterior como incompleto, segmento do topo não fica cheio para
  exercício pulado.
