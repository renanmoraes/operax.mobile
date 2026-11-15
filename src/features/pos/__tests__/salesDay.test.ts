import { fetchWholeDay } from '../salesDay';
import type { PosSaleRow } from '@/src/shared/api/pos.api';

const sale = (i: number): PosSaleRow => ({ id: `s${i}`, created_at: '2026-11-15T12:00:00Z', contact_id: null, contact_name: null, agent_name: null, amount: 1, items: [] });

describe('vendas do dia', () => {
  it('busca todas as páginas até o total', async () => {
    const all = Array.from({ length: 230 }, (_, i) => sale(i));
    const pages: number[] = [];
    const client = {
      sales: async ({ page = 1, page_size = 100 }: { from: string; to: string; page?: number; page_size?: number }) => {
        pages.push(page);
        return { rows: all.slice((page - 1) * page_size, page * page_size), total: all.length };
      },
    };
    const r = await fetchWholeDay(client, '2026-11-15');
    expect(r.rows).toHaveLength(230);
    expect(r.total).toBe(230);
    expect(pages).toEqual([1, 2, 3]);
  });

  it('para numa página só quando tudo coube nela', async () => {
    const client = { sales: jest.fn(async () => ({ rows: [sale(1)], total: 1 })) };
    await fetchWholeDay(client, '2026-11-15');
    expect(client.sales).toHaveBeenCalledTimes(1);
  });
});
