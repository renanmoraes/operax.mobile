import { enqueue, flushQueue, type QueueSender } from '../resultsQueue';
import type { RecordResultBody } from '../types';

// Banco local de mentira (nos testes não há SQLite). `mockFail.on` simula o celular sem espaço.
const mockStore = new Map<string, unknown>();
const mockFail = { on: false };
jest.mock('@/src/shared/db/localDb', () => ({
  kvGet: async (k: string) => (mockStore.has(k) ? mockStore.get(k) : null),
  kvSetDurable: async (k: string, v: unknown) => {
    if (mockFail.on) throw new Error('disco cheio');
    mockStore.set(k, v);
  },
}));

const body = (key: string): RecordResultBody => ({
  workout_id: 'w-a',
  part_index: 0,
  executed_on: '2026-11-19',
  data: { kind: 'done' },
  idempotency_key: key,
});

describe('fila offline de resultados', () => {
  it('enqueue não duplica a mesma idempotency_key', () => {
    const q = enqueue(enqueue([], body('a')), body('a'));
    expect(q).toHaveLength(1);
  });

  it('envia em ordem e esvazia quando tudo dá certo', async () => {
    const sent: string[] = [];
    const sender: QueueSender = async (b) => {
      sent.push(b.idempotency_key);
      return { ok: true };
    };
    const rest = await flushQueue([body('a'), body('b')], sender);
    expect(sent).toEqual(['a', 'b']);
    expect(rest).toEqual([]);
  });

  it('para no primeiro erro de rede e mantém o resto', async () => {
    const sender: QueueSender = async (b) => (b.idempotency_key === 'b' ? { ok: false, status: 0 } : { ok: true });
    const rest = await flushQueue([body('a'), body('b'), body('c')], sender);
    expect(rest.map((x) => x.idempotency_key)).toEqual(['b', 'c']);
  });

  it('descarta item recusado pelo servidor (4xx) e segue', async () => {
    const sender: QueueSender = async (b) => (b.idempotency_key === 'a' ? { ok: false, status: 409 } : { ok: true });
    const rest = await flushQueue([body('a'), body('b')], sender);
    expect(rest).toEqual([]);
  });

  it('para em erro 5xx', async () => {
    const sender: QueueSender = async () => ({ ok: false, status: 503 });
    const rest = await flushQueue([body('a')], sender);
    expect(rest).toHaveLength(1);
  });
});

describe('fila por conta', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const owner = require('../owner') as typeof import('../owner');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const q = require('../resultsQueue') as typeof import('../resultsQueue');

  it('chave só com caracteres que o armazenamento seguro aceita', () => {
    expect(owner.ownedKey('fila', 'live:client:3f2a-uuid:t 1/x')).toBe('fila.live_client_3f2a-uuid_t_1_x');
    expect(owner.ownedKey('fila', '')).toBeNull();
  });

  it('cada conta vê só a própria fila', async () => {
    owner.setFitnessOwner('live:client:a:t1');
    await q.queueResults([body('a1')]);
    owner.setFitnessOwner('live:client:b:t1');
    expect(await q.loadQueue()).toEqual([]);
    owner.setFitnessOwner('live:client:a:t1');
    expect((await q.loadQueue()).map((b) => b.idempotency_key)).toEqual(['a1']);
  });

  it('trocou de conta no meio do envio: para e não manda o resto com o login novo', async () => {
    owner.setFitnessOwner('live:client:c:t1');
    await q.queueResults([body('c1'), body('c2'), body('c3')]);
    const sent: string[] = [];
    const changed = await q.flushAll({
      result: async (b) => {
        sent.push(b.idempotency_key);
        owner.setFitnessOwner('live:client:d:t1'); // a pessoa trocou de conta depois do primeiro envio
        return { ok: true };
      },
      activity: async () => ({ ok: true }),
    });
    expect(changed).toBe(true);
    expect(sent).toEqual(['c1']);
    owner.setFitnessOwner('live:client:c:t1');
    expect((await q.loadQueue()).map((b) => b.idempotency_key)).toEqual(['c2', 'c3']);
  });

  it('sem espaço para guardar: avisa (rejeita) em vez de fingir que guardou', async () => {
    owner.setFitnessOwner('live:client:e:t1');
    mockFail.on = true;
    await expect(q.queueResults([body('e1')])).rejects.toThrow();
    mockFail.on = false;
    expect(await q.loadQueue()).toEqual([]);
  });
});
