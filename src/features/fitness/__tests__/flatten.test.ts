import { flattenWorkout, parseKg } from '../flatten';
import { WORKOUTS } from '../mockData';

describe('parseKg', () => {
  it('lê carga com vírgula e unidade', () => {
    expect(parseKg('12,5 kg')).toBe(12.5);
    expect(parseKg('40 kg')).toBe(40);
    expect(parseKg(undefined)).toBe(0);
  });
});

describe('flattenWorkout', () => {
  const rows = flattenWorkout(WORKOUTS[0]);

  it('uma linha por exercício, na ordem da ficha', () => {
    expect(rows.map((r) => r.name).slice(0, 2)).toEqual(['Supino reto com barra', 'Supino inclinado com halteres']);
    expect(rows).toHaveLength(7);
  });

  it('bloco combinado vira uma linha com o rótulo do bloco e as cargas em sequência', () => {
    const drop = rows[6];
    expect(drop.tag).toBe('Drop set');
    expect(drop.sets).toHaveLength(3);
    expect(drop.loadLabel).toBe('25 → 15 kg');
  });

  it('resume séries e prescrição', () => {
    expect(rows[0].prescription).toBe('4 × 10 · 40 kg');
    expect(rows[0].kg).toBe(40);
    expect(rows[0].restSeconds).toBe(60);
  });
});
