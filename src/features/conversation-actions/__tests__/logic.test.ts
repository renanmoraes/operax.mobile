import { dayLabel, demoSlots, formatPixKey, nextDays, pixKeyError, servicesFor, upcomingSlots, DEMO_PROVIDERS, DEMO_SERVICES } from '../logic';

describe('ações da conversa', () => {
  it('valida a chave Pix conforme o tipo', () => {
    expect(pixKeyError('cpf', '123.456.789-09')).toBeNull();
    expect(pixKeyError('cpf', '123')).toMatch(/11/);
    expect(pixKeyError('cnpj', '12.345.678/0001-99')).toBeNull();
    expect(pixKeyError('phone', '(11) 98765-4321')).toBeNull();
    expect(pixKeyError('phone', '+55 11 98765-4321')).toBeNull();
    // DDD 55 (RS) não é confundido com o código do país
    expect(pixKeyError('phone', '(55) 99999-1234')).toBeNull();
    expect(formatPixKey('phone', '(55) 99999-1234')).toBe('(55) 99999-1234');
    expect(formatPixKey('phone', '+55 55 99999-1234')).toBe('(55) 99999-1234');
    expect(pixKeyError('email', 'a@b.co')).toBeNull();
    expect(pixKeyError('email', 'a@b')).not.toBeNull();
    expect(pixKeyError('random', '123e4567-e89b-12d3-a456-426614174000')).toBeNull();
    expect(pixKeyError('copy_paste', 'curto')).not.toBeNull();
    expect(pixKeyError('cpf', '  ')).toBe('Informe a chave');
  });

  it('formata a chave para leitura', () => {
    expect(formatPixKey('cpf', '12345678909')).toBe('123.456.789-09');
    expect(formatPixKey('cnpj', '12345678000199')).toBe('12.345.678/0001-99');
    expect(formatPixKey('phone', '5511987654321')).toBe('(11) 98765-4321');
  });

  it('lista os próximos dias com Hoje e Amanhã', () => {
    const today = new Date(2026, 10, 14, 10);
    const days = nextDays(3, today);
    expect(days.map((d) => d.getDate())).toEqual([14, 15, 16]);
    expect(dayLabel(days[0], today).top).toBe('Hoje');
    expect(dayLabel(days[1], today).top).toBe('Amanhã');
  });

  it('esconde horários que já passaram e ordena', () => {
    const now = new Date(2026, 10, 14, 10, 0);
    const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m).toISOString();
    const list = upcomingSlots(
      [
        { provider_id: 'p', starts_at: at(15), ends_at: at(16) },
        { provider_id: 'p', starts_at: at(9), ends_at: at(10) },
        { provider_id: 'p', starts_at: at(10, 10), ends_at: at(11) },
        { provider_id: 'p', starts_at: at(11), ends_at: at(12) },
      ],
      now,
    );
    expect(list.map((s) => new Date(s.starts_at).getHours())).toEqual([11, 15]);
  });

  it('mostra só os serviços do profissional', () => {
    expect(servicesFor(DEMO_PROVIDERS[1], DEMO_SERVICES).map((s) => s.id)).toEqual(['s-avaliacao', 's-funcional']);
    expect(servicesFor(undefined, DEMO_SERVICES)).toHaveLength(4);
  });

  it('gera horários de demonstração dentro do expediente e sem o almoço', () => {
    const slots = demoSlots(new Date(2026, 10, 16), 'p-ana', 60);
    expect(slots.length).toBeGreaterThan(3);
    for (const s of slots) {
      const h = new Date(s.starts_at).getHours();
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThan(18);
      expect(h).not.toBe(12);
    }
  });
});
