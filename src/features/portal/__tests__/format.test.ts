import { orderAmount, orderStatus } from '../format';

jest.mock('@/src/i18n', () => ({
  __esModule: true,
  default: { t: (k: string) => k.split('.').pop() },
  locale: () => 'pt-BR',
}));

const base = { status: 'pending_approval', quote_state: 'none' as const, can_respond: false, can_approve: false };

describe('situação do serviço para o cliente', () => {
  it('quem pode responder vê aguardando a resposta, na etapa de aprovação', () => {
    expect(orderStatus({ ...base, can_respond: true })).toEqual({ label: 'awaitingYou', tone: 'warn', step: 2 });
    expect(orderStatus({ ...base, can_approve: true }).label).toBe('awaitingYou');
  });

  it('o que o cliente respondeu vale mais que a situação interna', () => {
    expect(orderStatus({ ...base, quote_state: 'accepted' })).toEqual({ label: 'youApproved', tone: 'success', step: 3 });
    expect(orderStatus({ ...base, status: 'draft', quote_state: 'declined' }).label).toBe('youDeclined');
    expect(orderStatus({ ...base, quote_state: 'revising' }).label).toBe('revising');
  });

  it('segue a situação da empresa quando não há resposta', () => {
    expect(orderStatus({ ...base, status: 'in_progress' })).toEqual({ label: 'in_progress', tone: 'primary', step: 4 });
    expect(orderStatus({ ...base, status: 'cancelled' }).step).toBe(0);
    expect(orderStatus({ ...base }).label).toBe('analysis');
  });

  it('situação desconhecida aparece como veio, sem etapa', () => {
    expect(orderStatus({ ...base, status: 'novo_status' })).toEqual({ label: 'novo_status', tone: 'neutral', step: 0 });
  });
});

describe('valor do serviço', () => {
  it('prefere o final, cai no estimado e esconde zero', () => {
    expect(orderAmount({ final_amount: '150', estimated_amount: '100', currency: 'BRL' })).toMatch(/150/);
    expect(orderAmount({ final_amount: '0', estimated_amount: '100', currency: 'BRL' })).toMatch(/100/);
    expect(orderAmount({ final_amount: '0', estimated_amount: '0', currency: 'BRL' })).toBe('');
    expect(orderAmount({ final_amount: null, estimated_amount: null, currency: null })).toBe('');
  });
});
