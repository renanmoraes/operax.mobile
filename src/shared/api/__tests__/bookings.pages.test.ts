import { listAllBookings } from '../bookings.api';

const mockGet = jest.fn();
jest.mock('../client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }));

const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${from + i}`, starts_at: '2026-11-14T12:00:00Z' }));

describe('agenda com muitos agendamentos', () => {
  it('busca todas as páginas do período antes de filtrar o dia', async () => {
    mockGet.mockReset();
    mockGet
      .mockResolvedValueOnce({ data: { items: page(0, 200), total: 250 } })
      .mockResolvedValueOnce({ data: { items: page(200, 50), total: 250 } });
    const r = await listAllBookings({ from: '2026-11-13', to: '2026-11-15' });
    expect(r.ok && r.items.length).toBe(250);
    expect(mockGet.mock.calls.map((c) => (c[1] as { params: { offset: number } }).params.offset)).toEqual([0, 200]);
  });
});
