import { deviceId, newDeviceId } from '../deviceId';

// O jest sobe o jest.mock para antes dos imports.
const mockStore = new Map<string, string>();
jest.mock('../../storage', () => ({
  getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
}));


describe('identificador do aparelho', () => {
  it('sorteia no formato que o servidor aceita', () => {
    expect(newDeviceId()).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newDeviceId(() => 0.999999)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('é sorteado uma vez e reaproveitado (o mesmo celular mantém a vaga)', async () => {
    const first = await deviceId();
    expect(mockStore.get('operax.device_id')).toBe(first);
    expect(await deviceId()).toBe(first);
  });
});
