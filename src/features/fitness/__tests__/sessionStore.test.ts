import { setFitnessOwner } from '../owner';
import { clearFinishedSession, getFinishedSession, loadFinishedSession, setFinishedSession, type FinishedSession } from '../sessionStore';

const mockStore = new Map<string, unknown>();
jest.mock('@/src/shared/db/localDb', () => ({
  kvGet: async (k: string) => (mockStore.has(k) ? mockStore.get(k) : null),
  kvSet: async (k: string, v: unknown) => {
    mockStore.set(k, v);
  },
}));

const session = (workoutId: string): FinishedSession => ({ workoutId, idx: 0, logs: [], elapsed: 60, finishedAt: '2026-11-15T12:00:00.000Z' });
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
