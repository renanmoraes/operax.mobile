import type { PosSaleRow } from '@/src/shared/api/pos.api';
import type { PosClient } from './posClient';

const PAGE_SIZE = 100;
/** Teto de segurança: 50 páginas (5.000 vendas num dia) antes de parar de pedir. */
const MAX_PAGES = 50;

/** Todas as páginas do dia: o total e a lista valem para o dia inteiro, não só para as primeiras 100 vendas. */
export async function fetchWholeDay(client: Pick<PosClient, 'sales'>, day: string): Promise<{ rows: PosSaleRow[]; total: number }> {
  const rows: PosSaleRow[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await client.sales({ from: day, to: day, page, page_size: PAGE_SIZE });
    rows.push(...r.rows);
    total = r.total;
    if (r.rows.length < PAGE_SIZE || rows.length >= total) break;
  }
  return { rows, total };
}
