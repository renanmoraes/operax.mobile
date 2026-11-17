import { actionsFor, canEditOpen, detailsFromApi, hasKnownPayment, normalizeBookingStatus, paymentSummary, phoneLabel, rawStatusOf, reminderLabel } from '../bookingDetails';

describe('ficha do agendamento', () => {
  it('resume particular e convênio como no web', () => {
    expect(paymentSummary('private')).toBe('Particular');
    expect(paymentSummary('insurance', 'Unimed')).toBe('Convênio Unimed');
    expect(paymentSummary('insurance')).toBe('Convênio');
    expect(paymentSummary(null)).toBeNull();
  });

  it('escreve lembretes e telefone em linguagem simples', () => {
    expect(reminderLabel(1440)).toBe('1 dia antes');
    expect(reminderLabel(2880)).toBe('2 dias antes');
    expect(reminderLabel(120)).toBe('2 h antes');
    expect(reminderLabel(30)).toBe('30 min antes');
    expect(phoneLabel('+5511987654321')).toBe('(11) 98765-4321');
  });

  it('traz encaixe, sem lembrete, retorno e série da API', () => {
    const d = detailsFromApi({
      id: 'b1',
      starts_at: '2026-11-14T14:00:00Z',
      ends_at: '2026-11-14T14:30:00Z',
      status: 'Confirmed',
      client_name: 'Maria Silva',
      payment_type: 'insurance',
      plan_type_name: 'Bradesco',
      plan_type_id: 'pl1',
      visit_kind: 'retorno',
      is_encaixe: true,
      sem_lembrete: true,
      sem_lembrete_motivo: 'veio pelo Instagram',
      series_id: 's1',
      occurrence_index: 3,
      reminder_offsets_minutes: [120, 1440],
    });
    expect(d).toMatchObject({
      client: 'Maria Silva',
      status: 'confirmed',
      payment: 'Convênio Bradesco',
      paymentKnown: true,
      visit: 'Retorno',
      encaixe: 'Horário sobreposto autorizado pela recepção.',
      semLembrete: 'Ninguém vai ser avisado antes do horário: veio pelo Instagram.',
      series: 'Faz parte de uma série recorrente (ocorrência 3)',
      reminders: ['1 dia antes', '2 h antes'],
    });
  });

  it('oferece as ações certas para cada status', () => {
    expect(actionsFor('pending')).toEqual(['check_in', 'approve', 'reject', 'cancel']);
    expect(actionsFor('confirmed')).toEqual(['check_in', 'no_show', 'cancel']);
    expect(actionsFor('completed')).toEqual([]);
  });
});

describe('status do backend', () => {
  it('approved e pending_approval viram os status da agenda (e as ações aparecem)', () => {
    expect(normalizeBookingStatus('approved')).toBe('confirmed');
    expect(normalizeBookingStatus('pending_approval')).toBe('pending');
    expect(normalizeBookingStatus('canceled')).toBe('cancelled');
    expect(actionsFor(normalizeBookingStatus('approved'))).toEqual(['check_in', 'no_show', 'cancel']);
    expect(actionsFor(normalizeBookingStatus('pending_approval'))).toEqual(['check_in', 'approve', 'reject', 'cancel']);
  });
});

describe('ações pela situação real e pela permissão (como o web)', () => {
  const all = { create: true, approve: true, cancel: true };

  it('remarcação pendente só pode ser cancelada: nada de aprovar ou recusar', () => {
    expect(actionsFor('reschedule_pending_manual', all)).toEqual(['cancel']);
    expect(actionsFor('reschedule_pending_manual', { ...all, cancel: false })).toEqual([]);
  });

  it('pedido aguardando: aprovar e recusar com permissão de aprovar; dar entrada só se também pode marcar', () => {
    expect(actionsFor('pending_approval', all)).toEqual(['check_in', 'approve', 'reject', 'cancel']);
    expect(actionsFor('pending_approval', { create: false, approve: true, cancel: true })).toEqual(['approve', 'reject', 'cancel']);
    expect(actionsFor('pending_approval', { create: true, approve: false, cancel: true })).toEqual(['cancel']);
  });

  it('aprovado e confirmado: entrada, falta e cancelar, cada um com a sua permissão', () => {
    expect(actionsFor('approved', all)).toEqual(['check_in', 'no_show', 'cancel']);
    expect(actionsFor('confirmed', { create: true, approve: false, cancel: false })).toEqual(['check_in']);
    expect(actionsFor('approved', { create: false, approve: false, cancel: true })).toEqual(['no_show', 'cancel']);
  });

  it('encerrados não têm ação', () => {
    for (const st of ['done', 'canceled', 'rejected', 'no_show']) expect(actionsFor(st, all)).toEqual([]);
  });

  it('convênio só conta como resolvido com o plano; particular sempre', () => {
    expect(hasKnownPayment('private')).toBe(true);
    expect(hasKnownPayment('insurance', 'p1')).toBe(true);
    expect(hasKnownPayment('insurance', null)).toBe(false);
    expect(hasKnownPayment(null, null)).toBe(false);
    const d = detailsFromApi({ id: 'b', starts_at: '2026-11-14T14:00:00Z', ends_at: '2026-11-14T14:30:00Z', status: 'approved', payment_type: 'insurance', plan_type_id: null });
    expect(d.paymentKnown).toBe(false);
  });

  it('guarda a situação real e traduz os nomes da agenda de volta', () => {
    expect(rawStatusOf('confirmed')).toBe('approved');
    expect(rawStatusOf('pending')).toBe('pending_approval');
    expect(rawStatusOf('reschedule_pending_manual')).toBe('reschedule_pending_manual');
    const d = detailsFromApi({ id: 'b', starts_at: '2026-11-14T14:00:00Z', ends_at: '2026-11-14T14:30:00Z', status: 'pending', raw_status: 'reschedule_pending_manual' });
    expect(d.rawStatus).toBe('reschedule_pending_manual');
  });

  it('corrigir pagamento e remarcar: agendamento aberto e permissão de marcar', () => {
    expect(canEditOpen('reschedule_pending_manual', true)).toBe(true);
    expect(canEditOpen('approved', true)).toBe(true);
    expect(canEditOpen('approved', false)).toBe(false);
    expect(canEditOpen('done', true)).toBe(false);
    expect(canEditOpen('canceled', true)).toBe(false);
  });
});
