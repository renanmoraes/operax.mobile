import { actionsFor, detailsFromApi, paymentSummary, phoneLabel, reminderLabel } from '../bookingDetails';

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
    expect(actionsFor('pending')).toEqual(['approve', 'reject']);
    expect(actionsFor('confirmed')).toEqual(['check_in', 'no_show', 'cancel']);
    expect(actionsFor('completed')).toEqual([]);
  });
});
