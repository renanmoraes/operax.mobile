import { sportIconFor, sportLabelFor } from '../sports';

describe('esporte na lista de treinos importados', () => {
  it('cada esporte tem o ícone dele (natação é natação, corrida é corrida)', () => {
    expect(sportIconFor('swim')).toBe('swim');
    expect(sportIconFor('run')).toBe('run-fast');
    expect(sportIconFor('bike')).toBe('bike');
    expect(sportIconFor('row')).toBe('rowing');
    expect(sportIconFor('walk')).toBe('walk');
    expect(sportIconFor('strength')).toBe('weight-lifter');
    expect(sportIconFor('other')).toBe('heart-pulse');
  });

  it('esporte desconhecido ou ausente cai no ícone genérico', () => {
    expect(sportIconFor('parapente')).toBe('heart-pulse');
    expect(sportIconFor(null)).toBe('heart-pulse');
    expect(sportIconFor(undefined)).toBe('heart-pulse');
  });

  it('o nome vem no idioma do app, nunca a chave em inglês', () => {
    expect(sportLabelFor('swim')).toBe('Natação');
    expect(sportLabelFor('run')).toBe('Corrida');
    expect(sportLabelFor('row')).toBe('Remo');
    expect(sportLabelFor('other')).toBe('Outro treino');
    expect(sportLabelFor('parapente')).not.toMatch(/parapente|swim|run/);
    expect(sportLabelFor(null)).not.toBe('');
  });
});
