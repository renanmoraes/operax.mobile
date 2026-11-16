# Execução de treino: clareza de estado, navegação sequencial e tempo ativo/descanso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o fluxo da sessão de treino (`app/cliente/treino/sessao/[id].tsx`) para deixar claro quando
o aluno está treinando, descansando ou esperando pra começar o próximo exercício; travar a navegação livre
entre exercícios (vira prévia + "Finalizar e vir para cá"); corrigir o progresso pra refletir séries feitas,
não posição; e capturar tempo ativo x descanso por exercício como fundação de relatório, refletido na ficha e
na tela de conclusão.

**Architecture:** Extrai a lógica pura (status de exercício, próximo não concluído, tipo de descanso de
transição) para `src/features/fitness/sessionStatus.ts`, testável sem renderizar tela. O draft local
(`sessionStore.ts`) ganha três arrays novos por exercício (`started`, `activeSeconds`, `restSeconds`),
migrados automaticamente na leitura. A tela de sessão passa a ter, além do relógio de parede que já existe, um
"bucket" (qual acumulador — ativo ou descanso — está ligado agora) que troca a cada evento (toque em "Iniciar
exercício", início/fim de descanso, troca de exercício, pausa). Ficha e conclusão só leem esses dados; não
mudam o formato enviado ao backend.

**Tech Stack:** React Native + Expo Router, TypeScript, Jest (`jest-expo`), i18next (pt/en/es), o design
system existente em `src/design-system/`.

**Spec de referência:** `docs/superpowers/specs/2026-11-16-execucao-treino-design.md` (leia antes de começar —
todas as regras de negócio citadas aqui vêm de lá; em caso de dúvida durante a implementação, a spec manda).

---

## Antes de começar

Leia a spec inteira (link acima) e os arquivos que vai mexer:
`app/cliente/treino/sessao/[id].tsx`, `app/cliente/treino/[id].tsx`, `app/cliente/treino/concluido.tsx`,
`src/features/fitness/sessionStore.ts`, `src/features/fitness/flatten.ts`.

## File Structure

| Arquivo | O que muda |
| --- | --- |
| `src/features/fitness/sessionStatus.ts` | **Novo.** Funções puras: status do exercício, próximo índice não concluído, tipo de descanso de transição. |
| `src/features/fitness/__tests__/sessionStatus.test.ts` | **Novo.** Testes das funções acima. |
| `src/features/fitness/sessionStore.ts` | `SessionDraft` ganha `started`/`activeSeconds`/`restSeconds`; `loadDraft`/`loadFinishedSession` migram drafts antigos. |
| `src/features/fitness/__tests__/sessionStore.test.ts` | Testes da migração + round-trip dos campos novos. |
| `src/i18n/locales/{pt,en,es}/fitness.ts` | Chaves novas em `session`, `sheet`, `done`. |
| `app/cliente/treino/sessao/[id].tsx` | Núcleo: acumuladores por exercício, estados visuais 3/4, prévia somente leitura, progresso real. |
| `app/cliente/treino/[id].tsx` | Card "em andamento", botão "Continuar treino", status por exercício. |
| `app/cliente/treino/concluido.tsx` | Linha de resumo ativo x descanso. |

---

## Task 1: `sessionStatus.ts` — lógica pura de status e próximo exercício

**Files:**
- Create: `src/features/fitness/sessionStatus.ts`
- Test: `src/features/fitness/__tests__/sessionStatus.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// src/features/fitness/__tests__/sessionStatus.test.ts
import { flattenWorkout } from '../flatten';
import { WORKOUTS } from '../mockData';
import { exerciseStatus, nextOpenIndex, transitionRest } from '../sessionStatus';

const rows = flattenWorkout(WORKOUTS[0]); // 7 linhas; rows[6] é o drop set (3 estágios x 3 rodadas = 9 sets)

describe('exerciseStatus', () => {
  it('é "active" quando é o índice atual, mesmo sem nenhuma série feita', () => {
    expect(exerciseStatus(rows[0], [], true)).toBe('active');
  });

  it('é "pending" sem nenhuma série e não é o atual', () => {
    expect(exerciseStatus(rows[0], [], false)).toBe('pending');
  });

  it('é "incomplete" com série feita mas não todas, e não é o atual', () => {
    expect(exerciseStatus(rows[0], [{ kg: 40, reps: 10 }], false)).toBe('incomplete');
  });

  it('é "done" com todas as séries feitas', () => {
    const done = rows[0].sets.map((s) => ({ kg: s.kg, reps: s.reps }));
    expect(exerciseStatus(rows[0], done, false)).toBe('done');
  });
});

describe('nextOpenIndex', () => {
  const emptyLogs = rows.map(() => []);

  it('acha o próximo índice sem todas as séries, só pra frente', () => {
    expect(nextOpenIndex(rows, emptyLogs, 0)).toBe(1);
  });

  it('pula um exercício já "done" no meio do caminho', () => {
    const logs = rows.map((r, i) => (i === 1 ? r.sets.map((s) => ({ kg: s.kg, reps: s.reps })) : []));
    expect(nextOpenIndex(rows, logs, 0)).toBe(2);
  });

  it('não dá a volta: um "pending" antes do índice atual não conta', () => {
    const logs = rows.map((r, i) => (i < 5 ? r.sets.map((s) => ({ kg: s.kg, reps: s.reps })) : []));
    // exercício 1 ficou pendente (índice 1), mas a busca a partir de 5 não olha pra trás
    expect(nextOpenIndex(rows, logs, 5)).toBe(6);
  });

  it('retorna -1 quando não sobra nenhum não concluído dali pra frente', () => {
    const logs = rows.map((r) => r.sets.map((s) => ({ kg: s.kg, reps: s.reps })));
    expect(nextOpenIndex(rows, logs, 3)).toBe(-1);
  });
});

describe('transitionRest', () => {
  it('anel regressivo quando o último set do exercício tem descanso > 0', () => {
    expect(transitionRest(rows[0])).toEqual({ kind: 'ring', seconds: rows[0].sets[rows[0].sets.length - 1].rest ?? rows[0].restSeconds });
  });

  it('cronômetro crescente quando o último set não tem "rest" definido', () => {
    const row = { ...rows[0], sets: rows[0].sets.map((s) => ({ ...s, rest: undefined })) };
    expect(transitionRest(row)).toEqual({ kind: 'stopwatch' });
  });

  it('cronômetro crescente quando o último set tem "rest" explicitamente 0', () => {
    const row = { ...rows[0], sets: rows[0].sets.map((s, i, arr) => (i === arr.length - 1 ? { ...s, rest: 0 } : s)) };
    expect(transitionRest(row)).toEqual({ kind: 'stopwatch' });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest sessionStatus -t "" --silent` (ou `npm run test:unit -- --testPathPattern=sessionStatus`)
Expected: FAIL — `Cannot find module '../sessionStatus'`

- [ ] **Step 3: Implementar**

```ts
// src/features/fitness/sessionStatus.ts
import type { ExerciseRow } from './flatten';
import type { SetLog } from './sessionStore';

export type ExerciseStatus = 'pending' | 'active' | 'done' | 'incomplete';

/** Status de um exercício a partir das séries já logadas — nunca guardado, sempre recalculado de `logs`. */
export function exerciseStatus(row: Pick<ExerciseRow, 'sets'>, done: SetLog[], isActive: boolean): ExerciseStatus {
  if (isActive) return 'active';
  if (done.length >= row.sets.length) return 'done';
  if (done.length > 0) return 'incomplete';
  return 'pending';
}

/**
 * Próximo índice sem todas as séries feitas, procurando só pra frente a partir de `from` (exclusive).
 * -1 se não sobrar nenhum. Nunca dá a volta pros de trás de `from` — ver spec, seção "Navegação sequencial".
 */
export function nextOpenIndex(rows: Pick<ExerciseRow, 'sets'>[], logs: SetLog[][], from: number): number {
  for (let i = from + 1; i < rows.length; i++) {
    if ((logs[i]?.length ?? 0) < rows[i].sets.length) return i;
  }
  return -1;
}

export type TransitionRest = { kind: 'ring'; seconds: number } | { kind: 'stopwatch' };

/**
 * Descanso de transição pro próximo exercício, a partir do último set do exercício que acabou de terminar.
 * Usa `sets[last].rest` (só existe quando a API manda `rest_seconds` naquele set) — nunca `row.restSeconds`,
 * que tem um padrão de 60s embutido em `flatten.ts` e por isso nunca reflete "sem descanso programado".
 */
export function transitionRest(finishedRow: Pick<ExerciseRow, 'sets'>): TransitionRest {
  const rest = finishedRow.sets[finishedRow.sets.length - 1]?.rest;
  return rest && rest > 0 ? { kind: 'ring', seconds: rest } : { kind: 'stopwatch' };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:unit -- --testPathPattern=sessionStatus`
Expected: PASS (todos os `it`)

- [ ] **Step 5: Commit**

```bash
git add src/features/fitness/sessionStatus.ts src/features/fitness/__tests__/sessionStatus.test.ts
git commit -m "feat: funções puras de status do exercício e descanso de transição"
```

---

## Task 2: `sessionStore.ts` — tempo ativo/descanso no draft, com migração

**Files:**
- Modify: `src/features/fitness/sessionStore.ts`
- Modify: `src/features/fitness/__tests__/sessionStore.test.ts`

- [ ] **Step 1: Escrever o teste de migração (falhando)**

Adicione ao arquivo de teste existente (mantém o `describe` que já tem, só acrescenta um novo):

```ts
// src/features/fitness/__tests__/sessionStore.test.ts — acrescentar no fim do arquivo
import { loadDraft, saveDraft, type SessionDraft } from '../sessionStore';

describe('migração do draft (campos de tempo ativo/descanso)', () => {
  beforeEach(() => mockStore.clear());

  it('round-trip preserva started/activeSeconds/restSeconds', async () => {
    setFitnessOwner('ana:academia');
    const draft: SessionDraft = { workoutId: 'w1', idx: 1, logs: [[], []], elapsed: 90, started: [true, false], activeSeconds: [40, 0], restSeconds: [10, 5] };
    await saveDraft(draft);
    const loaded = await loadDraft('w1');
    expect(loaded).toEqual(draft);
  });

  it('draft antigo sem os campos novos vem migrado: started pela presença de séries, segundos zerados', async () => {
    setFitnessOwner('ana:academia');
    // Simula um draft salvo por uma versão antiga do app, sem os três campos novos.
    await saveDraft({ workoutId: 'w1', idx: 0, logs: [[{ kg: 40, reps: 10 }], []], elapsed: 30 } as SessionDraft);
    const loaded = await loadDraft('w1');
    expect(loaded?.started).toEqual([true, false]);
    expect(loaded?.activeSeconds).toEqual([0, 0]);
    expect(loaded?.restSeconds).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test:unit -- --testPathPattern=sessionStore`
Expected: FAIL — `started`/`activeSeconds`/`restSeconds` ausentes do tipo `SessionDraft` (erro de tipo) ou
`undefined` no resultado.

- [ ] **Step 3: Implementar**

Em `src/features/fitness/sessionStore.ts`, troque o tipo e acrescente a migração:

```ts
export type SessionDraft = {
  workoutId: string;
  idx: number;
  logs: SetLog[][];
  elapsed: number;
  /** true depois que tocou "Iniciar exercício" para aquele índice; reseta pra false ao trocar de exercício. */
  started: boolean[];
  /** Por exercício; só conta depois do toque em "Iniciar exercício" (ver sessionStatus.ts / spec). */
  activeSeconds: number[];
  /** Por exercício: descanso entre séries + transição até o "Iniciar exercício". */
  restSeconds: number[];
};
```

Logo abaixo da definição de `SetLog`/antes de `loadDraft`, acrescente a migração:

```ts
/** Drafts salvos antes dos campos de tempo ativo/descanso não os têm — preenche com um padrão razoável. */
function migrateDraft<T extends SessionDraft>(d: T): T {
  if (d.started && d.activeSeconds && d.restSeconds) return d;
  return {
    ...d,
    started: d.started ?? d.logs.map((l) => l.length > 0),
    activeSeconds: d.activeSeconds ?? d.logs.map(() => 0),
    restSeconds: d.restSeconds ?? d.logs.map(() => 0),
  };
}
```

E aplique dentro de `loadDraft` e `loadFinishedSession` (os dois pontos onde um draft/sessão sai do
`kvGet` e pode ser de uma versão antiga do app):

```ts
export async function loadDraft(workoutId: string): Promise<SessionDraft | null> {
  const who = fitnessOwner();
  const key = draftKey(workoutId);
  if (!key) return null;
  const draft = await kvGet<SessionDraft>(key);
  return fitnessOwner() === who ? (draft ? migrateDraft(draft) : null) : null;
}
```

```ts
export async function loadFinishedSession(): Promise<FinishedSession | null> {
  const cached = mine();
  if (cached) return cached;
  const who = fitnessOwner();
  const key = finishedKey(who);
  if (!key) return null;
  const session = await kvGet<FinishedSession>(key);
  if (fitnessOwner() !== who) return null;
  const migrated = session ? migrateDraft(session) : null;
  finished = migrated ? { who, session: migrated } : null;
  return migrated;
}
```

`getFinishedSession()` (que só lê o que está em memória, `mine()`) não precisa de migração: o que entra em
memória já passou por `setFinishedSession` (escrito pela própria sessão atual, já no formato novo) ou por
`loadFinishedSession` (que acabou de migrar).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:unit -- --testPathPattern=sessionStore`
Expected: PASS, incluindo o teste antigo (`clearFinishedSession` — atualize o `session()` helper desse arquivo
pra incluir os três campos novos, senão o TypeScript recusa o literal):

```ts
// ajustar o helper já existente no topo do arquivo de teste
const session = (workoutId: string): FinishedSession => ({
  workoutId,
  idx: 0,
  logs: [],
  elapsed: 60,
  started: [],
  activeSeconds: [],
  restSeconds: [],
  finishedAt: '2026-11-15T12:00:00.000Z',
});
```

- [ ] **Step 5: `npx tsc --noEmit --noUnusedLocals` não acusa nada novo**

Run: `npx tsc --noEmit --noUnusedLocals`
Expected: sem erro em `sessionStore.ts`/seus testes (outros erros pré-existentes, se houver, não são seu
problema nesta tarefa).

- [ ] **Step 6: Commit**

```bash
git add src/features/fitness/sessionStore.ts src/features/fitness/__tests__/sessionStore.test.ts
git commit -m "feat: draft guarda tempo ativo/descanso por exercício, com migração de drafts antigos"
```

---

## Task 3: Chaves de i18n (pt/en/es)

**Files:**
- Modify: `src/i18n/locales/pt/fitness.ts`
- Modify: `src/i18n/locales/en/fitness.ts`
- Modify: `src/i18n/locales/es/fitness.ts`

- [ ] **Step 1: Acrescentar as chaves novas**

Em cada arquivo, dentro do objeto `session: { ... }` já existente, acrescente (ordem alfabética, como o resto
do arquivo já segue):

```ts
// pt — dentro de session: { ... }
badgeChanging: 'Trocando de exercício',
badgeReady: 'Pronto pra começar',
badgeResting: 'Descanso',
badgeTraining: 'Treinando',
doneCount_one: '{{count}} concluído',
doneCount_other: '{{count}} concluídos',
prevDone: '{{name}} concluído',
previewA11y: 'Prévia de {{name}}, somente leitura',
previewBack: 'Voltar ao treino',
previewFinish: 'Finalizar e vir para cá',
previewStatusDone: 'Concluído',
previewStatusIncomplete: '{{done}} de {{total}} séries feitas',
previewStatusPending: 'Ainda não começou',
readyHint: 'Fica parado até você tocar — esse tempo conta como descanso/transição, não como treino.',
startEx: 'Iniciar exercício',
```

```ts
// en — dentro de session: { ... }
badgeChanging: 'Changing exercise',
badgeReady: 'Ready to start',
badgeResting: 'Resting',
badgeTraining: 'Training',
doneCount_one: '{{count}} done',
doneCount_other: '{{count}} done',
prevDone: '{{name}} complete',
previewA11y: 'Preview of {{name}}, read only',
previewBack: 'Back to workout',
previewFinish: 'Finish and switch here',
previewStatusDone: 'Complete',
previewStatusIncomplete: '{{done}} of {{total}} sets done',
previewStatusPending: 'Not started yet',
readyHint: 'Stays put until you tap — this time counts as rest/transition, not training.',
startEx: 'Start exercise',
```

```ts
// es — dentro de session: { ... }
badgeChanging: 'Cambiando de ejercicio',
badgeReady: 'Listo para empezar',
badgeResting: 'Descanso',
badgeTraining: 'Entrenando',
doneCount_one: '{{count}} completado',
doneCount_other: '{{count}} completados',
prevDone: '{{name}} completado',
previewA11y: 'Vista previa de {{name}}, solo lectura',
previewBack: 'Volver al entreno',
previewFinish: 'Terminar y venir aquí',
previewStatusDone: 'Completado',
previewStatusIncomplete: '{{done}} de {{total}} series hechas',
previewStatusPending: 'Todavía no empezó',
readyHint: 'Queda detenido hasta que toques — ese tiempo cuenta como descanso/transición, no como entreno.',
startEx: 'Iniciar ejercicio',
```

Dentro de `sheet: { ... }` em cada arquivo:

```ts
// pt
continueWorkout: 'Continuar treino',
exIncomplete: 'Incompleto · {{done}} de {{total}}',
exNow: 'Agora',
live: 'Em andamento',
```

```ts
// en
continueWorkout: 'Continue workout',
exIncomplete: 'Incomplete · {{done}} of {{total}}',
exNow: 'Now',
live: 'In progress',
```

```ts
// es
continueWorkout: 'Continuar entreno',
exIncomplete: 'Incompleto · {{done}} de {{total}}',
exNow: 'Ahora',
live: 'En curso',
```

Dentro de `done: { ... }` em cada arquivo:

```ts
// pt
activeRestSummary: '{{active}} ativo · {{rest}} de descanso',
```

```ts
// en
activeRestSummary: '{{active}} active · {{rest}} resting',
```

```ts
// es
activeRestSummary: '{{active}} activo · {{rest}} de descanso',
```

- [ ] **Step 2: Conferir que os três arquivos têm as mesmas chaves**

Run: `npm run test:unit -- --testPathPattern=i18n`

`src/i18n/__tests__/i18n.test.ts` compara `pt` contra `en`/`es`: mesmas chaves e mesmas variáveis `{{x}}` em
cada texto. Qualquer chave esquecida num dos três arquivos, ou uma variável digitada diferente, falha aqui.
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/pt/fitness.ts src/i18n/locales/en/fitness.ts src/i18n/locales/es/fitness.ts
git commit -m "i18n: textos novos da execução de treino (pt/en/es)"
```

---

## Task 4: Tela de sessão — acumuladores por exercício (núcleo do relógio)

Este task mexe só na lógica de estado de `WorkoutSession`, sem mudar JSX ainda — prepara o terreno pro Task 5.

**Files:**
- Modify: `app/cliente/treino/sessao/[id].tsx`

- [ ] **Step 1: Importar as funções novas**

No topo do arquivo, junto dos outros imports de `flatten`:

```ts
import { flattenWorkout, nextPrescription, stepLoad } from '@/src/features/fitness/flatten';
import { nextOpenIndex, transitionRest } from '@/src/features/fitness/sessionStatus';
```

- [ ] **Step 2: Acrescentar o estado novo**

Logo depois da declaração de `restTotal` (linha ~99 do arquivo original, `const [restTotal, setRestTotal] = useState(60);`), acrescente:

```ts
const [started, setStarted] = useState<boolean[]>(() => rows.map(() => false));
const [activeSeconds, setActiveSeconds] = useState<number[]>(() => rows.map(() => 0));
const [restSecondsArr, setRestSecondsArr] = useState<number[]>(() => rows.map(() => 0));
/** Qual acumulador está ligado agora — exatamente um por vez. */
const [bucket, setBucket] = useState<{ idx: number; kind: 'active' | 'rest' }>(() => ({ idx: 0, kind: 'rest' }));
const [bucketSince, setBucketSince] = useState<number | null>(wallClock());
/** Nome/volume do exercício que acabou de fechar + tipo de descanso — só preenchido durante a transição (estado 3/4). `null` fora dela. */
const [justFinished, setJustFinished] = useState<{ name: string; volume: number; restKind: 'ring' | 'stopwatch' } | null>(null);
/** Só importa durante uma transição com cronômetro crescente, ou quando o anel já zerou e o aluno tocou "Pular descanso" antes do fim. */
const [explicitGateOpen, setExplicitGateOpen] = useState(false);
```

- [ ] **Step 3: Carregar os campos novos do draft, e inicializar a transição do primeiro exercício**

No `useEffect` que já chama `loadDraft` (linha ~119-131), complete o `if (d && ...)` pra também restaurar os
campos novos, e trate o caso sem draft (treino começando do zero: abre travado no "Pronto pra começar" do
exercício 0, conforme a spec):

```ts
useEffect(() => {
  void loadDraft(workout.id).then((d) => {
    if (d && d.logs.length === rows.length) {
      setIdx(d.idx);
      setLogs(d.logs);
      setClock({ base: d.elapsed, since: wallClock() });
      setStarted(d.started);
      setActiveSeconds(d.activeSeconds);
      setRestSecondsArr(d.restSeconds);
      const p = nextPrescription(rows[d.idx], d.logs[d.idx]?.length ?? 0);
      setKg(p.kg);
      setReps(p.reps);
      if (d.started[d.idx]) {
        setBucket({ idx: d.idx, kind: 'active' });
      } else {
        // Reabriu sem ter tocado "Iniciar" nesse exercício: continua travado no "Pronto pra começar".
        setBucket({ idx: d.idx, kind: 'rest' });
        setJustFinished(null);
        setExplicitGateOpen(false);
      }
      setBucketSince(wallClock());
    }
    setReady(true);
  });
}, [workout.id, rows]);
```

- [ ] **Step 4: `flushBucket`/`switchBucket` e leitura "ao vivo" dos acumuladores**

Logo antes de `function startRest(seconds: number) {` (linha ~152), acrescente. `currentActiveSeconds`/
`currentRestSeconds` existem porque `setActiveSeconds`/`setRestSecondsArr` são assíncronos (React) — ler os
state arrays logo depois de chamar `flushBucket` na mesma função daria o valor de **antes** do flush. Essas
duas funções calculam o total certo na hora, somando o que já foi persistido com o trecho do bucket atual
ainda em andamento (mesmo princípio do `elapsedAt` que já existe no arquivo pro relógio geral):

```ts
/** Soma o tempo desde que o bucket ligou no array certo, sem mudar o que está ligado agora. */
function flushBucket(t: number) {
  if (bucketSince == null) return;
  const delta = Math.max(0, t - bucketSince) / 1000;
  if (bucket.kind === 'active') setActiveSeconds((arr) => arr.map((v, i) => (i === bucket.idx ? v + delta : v)));
  else setRestSecondsArr((arr) => arr.map((v, i) => (i === bucket.idx ? v + delta : v)));
}

/** Fecha o acumulador atual e liga outro (ex.: ao trocar de exercício, ou ao tocar "Iniciar"). */
function switchBucket(next: { idx: number; kind: 'active' | 'rest' }) {
  const t = wallClock();
  flushBucket(t);
  setBucket(next);
  setBucketSince(paused ? null : t);
}

/** `kind`/`i` com o trecho do bucket atual já somado, sem esperar o próximo render. */
function liveSeconds(base: number[], kind: 'active' | 'rest', i: number, t: number): number {
  const live = bucket.kind === kind && bucket.idx === i && bucketSince != null ? Math.max(0, t - bucketSince) / 1000 : 0;
  return base[i] + live;
}
function currentActiveSeconds(t = wallClock()) {
  return activeSeconds.map((_, i) => liveSeconds(activeSeconds, 'active', i, t));
}
function currentRestSeconds(t = wallClock()) {
  return restSecondsArr.map((_, i) => liveSeconds(restSecondsArr, 'rest', i, t));
}
```

- [ ] **Step 5: Salvar os campos novos no draft, com o trecho em andamento incluído**

No `useEffect` que chama `saveDraft` (linha ~133-137), troque por:

```ts
useEffect(() => {
  if (ready) {
    const t = wallClock();
    void saveDraft({ workoutId: workout.id, idx, logs, elapsed: elapsedAt(t), started, activeSeconds: currentActiveSeconds(t), restSeconds: currentRestSeconds(t) });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ready, idx, logs, started, activeSeconds, restSecondsArr, bucket, workout.id]);
```

(Acrescentei `bucket` nas dependências: sem isso, uma troca de bucket sem troca de `idx`/`logs` — ex.: tocar
"Iniciar exercício" — não dispararia o save.)

- [ ] **Step 6: `togglePause` também congela/retoma o bucket**

Substitua a função `togglePause` existente (linha ~162-175) por:

```ts
function togglePause() {
  const t = wallClock();
  if (!paused) {
    setClock((c) => ({ base: c.base + (c.since != null ? Math.max(0, t - c.since) / 1000 : 0), since: null }));
    setRestFrozen(restUntil != null ? Math.max(0, Math.ceil((restUntil - t) / 1000)) : 0);
    setRestUntil(null);
    flushBucket(t);
    setBucketSince(null);
  } else {
    setClock((c) => ({ base: c.base, since: t }));
    if (restFrozen > 0) setRestUntil(t + restFrozen * 1000);
    setRestFrozen(0);
    setBucketSince(t);
  }
  setNow(t);
  setPaused(!paused);
}
```

- [ ] **Step 7: `completeSet` — descanso entre séries liga o bucket de descanso; exercício fechado dispara a transição**

**Não apague** a linha `const exDone = done.length >= row.sets.length;` que já existe no componente (linha
~109) — ela continua necessária pro caso do último exercício (ver Task 5, Step 1). Substitua o corpo de
`completeSet` (linha ~194-210) por:

```ts
function completeSet() {
  const next = logs.map((l, i) => (i === idx ? [...l, { kg, reps }] : l));
  setLogs(next);
  say(i18n.t('fitness:session.saySet', { kg: formatKg(kg), reps }));
  const doneCount = next[idx].length;
  if (doneCount < row.sets.length) {
    const upcoming = row.sets[doneCount];
    setKg(upcoming.kg);
    setReps(upcoming.reps);
    const restAfter = row.sets[doneCount - 1]?.rest ?? row.restSeconds;
    if (restAfter > 0) {
      startRest(restAfter);
      setRestTotal(restAfter);
      switchBucket({ idx, kind: 'rest' }); // descanso entre séries conta como restSeconds[idx], não activeSeconds[idx]
    }
    return;
  }
  // Exercício fechado: acha o próximo não concluído (pode já não ser idx + 1— ver nextOpenIndex).
  const nextIdx = nextOpenIndex(rows, next, idx);
  if (nextIdx === -1) return; // último: fica com exDone=true pro idx atual, tela de resumo cuida do resto (Task 5)
  const volume = next[idx].reduce((n, s) => n + s.kg * s.reps, 0);
  const tr = transitionRest(row);
  setJustFinished({ name: row.name, volume, restKind: tr.kind });
  setExplicitGateOpen(false);
  setIdx(nextIdx);
  setStarted((arr) => arr.map((v, i) => (i === nextIdx ? false : v)));
  switchBucket({ idx: nextIdx, kind: 'rest' });
  if (tr.kind === 'ring') {
    startRest(tr.seconds);
    setRestTotal(tr.seconds);
  } else {
    skipRest();
  }
  const p = nextPrescription(rows[nextIdx], next[nextIdx]?.length ?? 0);
  setKg(p.kg);
  setReps(p.reps);
}
```

(`row.name` no lugar do antigo `exName`: `exName` é o nome do **estágio** atual dentro de um superset/drop
set, não o nome do bloco — pro card "✓ {{name}} concluído" o nome do bloco é o que faz sentido.)

- [ ] **Step 8: Bucket de descanso entre séries volta pra ativo sozinho, quando o descanso acaba ou é pulado**

Esse efeito cobre os dois jeitos do descanso **entre séries** terminar (o anel chega a zero sozinho, ou o
aluno toca "Pular descanso") sem duplicar lógica nos dois lugares. A condição `started[idx]` é o que
diferencia esse caso do descanso da **transição entre exercícios** (Step 7/Task 5), onde `bucket.kind` também
é `'rest'`, mas o exercício ainda não foi iniciado — ali quem decide sair do estado é o Task 5 (gate),
não este efeito. Acrescente logo depois de `togglePause`:

```ts
useEffect(() => {
  if (!resting && started[idx] && bucket.kind === 'rest' && bucket.idx === idx) {
    switchBucket({ idx, kind: 'active' });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [resting, idx, started]);
```

- [ ] **Step 9: Tocar "Iniciar exercício" liga o relógio ativo**

Depois de `completeSet`, acrescente:

```ts
function tapStartExercise() {
  setStarted((arr) => arr.map((v, i) => (i === idx ? true : v)));
  setJustFinished(null);
  setExplicitGateOpen(false);
  switchBucket({ idx, kind: 'active' });
  skipRest();
}
```

- [ ] **Step 10: `finishAndGoTo` — troca manual de exercício (prévia e "Pular")**

Usada pelo "Pular" do rodapé (Task 5) e pela prévia (Task 6) — fica aqui porque é puramente lógica de estado,
igual as outras funções deste task. Depois de `tapStartExercise`, acrescente:

```ts
function finishAndGoTo(targetIdx: number) {
  if (targetIdx === idx) return;
  setJustFinished(null);
  setExplicitGateOpen(false);
  setIdx(targetIdx);
  setStarted((arr) => arr.map((v, i) => (i === targetIdx ? false : v)));
  switchBucket({ idx: targetIdx, kind: 'rest' });
  skipRest();
  const p = nextPrescription(rows[targetIdx], logs[targetIdx]?.length ?? 0);
  setKg(p.kg);
  setReps(p.reps);
}
```

- [ ] **Step 11: `finish()` inclui os três campos novos, com o trecho em andamento somado**

Substitua a função `finish` (linha ~212-217) por:

```ts
function finish() {
  const t = wallClock();
  // O rascunho só é apagado depois que o resultado for salvo (na tela de conclusão).
  setFinishedSession({
    workoutId: workout.id,
    idx,
    logs,
    elapsed: elapsedAt(t),
    started,
    activeSeconds: currentActiveSeconds(t),
    restSeconds: currentRestSeconds(t),
    finishedAt: new Date().toISOString(),
    resultKey: newIdempotencyKey(),
  });
  Speech.stop();
  router.replace('/cliente/treino/concluido');
}
```

- [ ] **Step 12: `npx tsc --noEmit --noUnusedLocals` limpo nesse arquivo**

Nesse ponto a tela ainda não usa `justFinished`/`tapStartExercise`/`finishAndGoTo` na JSX além do que já foi
escrito (isso continua no Task 5/6) — não deve sobrar "declared but never read" de verdade, já que `finish`,
`completeSet` e o `useEffect` do Step 8 já consomem a maior parte do estado novo. Qualquer erro de tipo
restante (não aviso de lint) precisa ser corrigido antes de prosseguir.

Run: `npx tsc --noEmit --noUnusedLocals`

- [ ] **Step 13: Commit**

```bash
git add app/cliente/treino/sessao/\[id\].tsx
git commit -m "feat: sessão de treino acumula tempo ativo/descanso por exercício"
```

---

## Task 5: Tela de sessão — estados visuais 1-4 (treinando, descanso, transição, pronto pra começar)

**Files:**
- Modify: `app/cliente/treino/sessao/[id].tsx`

- [ ] **Step 1: Derivar a fase atual**

**Mantenha** a linha `const exDone = done.length >= row.sets.length;` que já existe no componente (linha
~109) — ela só fica `true` pro `idx` atual no caso do **último exercício sem próximo** (`completeSet` do
Task 4 não avança o `idx` nesse caso; em qualquer outra situação o `idx` já mudou antes de alguém conseguir ler
`exDone` como `true`). Logo depois da linha que calcula `const resting = rest > 0;` (linha ~111), acrescente:

```ts
/** true enquanto o exercício ativo ainda não foi "Iniciado" — mostra transição (3) ou o gate (4). */
const isGated = !started[idx];
/**
 * Transição com anel: só sai do anel quando ele zera ou o aluno pula. Sem anel (cronômetro crescente ou
 * primeiro exercício do treino, `justFinished` nulo), não tem o que esperar — cai direto no gate (estado 4),
 * mostrando o cronômetro como informação dentro da própria tela "Pronto pra começar" (Step 3).
 */
const inExTransition = isGated && justFinished?.restKind === 'ring' && !explicitGateOpen && rest > 0;
const inGate = isGated && !inExTransition;
const bucketElapsed = bucket.kind === 'rest' && bucket.idx === idx && bucketSince != null ? Math.floor((now - bucketSince) / 1000) : Math.floor(restSecondsArr[idx]);
```

`resting` continua controlando o card de descanso **entre séries** (estado 2) exatamente como hoje — só
importa quando `!isGated` (exercício já iniciado), porque `completeSet` só chama `startRest` nesse branch
quando o exercício não fechou, e porque o botão primário (Step 4) checa `isGated` antes de checar `resting`.

- [ ] **Step 2: Badge de estado no topo**

No bloco `<View style={[styles.top, ...]}>` (linha ~231-247), logo abaixo dele (antes de `<View style={styles.segments}>`), acrescente o badge:

```tsx
<View style={[styles.stateBadge, inGate ? styles.stateBadgeReady : inExTransition || resting ? styles.stateBadgeResting : styles.stateBadgeTraining]}>
  <Text style={styles.stateBadgeText}>
    {inGate ? i18n.t('fitness:session.badgeReady') : inExTransition ? i18n.t('fitness:session.badgeChanging') : resting ? i18n.t('fitness:session.badgeResting') : i18n.t('fitness:session.badgeTraining')}
  </Text>
</View>
```

Estilos (acrescentar ao `StyleSheet.create` no fim do arquivo):

```ts
stateBadge: { marginHorizontal: 16, marginTop: 4, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
stateBadgeTraining: { backgroundColor: colors.primaryWash },
stateBadgeResting: { backgroundColor: '#fff2e3' },
stateBadgeReady: { backgroundColor: '#f0f1f4' },
stateBadgeText: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, letterSpacing: 0.3, color: colors.text },
```

- [ ] **Step 3: Substituir o ramo "exercício concluído" pela transição (estado 3) e o gate (estado 4)**

O bloco atual (linha ~318-357) tem três ramos: `resting ? <restCard> : exDone ? <doneCard> : <steppers>`.
Troque a condição por (nessa ordem — `isGated` sempre vem antes de `exDone`/`resting`, porque os três podem em
teoria ser verdadeiros ao mesmo tempo só pro caso "último exercício, sem próximo", que nunca fica `isGated`):

```tsx
{inGate ? (
  <View style={styles.restCard}>
    {justFinished?.restKind === 'ring' || justFinished == null ? null : (
      <View style={styles.stopwatch}>
        <Num size="xl">{bucketElapsed}</Num>
        <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.seconds')}</Muted>
      </View>
    )}
    <View style={{ flex: 1 }}>
      {justFinished ? <Text style={styles.prevDone}>{i18n.t('fitness:session.prevDone', { name: justFinished.name })}</Text> : null}
      <Text style={styles.restTitle}>{i18n.t('fitness:session.badgeReady')}</Text>
      <Muted style={{ marginTop: 4, lineHeight: 19 }}>{i18n.t('fitness:session.readyHint')}</Muted>
    </View>
  </View>
) : inExTransition ? (
  <View style={styles.restCard}>
    <ProgressRing size={132} stroke={10} progress={rest / restTotal} accessibilityLabel={i18n.t('fitness:session.restA11y', { count: rest })}>
      <Num size="xl">{rest}</Num>
      <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.seconds')}</Muted>
    </ProgressRing>
    <View style={{ flex: 1 }}>
      <Text style={styles.prevDone}>{i18n.t('fitness:session.prevDone', { name: justFinished?.name })}</Text>
      <Muted style={{ marginTop: 4, lineHeight: 19 }}>{i18n.t('fitness:session.nextEx', { name: row.name })}</Muted>
      <PressableScale onPress={() => setExplicitGateOpen(true)} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:rest.skipA11y')} style={styles.more}>
        <Text style={styles.moreText}>{i18n.t('fitness:rest.skip')}</Text>
      </PressableScale>
    </View>
  </View>
) : exDone ? (
  <LinearGradient colors={['rgba(79,216,255,0.18)', 'rgba(30,78,216,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneCard}>
    <View style={styles.doneIcon}>
      <Ionicons name="checkmark" size={24} color={colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.restTitle}>{i18n.t('fitness:session.exDone')}</Text>
      <Muted style={{ marginTop: 3, color: colors.textSoft }}>{i18n.t('fitness:session.volume', { kg: volume.toLocaleString(locale()) })}</Muted>
    </View>
  </LinearGradient>
) : resting ? (
  <View style={styles.restCard}>
    <ProgressRing size={132} stroke={10} progress={rest / restTotal} accessibilityLabel={i18n.t('fitness:session.restA11y', { count: rest })}>
      <Num size="xl">{rest}</Num>
      <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.seconds')}</Muted>
    </ProgressRing>
    <View style={{ flex: 1 }}>
      <Text style={styles.restTitle}>{i18n.t('fitness:rest.title')}</Text>
      <Muted style={{ marginTop: 4, lineHeight: 19 }}>{i18n.t('fitness:session.upNext', { n: done.length + 1, kg: formatKg(kg), reps })}</Muted>
      <PressableScale onPress={() => { startRest(rest + 15); setRestTotal((t) => Math.max(t, rest + 15)); }} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:rest.plus15A11y')} style={styles.more}>
        <Text style={styles.moreText}>+15 s</Text>
      </PressableScale>
    </View>
  </View>
) : (
  <>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
      <Stepper label={i18n.t('fitness:session.load')} value={formatKg(kg)} unit="kg" onMinus={() => setKg((v) => stepLoad(v, step, -1))} onPlus={() => setKg((v) => stepLoad(v, step, 1))} />
      <Stepper label={i18n.t('fitness:log.reps')} value={String(reps)} onMinus={() => setReps((v) => Math.max(1, v - 1))} onPlus={() => setReps((v) => v + 1)} />
    </View>
    {LOAD_HISTORY[exId] ? (
      <View style={styles.lastCard}>
        <View style={{ flex: 1 }}>
          <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.lastTime')}</Muted>
          <Text style={styles.lastValue}>{`${formatKg(LOAD_HISTORY[exId].slice(-1)[0])} kg × ${row.reps}`}</Text>
        </View>
        <Spark values={LOAD_HISTORY[exId]} />
      </View>
    ) : null}
  </>
)}
```

Acrescente `stopwatch: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadows.card }` e `prevDone: { ...text.captionStrong, color: colors.textMuted }` ao `StyleSheet.create`.

- [ ] **Step 4: Botão primário e rodapé**

O cálculo de `primary` (linha ~219-225) precisa checar `isGated` **antes** de `resting`/`exDone` — senão, nas
janelas em que o exercício ainda não foi iniciado mas `resting` e `exDone` são os dois `false` (cronômetro
crescente, ou anel pausado com `restFrozen === 0`), o botão cairia em "Completar série" de um exercício que
nunca foi iniciado. Substitua por:

```ts
const hasNext = nextOpenIndex(rows, logs, idx) !== -1;
const primary = isGated
  ? { label: i18n.t('fitness:session.startEx'), onPress: tapStartExercise }
  : resting
    ? { label: i18n.t('fitness:rest.skipA11y'), onPress: skipRest }
    : exDone
      ? { label: i18n.t('fitness:session.finish'), onPress: finish }
      : { label: i18n.t('fitness:session.completeSet', { n: done.length + 1 }), onPress: completeSet };
```

(`exDone` só chega a `true` aqui no caso "último exercício, sem próximo" — ver Step 1 e Task 4/Step 7 — então
esse ramo é exatamente o "Finalizar treino" que já existe hoje, sem mudança de comportamento.)

No `ActionRow` do rodapé (linha ~378-398), troque o item "Pular" (`finishAndGoTo` já foi escrita no
Task 4/Step 10):

```ts
{
  icon: 'play-skip-forward',
  label: i18n.t('fitness:rest.skip'),
  accessibilityLabel: i18n.t('fitness:session.skipA11y'),
  disabled: !hasNext,
  onPress: () => finishAndGoTo(nextOpenIndex(rows, logs, idx)),
},
```

- [ ] **Step 5: `isLast` sai; `exDone` fica**

`isLast` (linha ~110) não é mais usado depois dos passos acima — apague essa linha. `exDone` (linha ~109)
continua necessária (Steps 1/3/4) — **não apague**. Se o TypeScript/ESLint acusar alguma outra referência
esquecida a `isLast`, remova também (ex.: o bloco "A seguir", tratado no Task 6).

- [ ] **Step 6: Verificação manual**

Suba o app: `npx expo start --web`, entre no modo demo, abra um treino. Nenhum exercício do `mockData` atual
(`src/features/fitness/mockData.ts`) tem o último set sem `rest_seconds` definido, então o cronômetro
crescente não aparece nos dados de demonstração como estão — pra testar esse ramo, remova temporariamente o
`rest_seconds` do último set de um exercício de teste local (não comite isso) ou peça pra alguém no time
ajustar o mock num commit separado depois. Confirme: badge troca de cor/texto nos 4 estados; ao terminar o
último set de um exercício com descanso aparece o anel com o nome do que acabou de fechar e some sozinho ao
zerar; o botão primário vira "Iniciar exercício" e só depois do toque os steppers aparecem; no último
exercício do treino, ao terminar a última série aparece o card "Exercício concluído" de sempre com o botão
"Finalizar treino". Tire um print de cada estado (pode usar o navegador embutido) pra conferir contra a spec.

- [ ] **Step 7: Commit**

```bash
git add app/cliente/treino/sessao/\[id\].tsx src/i18n/locales/pt/fitness.ts
git commit -m "feat: estados visuais da sessão (treinando, descanso, transição, pronto pra começar)"
```

---

## Task 6: Tela de sessão — prévia somente leitura e "Finalizar e vir para cá"

**Files:**
- Modify: `app/cliente/treino/sessao/[id].tsx`

- [ ] **Step 1: Estado da prévia**

Junto dos outros `useState` do componente, acrescente:

```ts
const [previewIdx, setPreviewIdx] = useState<number | null>(null);
```

- [ ] **Step 2: `finishAndGoTo` precisa fechar a prévia também**

`finishAndGoTo` já foi escrita no Task 4/Step 10 (ela não depende de `previewIdx`, só troca o `idx`). Edite-a
pra fechar a prévia antes de trocar, senão o painel de prévia continua aberto depois do toque em "Finalizar e
vir para cá":

```ts
function finishAndGoTo(targetIdx: number) {
  setPreviewIdx(null);
  if (targetIdx === idx) return;
  setJustFinished(null);
  setExplicitGateOpen(false);
  setIdx(targetIdx);
  setStarted((arr) => arr.map((v, i) => (i === targetIdx ? false : v)));
  switchBucket({ idx: targetIdx, kind: 'rest' });
  skipRest();
  const p = nextPrescription(rows[targetIdx], logs[targetIdx]?.length ?? 0);
  setKg(p.kg);
  setReps(p.reps);
}
```

- [ ] **Step 3: Segmentos do topo e lista "Ver treino" abrem a prévia, não trocam o `idx` direto**

Troque `onPress={() => goTo(i)}` no `Pressable` dos segmentos (linha ~253-265) e no `Pressable` do
`BottomSheet` (linha ~407-412) por:

```ts
onPress={() => (i === idx ? undefined : setPreviewIdx(i))}
```

(No `BottomSheet`, mantenha o `setListOpen(false)` depois.) A função `goTo` original não é mais chamada por
nenhuma UI depois disso — apague-a (linha ~186-192). O bloco "A seguir" (linha ~360-371) também não deve mais
chamar `goTo`: troque `onPress={() => goTo(idx + 1)}` por `onPress={() => setPreviewIdx(nextIdx)}`, e a
condição que envolve o bloco (hoje `!isLast`) por `nextIdx !== -1`, usando:

```ts
const nextIdx = nextOpenIndex(rows, logs, idx);
```

(calculado uma vez no corpo do componente, perto de `hasNext` do Task 5 — aliás `hasNext` pode virar
`nextIdx !== -1` direto, sem recalcular `nextOpenIndex` duas vezes). O rótulo do bloco passa a mostrar
`rows[nextIdx].name` em vez de `rows[idx + 1].name`, pelo mesmo motivo do "Pular": o próximo de verdade pode
não ser `idx + 1` se algo no meio já estiver `done`.

- [ ] **Step 4: Painel da prévia**

Logo acima do fechamento do `<ScrollView>` (depois do bloco "A seguir", antes de `</ScrollView>`, linha
~372), e condicionado a `previewIdx != null`, troque **todo o conteúdo do `ScrollView`** (o `exHead`, os
`pills`, e o bloco condicional do Task 5) por um painel de prévia quando `previewIdx != null`. A forma mais
simples é envolver o conteúdo de hoje assim:

```tsx
{previewIdx != null ? (
  <PreviewPanel
    row={rows[previewIdx]}
    status={exerciseStatus(rows[previewIdx], logs[previewIdx] ?? [], false)}
    doneCount={logs[previewIdx]?.length ?? 0}
    onFinish={() => finishAndGoTo(previewIdx)}
    onBack={() => setPreviewIdx(null)}
  />
) : (
  <>
    {/* exHead, pills e o bloco condicional do Task 5 — conteúdo que já existe, sem mudança */}
  </>
)}
```

E, fora do componente `WorkoutSession` (perto de `Stepper`/`Spark`, topo do arquivo), um componente pequeno:

```tsx
function PreviewPanel({ row, status, doneCount, onFinish, onBack }: { row: ExerciseRow; status: ExerciseStatus; doneCount: number; onFinish: () => void; onBack: () => void }) {
  const statusLabel =
    status === 'done' ? i18n.t('fitness:session.previewStatusDone') : status === 'incomplete' ? i18n.t('fitness:session.previewStatusIncomplete', { done: doneCount, total: row.sets.length }) : i18n.t('fitness:session.previewStatusPending');
  return (
    <View accessible accessibilityLabel={i18n.t('fitness:session.previewA11y', { name: row.name })}>
      <View style={styles.exHead}>
        <LinearGradient colors={gradients.media} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.prescription}>{row.prescription}</Text>
          <Text style={styles.howTo}>{statusLabel}</Text>
        </View>
      </View>
      {status !== 'done' ? (
        <PressableScale onPress={onFinish} accessibilityRole="button" style={styles.primary}>
          <Text style={styles.primaryText}>{i18n.t('fitness:session.previewFinish')}</Text>
        </PressableScale>
      ) : null}
      <Pressable onPress={onBack} accessibilityRole="button" style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={styles.howTo}>{i18n.t('fitness:session.previewBack')}</Text>
      </Pressable>
    </View>
  );
}
```

Precisa importar `ExerciseRow` e `exerciseStatus` no topo do arquivo:

```ts
import type { ExerciseRow } from '@/src/features/fitness/flatten';
import { exerciseStatus, nextOpenIndex, transitionRest, type ExerciseStatus } from '@/src/features/fitness/sessionStatus';
```

- [ ] **Step 5: Esconder o botão primário durante a prévia; `ActionRow` continua**

O `ActionRow` (Pausar/Pular/Encerrar) já está fora do `ScrollView`, então continua visível durante a prévia
sem mudança nenhuma. Mas o **botão primário** (o pill grande acima do `ActionRow`, calculado em `primary` no
Task 5/Step 4) continua mostrando "Completar série"/"Iniciar exercício" do exercício **ativo**, escondido atrás
do painel de prévia — como a prévia já tem seu próprio botão "Finalizar e vir para cá" dentro do `PreviewPanel`
(Step 4), esconda o primário de fora enquanto `previewIdx != null`. No JSX do rodapé (linha ~374-377):

```tsx
<View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
  {previewIdx == null ? (
    <PressableScale onPress={primary.onPress} accessibilityRole="button" accessibilityLabel={primary.label} style={styles.primary}>
      <Text style={styles.primaryText} numberOfLines={1}>{primary.label}</Text>
    </PressableScale>
  ) : null}
  <ActionRow
    style={{ marginTop: previewIdx == null ? 10 : 0 }}
    items={[ /* ...itens existentes, sem mudança... */ ]}
  />
</View>
```

- [ ] **Step 6: Verificação manual**

No app rodando: toque num exercício futuro pela lista "Ver treino" — deve abrir a prévia, sem steppers; toque
"Finalizar e vir para cá" — deve trocar o exercício ativo e cair no "Pronto pra começar"; toque "Voltar ao
treino" numa prévia sem finalizar — deve voltar pro exercício ativo sem mudar nada. Teste também a prévia de
um exercício já concluído (só resumo + "Voltar ao treino", sem o botão de finalizar).

- [ ] **Step 7: Commit**

```bash
git add app/cliente/treino/sessao/\[id\].tsx src/i18n/locales/pt/fitness.ts
git commit -m "feat: prévia somente leitura ao navegar entre exercícios, com 'Finalizar e vir para cá'"
```

---

## Task 7: Tela de sessão — progresso real (item 5)

**Files:**
- Modify: `app/cliente/treino/sessao/[id].tsx`

- [ ] **Step 1: `frac` do segmento reflete séries feitas, não posição**

No `rows.map` dos segmentos (linha ~250-251), troque:

```ts
const frac = i < idx ? 1 : i === idx ? Math.min(1, done.length / r.sets.length) : (logs[i]?.length ?? 0) >= r.sets.length ? 1 : 0;
```

por:

```ts
const frac = Math.min(1, (logs[i]?.length ?? 0) / r.sets.length);
```

(`done` já é `logs[idx]`, então pro índice atual isso dá o mesmo valor de antes; pros demais, deixa de
assumir "feito só por estar antes do atual".)

- [ ] **Step 2: Texto "Exercício X de Y" ganha a contagem real**

No bloco `<Text style={styles.navCount}>` (linha ~270-274), acrescente a contagem de concluídos depois do
total:

```tsx
<Text style={styles.navCount}>
  {i18n.t('fitness:session.exercise') + ' '}
  <Text style={styles.navCountStrong}>{idx + 1}</Text>
  {i18n.t('fitness:session.ofTotal', { total: rows.length })}
  {' · '}
  {i18n.t('fitness:session.doneCount', { count: rows.filter((r, i) => (logs[i]?.length ?? 0) >= r.sets.length).length })}
</Text>
```

- [ ] **Step 3: Verificação manual**

No app, pule (pela prévia) o exercício 1 e termine o exercício 2: confirme que o segmento do exercício 1
**não** aparece cheio, e que o texto mostra "1 concluído" mesmo estando no exercício 3.

- [ ] **Step 4: Commit**

```bash
git add app/cliente/treino/sessao/\[id\].tsx
git commit -m "fix: progresso da sessão reflete séries feitas, não a posição do exercício"
```

---

## Task 8: Ficha do treino — "em andamento" e status por exercício

**Files:**
- Modify: `app/cliente/treino/[id].tsx`

- [ ] **Step 1: Carregar o draft da sessão**

No topo do arquivo, importe:

```ts
import { loadDraft, type SessionDraft } from '@/src/features/fitness/sessionStore';
import { exerciseStatus } from '@/src/features/fitness/sessionStatus';
import { formatClock } from '@/src/shared/format';
```

Dentro de `WorkoutSheet`, logo depois de `const rows = flattenWorkout(workout);`:

```ts
const [draft, setDraft] = useState<SessionDraft | null>(null);
useEffect(() => {
  void loadDraft(workout.id).then(setDraft);
}, [workout.id]);
```

- [ ] **Step 2: Card "em andamento"**

Dentro do `<HeroCard>` (linha ~87-108), logo antes de `{when ? ... : null}`, acrescente, só quando há draft:

```tsx
{draft ? (
  <View style={styles.liveRow}>
    <View style={styles.liveDot} />
    <Text style={styles.liveText}>{t('sheet.live')}</Text>
    <Text style={styles.liveTime}>{formatClock(draft.elapsed)}</Text>
  </View>
) : null}
```

Estilos novos:

```ts
liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
liveText: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, letterSpacing: 0.3, color: colors.primaryDeep },
liveTime: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, color: colors.textMuted, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
```

- [ ] **Step 3: Botão "Continuar treino"**

No rodapé (linha ~177-182), troque o label do primeiro `Button`:

```tsx
<Button label={draft ? t('sheet.continueWorkout') : t('sheet.start')} icon="play" onPress={() => router.push(`/cliente/treino/sessao/${workout.id}`)} />
```

- [ ] **Step 4: Status por exercício na lista de força**

No `partRows.map` (linha ~129-152), acrescente um selo de status ao lado de `last` (depois do bloco
`{last != null ? (...) : null}`):

```tsx
{draft ? (
  (() => {
    const i = rows.indexOf(r);
    const status = exerciseStatus(r, draft.logs[i] ?? [], i === draft.idx);
    if (status === 'done') return <Ionicons name="checkmark-circle" size={20} color={colors.success} />;
    if (status === 'active') return <Text style={styles.exNow}>{t('sheet.exNow')}</Text>;
    if (status === 'incomplete') return <Text style={styles.exIncomplete}>{t('sheet.exIncomplete', { done: draft.logs[i].length, total: r.sets.length })}</Text>;
    return null;
  })()
) : null}
```

Precisa importar `Ionicons` (já deve estar importado — confira; se não, `import { Ionicons } from
'@expo/vector-icons';`). Estilos novos:

```ts
exNow: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, color: colors.primary },
exIncomplete: { fontFamily: typography.fontFamilySemiBold, fontSize: 11, color: colors.warnText },
```

- [ ] **Step 5: Verificação manual**

Comece um treino, saia (botão ✕ ou voltar), abra a ficha de novo: confirme "EM ANDAMENTO" + "Continuar
treino" + selos por exercício (✓ no concluído, "Agora" no ativo, aviso no incompleto). Encerre o treino e
confirme que a ficha volta ao estado "Começar treino".

- [ ] **Step 6: Commit**

```bash
git add app/cliente/treino/\[id\].tsx
git commit -m "feat: ficha do treino mostra sessão em andamento e status por exercício"
```

---

## Task 9: Tela de conclusão — resumo ativo x descanso

**Files:**
- Modify: `app/cliente/treino/concluido.tsx`

- [ ] **Step 1: Somar os arrays e exibir**

Importe `formatDuration`:

```ts
import { formatClock, formatDuration, formatKg, isoDate } from '@/src/shared/format';
```

Logo depois de `const elapsed = session?.elapsed ?? 0;` (linha ~68), acrescente:

```ts
const activeTotal = session?.activeSeconds?.reduce((n, v) => n + v, 0) ?? 0;
const restTotal = session?.restSeconds?.reduce((n, v) => n + v, 0) ?? 0;
```

No `StatStrip` de dentro do `hero` (linha ~156-165), não mexa (continua mostrando tempo total/volume/séries).
Acrescente uma linha de texto logo abaixo dele, ainda dentro do `<Rise index={2}>`:

```tsx
{activeTotal > 0 || restTotal > 0 ? (
  <Muted style={{ marginTop: 10, textAlign: 'center' }}>{t('done.activeRestSummary', { active: formatDuration(activeTotal), rest: formatDuration(restTotal) })}</Muted>
) : null}
```

- [ ] **Step 2: Verificação manual**

Termine um treino com pelo menos uma troca de exercício (pra ter descanso de transição) e confira a linha
"X min ativo · Y min de descanso" na tela de conclusão.

- [ ] **Step 3: Commit**

```bash
git add app/cliente/treino/concluido.tsx
git commit -m "feat: tela de conclusão mostra tempo ativo x descanso"
```

---

## Task 10: Checagem final

**Files:** nenhum novo — só validação.

- [ ] **Step 1: Suíte completa**

```bash
npm run lint
npx tsc --noEmit --noUnusedLocals
npx jest
```

Expected: os três sem erro.

- [ ] **Step 2: Fluxo ponta a ponta no app**

`npx expo start --web`, modo demo, um treino com pelo menos: um exercício com descanso programado entre
exercícios, um sem, um bloco combinado (superset/drop set). Percorra: início travado em "Pronto pra começar"
→ "Iniciar exercício" → completar séries → transição (anel ou cronômetro, conforme o exercício) →
"Iniciar exercício" de novo → pular um exercício pela prévia → voltar e completá-lo depois → encerrar →
conferir a ficha "em andamento" no meio do caminho → conferir o resumo ativo/descanso na conclusão.

- [ ] **Step 3: Commit final (se sobrou algum ajuste solto)**

```bash
git add -A
git commit -m "chore: ajustes finais da execução de treino"
```
