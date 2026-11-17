import { classifyFailure, clientPayload, encaixeJustificationOk, manualRange, NO_PAYMENT, ownProvider, paymentComplete, paymentPayload, phoneToE164, servicesOf, upcoming } from '../newBooking';

const err = (status: number, data: object) => ({ response: { status, data } });

describe('novo agendamento: regras', () => {
  it('pagamento: convênio exige o plano; os outros não levam plano', () => {
    expect(paymentComplete(NO_PAYMENT)).toBe(true);
    expect(paymentComplete({ type: 'insurance', planId: '' })).toBe(false);
    expect(paymentComplete({ type: 'insurance', planId: 'p1' })).toBe(true);
    expect(paymentPayload(NO_PAYMENT)).toEqual({});
    expect(paymentPayload({ type: 'private', planId: 'x' })).toEqual({ payment_type: 'private' });
    expect(paymentPayload({ type: 'insurance', planId: 'p1' })).toEqual({ payment_type: 'insurance', plan_type_id: 'p1' });
  });

  it('celular vira E.164 do Brasil', () => {
    expect(phoneToE164('(11) 91234-5678')).toBe('+5511912345678');
    expect(phoneToE164('+55 11 3456-7890')).toBe('+551134567890');
    expect(phoneToE164('5511912345678')).toBe('+5511912345678');
    expect(phoneToE164('12345')).toBeNull();
    expect(phoneToE164('')).toBeNull();
  });

  it('quem tem só create_own marca no próprio profissional', () => {
    const list = [{ id: 'a', name: 'A', user_id: 'u1' }, { id: 'b', name: 'B', user_id: 'u2' }];
    expect(ownProvider(list, 'u2', false)?.id).toBe('b');
    expect(ownProvider(list, 'u9', false)).toBeNull();
    expect(ownProvider([list[0]], 'u9', false)?.id).toBe('a');
    expect(ownProvider(list, 'u2', true)).toBeNull();
  });

  it('serviços do profissional: só os vinculados e ativos', () => {
    const services = [{ id: 's1', name: 'X', default_duration_min: 30 }, { id: 's2', name: 'Y', default_duration_min: 30, is_active: false }, { id: 's3', name: 'Z', default_duration_min: 30 }];
    expect(servicesOf(['s1', 's2'], services).map((s) => s.id)).toEqual(['s1']);
    expect(servicesOf(undefined, services)).toEqual([]);
  });

  it('só horários de hoje que ainda não passaram', () => {
    const now = new Date(2026, 10, 17, 10, 0);
    const slots = [{ starts_at: '2026-11-17T09:00:00.000Z' }, { starts_at: '2026-11-17T10:00:00.000Z' }, { starts_at: '2026-11-18T08:00:00.000Z' }, { starts_at: '2026-11-16T15:00:00.000Z' }];
    expect(upcoming(slots, now).map((s) => s.starts_at)).toEqual(['2026-11-17T10:00:00.000Z', '2026-11-18T08:00:00.000Z']);
  });

  it('quem será atendido: cliente de agenda, contato ou só o nome', () => {
    expect(clientPayload({ client_id: 'c1', contact_id: 'k1', name: 'Ana' })).toEqual({ client_id: 'c1' });
    expect(clientPayload({ client_id: null, contact_id: 'k1', name: 'Ana' })).toEqual({ contact_id: 'k1', client_name: 'Ana' });
    expect(clientPayload({ client_id: null, contact_id: null, name: 'Ana' })).toEqual({ client_name: 'Ana' });
  });

  it('encaixe: horário digitado com fim pela duração, e justificativa de 5 letras', () => {
    expect(manualRange('2026-11-17', '9:30', 45)).toEqual({ starts_at: '2026-11-17T09:30:00.000Z', ends_at: '2026-11-17T10:15:00.000Z' });
    expect(manualRange('2026-11-17', '25:00', 30)).toBeNull();
    expect(manualRange('2026-11-17', '23:50', 30)).toBeNull();
    expect(encaixeJustificationOk('  ok  ')).toBe(false);
    expect(encaixeJustificationOk('retorno urgente')).toBe(true);
  });

  it('erros do servidor viram o que a pessoa precisa decidir', () => {
    expect(classifyFailure(err(409, { code: 'single_active_booking', message: 'Já tem horário', booking: { starts_at: '2026-11-20T10:00:00.000Z' } }))).toEqual({ kind: 'single_active', message: 'Já tem horário', when: '2026-11-20T10:00:00.000Z' });
    expect(classifyFailure(err(403, { message: 'Este paciente está bloqueado para novos agendamentos até 30/11/2026 (política de falta).' })).kind).toBe('no_show');
    expect(classifyFailure(err(409, { message: 'Este horário está dentro de um bloqueio. Confirme na agenda se quiser agendar mesmo assim.' })).kind).toBe('soft_block');
    expect(classifyFailure(err(400, { message: 'Horário inválido.' }))).toEqual({ kind: 'other', message: 'Horário inválido.' });
    expect(classifyFailure(err(500, { message: 'boom' }))).toEqual({ kind: 'other', message: null });
  });
});
