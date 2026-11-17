import { interestLabel } from '../interestLabel';

jest.mock('@/src/i18n', () => ({ __esModule: true, default: { t: (k: string) => `T(${k})` } }));
describe('rótulo do interesse da IA', () => {
  it('código conhecido vem traduzido, nunca o código cru', () => {
    expect(interestLabel('intent:booking')).toBe('T(attendance:interest.intent_booking)');
    expect(interestLabel(' product:vitamin_d ')).toBe('T(attendance:interest.product_vitamin_d)');
  });

  it('código desconhecido vira texto legível sem o prefixo', () => {
    expect(interestLabel('intent:new_thing_here')).toBe('New Thing Here');
    expect(interestLabel('texto livre')).toBe('texto livre');
  });

  it('vazio não mostra nada', () => {
    expect(interestLabel(null)).toBe('');
    expect(interestLabel('  ')).toBe('');
  });
});
