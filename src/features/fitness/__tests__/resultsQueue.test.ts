import { enqueue, flushQueue, type QueueSender } from '../resultsQueue';
import type { RecordResultBody } from '../types';

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
