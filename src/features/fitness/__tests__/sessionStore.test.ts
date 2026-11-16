import { kvSet } from '@/src/shared/db/localDb';
import { ownedKey, setFitnessOwner } from '../owner';
import {
  clearFinishedSession,
  getFinishedSession,
  loadDraft,
  loadFinishedSession,
  migrateDraft,
  resetFinishedSessionMemory,
  saveDraft,
  setFinishedSession,
  type FinishedSession,
  type SessionDraft,
} from '../sessionStore';

const mockStore = new Map<string, unknown>();
jest.mock('@/src/shared/db/localDb', () => ({
  kvGet: async (k: string) => (mockStore.has(k) ? mockStore.get(k) : null),
  kvSet: async (k: string, v: unknown) => {
    mockStore.set(k, v);
  },
}));

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
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('treino terminado por conta', () => {
  beforeEach(() => mockStore.clear());

  it('limpar o treino de quem começou a salvar não apaga o da conta que entrou depois', async () => {
    setFitnessOwner('ana:academia');
    setFinishedSession(session('w1'));
    setFitnessOwner('bia:academia');
    setFinishedSession(session('w2'));
    await flush();
    await clearFinishedSession('w1', 'ana:academia');
    expect(getFinishedSession()?.workoutId).toBe('w2');
    setFitnessOwner('ana:academia');
    expect(await loadFinishedSession()).toBeNull();
    setFitnessOwner('bia:academia');
    expect((await loadFinishedSession())?.workoutId).toBe('w2');
  });
});

describe('migrateDraft', () => {
  const base = { workoutId: 'w1', idx: 0, elapsed: 0 };

  it('draft que já tem os três campos volta igual', () => {
    const draft: SessionDraft = { ...base, logs: [[{ kg: 1, reps: 1 }]], started: [true], activeSeconds: [5], restSeconds: [3] };
    expect(migrateDraft(draft)).toBe(draft);
  });

  it('logs vazio migra para arrays vazios', () => {
    const migrated = migrateDraft({ ...base, logs: [] } as SessionDraft);
    expect(migrated.started).toEqual([]);
    expect(migrated.activeSeconds).toEqual([]);
    expect(migrated.restSeconds).toEqual([]);
  });

  it('exercícios sem nenhuma série migram com started todo false', () => {
    const migrated = migrateDraft({ ...base, logs: [[], []] } as SessionDraft);
    expect(migrated.started).toEqual([false, false]);
  });

  it('exercício com série marca started só nele', () => {
    const migrated = migrateDraft({ ...base, logs: [[{ kg: 1, reps: 1 }], []] } as SessionDraft);
    expect(migrated.started).toEqual([true, false]);
  });
});

describe('migração do treino terminado ao carregar', () => {
  beforeEach(() => {
    mockStore.clear();
    resetFinishedSessionMemory();
  });

  it('treino terminado antigo sem os campos novos vem migrado ao carregar, e o cache guarda a versão migrada', async () => {
    setFitnessOwner('ana:academia');
    // Grava direto na chave do treino terminado, como uma versão antiga do app teria feito.
    const key = ownedKey('operax_workout_finished', 'ana:academia');
    await kvSet(key!, { workoutId: 'w1', idx: 0, logs: [[{ kg: 40, reps: 10 }]], elapsed: 20, finishedAt: '2026-11-15T12:00:00.000Z' });
    resetFinishedSessionMemory(); // força o caminho do kvGet, não o cache em memória
    const loaded = await loadFinishedSession();
    expect(loaded?.started).toEqual([true]);
    expect(loaded?.activeSeconds).toEqual([0]);
    expect(loaded?.restSeconds).toEqual([0]);
    // a segunda leitura devolve o objeto já migrado que ficou em memória
    expect(getFinishedSession()?.started).toEqual([true]);
    const loadedAgain = await loadFinishedSession();
    expect(loadedAgain?.started).toEqual([true]);
  });
});

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
