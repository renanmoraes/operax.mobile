import type { ClientBooking } from '@/src/features/client/types';
import { newBookings, planReminders } from '../reminders';

jest.mock('@/src/shared/storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const now = new Date(2026, 10, 14, 10, 0);
const at = (h: number, m = 0, dayPlus = 0) => new Date(2026, 10, 14 + dayPlus, h, m).toISOString();
const booking = (over: Partial<ClientBooking>): ClientBooking => ({
  id: 'b1', tenant_slug: 'flux', tenant_name: 'Clínica Flux', starts_at: at(18), ends_at: at(19), status: 'confirmed',
  service_name: 'Funcional', provider_name: 'Ana', can_confirm: false, can_cancel: true, category: 'class', location: null, kind: 'class', ...over,
});

describe('lembretes de agenda e aula', () => {
  it('aula hoje às 18h: lembra 1 hora antes e 10 minutos antes (1 dia antes já passou)', () => {
    const plan = planReminders([booking({})], now);
    expect(plan.map((p) => [p.identifier, new Date(p.at).getHours(), new Date(p.at).getMinutes()])).toEqual([
      ['reminder:b1:60', 17, 0],
      ['reminder:b1:10', 17, 50],
    ]);
    expect(plan[0].title).toBe('Sua aula começa em 1 hora');
    expect(plan[0].body).toBe('Funcional hoje às 18:00 com Ana · Clínica Flux');
    expect(plan[0].url).toBe('/cliente/aula/b1');
  });

  it('horário amanhã que falta confirmar: o aviso da véspera pede a confirmação', () => {
    const plan = planReminders([booking({ id: 'c1', kind: undefined, category: 'session', status: 'pending', can_confirm: true, starts_at: at(14, 0, 1) })], now);
    expect(plan[0]).toMatchObject({ identifier: 'reminder:c1:1440', title: 'Seu horário é amanhã: confirme sua presença', url: '/cliente/compromisso/c1' });
    expect(plan).toHaveLength(3);
  });

  it('cancelado, realizado, passado ou longe demais não ganha lembrete', () => {
    const plan = planReminders(
      [
        booking({ id: 'x1', status: 'cancelled' }),
        booking({ id: 'x2', status: 'done' }),
        booking({ id: 'x3', starts_at: at(9) }),
        booking({ id: 'x4', starts_at: at(9, 0, 30) }),
      ],
      now,
    );
    expect(plan).toEqual([]);
  });

  it('horário novo marcado pela empresa é avisado; no primeiro sync só memoriza', () => {
    const list = [booking({ id: 'old' }), booking({ id: 'novo', starts_at: at(15, 0, 2) })];
    expect(newBookings(list, null, now)).toEqual([]);
    expect(newBookings(list, ['old'], now).map((b) => b.id)).toEqual(['novo']);
  });
});
