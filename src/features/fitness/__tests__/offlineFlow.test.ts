import { AxiosError } from 'axios';
import { setFitnessOwner } from '../owner';
import { fetchWorkout, fetchWorkoutsFor, recordResult } from '../fitnessApi';
import { syncOfflineWorkouts } from '../offlineSync';
import { readStore } from '../offlineStore';
import { flushAll, loadQueue, queueResults } from '../resultsQueue';

/**
 * Fluxo completo com a API de mentira: baixa os próximos dias, cai a rede, abre e executa o treino,
 * o resultado fica na fila, a rede volta, sobe uma vez só e o treino feito sai do celular.
 */
const mockKv = new Map<string, unknown>();
jest.mock('@/src/shared/db/localDb', () => ({
  kvGet: async (k: string) => (mockKv.has(k) ? JSON.parse(JSON.stringify(mockKv.get(k))) : null),
  kvSet: async (k: string, v: unknown) => void mockKv.set(k, v),
  kvSetDurable: async (k: string, v: unknown) => void mockKv.set(k, v),
}));
jest.mock('@/src/features/client/dataMode', () => ({ clientDataMode: () => 'live' }));
const mockServer = { online: true, results: new Map<string, unknown>(), posts: 0 };
const mockNetErr = () => new AxiosError('Network Error', 'ERR_NETWORK');
const mockW = (id: string) => ({ id, title: `T ${id}`, modality: 'strength', destination: 'individual', parts: [], exercise_snapshots: [], schedule: { mode: 'daily', starts_on: '2026-01-01', timezone: 'x' }, created_at: '', updated_at: '' });
jest.mock('@/src/shared/api/client', () => ({
  api: {
    get: async (url: string, cfg?: { params?: { date?: string } }) => {
      if (!mockServer.online) throw mockNetErr();
      if (url.endsWith('/workouts')) return { data: cfg?.params?.date === '2026-11-21' ? [mockW('futuro')] : cfg?.params?.date === '2026-11-19' ? [mockW('hoje')] : [] };
      if (url.includes('/workouts/')) return { data: mockW(url.split('/').pop()!) };
      return { data: {} };
    },
    post: async (_u: string, body: { idempotency_key: string }) => {
      if (!mockServer.online) throw mockNetErr();
      if (!mockServer.results.has(body.idempotency_key)) mockServer.posts += 1;
      mockServer.results.set(body.idempotency_key, body);
      return { data: { result: {}, duplicate: false } };
    },
  },
}));


beforeAll(() => {
  jest.useFakeTimers({ now: new Date('2026-11-19T12:00:00') });
  setFitnessOwner('client:1');
});

it('baixar, cair a rede, executar offline, subir sem duplicar e limpar o feito', async () => {
  // 1. online: baixa hoje e os próximos dias
  expect(await syncOfflineWorkouts({ force: true })).toBe(true);
  let st = await readStore();
  expect(st.days['2026-11-21']).toEqual(['futuro']);

  // 2. rede cai: o treino futuro abre e a lista do dia vem do celular
  mockServer.online = false;
  expect((await fetchWorkout('futuro'))?.id).toBe('futuro');
  expect((await fetchWorkoutsFor(new Date('2026-11-21T12:00:00'))).map((w) => w.id)).toEqual(['futuro']);

  // 3. offline: o resultado não sobe, vai para a fila; sincronizar offline não apaga nada
  const body = { workout_id: 'hoje', part_index: 0, executed_on: '2026-11-19', data: { kind: 'done' as const }, idempotency_key: 'k1' };
  await expect(recordResult(body)).rejects.toBeTruthy();
  await queueResults([body]);
  expect(await syncOfflineWorkouts({ force: true })).toBe(false);
  expect((await readStore()).workouts.hoje).toBeDefined();
  expect(await loadQueue()).toHaveLength(1);

  // 4. rede volta: a fila sobe uma vez (mesmo reenviando), a ficha de hoje sai do celular, a futura fica
  mockServer.online = true;
  const sender = async (b: typeof body) => {
    try {
      await recordResult(b);
      return { ok: true } as const;
    } catch {
      return { ok: false, status: 0 } as const;
    }
  };
  expect(await flushAll({ result: sender, activity: async () => ({ ok: true }) })).toBe(true);
  expect(await flushAll({ result: sender, activity: async () => ({ ok: true }) })).toBe(false);
  expect(mockServer.posts).toBe(1);
  expect(await loadQueue()).toHaveLength(0);
  await new Promise((r) => jest.requireActual('timers').setImmediate(r));
  await syncOfflineWorkouts({ force: true });
  st = await readStore();
  expect(st.workouts.hoje).toBeUndefined();
  expect(st.workouts.futuro).toBeDefined();
  // 5. e não baixa de novo o que já foi feito e enviado
  expect(Object.values(st.days).flat()).not.toContain('hoje');
});
