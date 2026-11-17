import { bmiBand, delta, elapsed, healthyWeightRange, seriesOf, summaryRows, valueOf, weightReading, type AssessmentView } from '../assessments';

const mk = (date: string, measures: Record<string, number>, derived: AssessmentView['derived'] = {}): AssessmentView => ({
  id: date, contact_id: 'c', assessed_on: date, assessor_name: null, method: null, measures, derived, notes: null,
});
const fmt = (n: number) => String(n).replace('.', ',');

describe('avaliações do aluno', () => {
  it('faixas do IMC e peso de referência', () => {
    expect(bmiBand(17).key).toBe('under');
    expect(bmiBand(22).key).toBe('normal');
    expect(bmiBand(27).key).toBe('over');
    expect(bmiBand(41).key).toBe('ob3');
    expect(healthyWeightRange(170)).toEqual({ min: 53.5, max: 72 });
    expect(weightReading(80, 170)).toEqual({ key: 'above', tone: 'warn', diff: 8 });
    expect(weightReading(50, 170).key).toBe('below');
    expect(weightReading(65, 170).key).toBe('within');
  });

  it('gordura e massas preferem o que o método calculou', () => {
    const a = mk('2026-01-01', { body_fat_percent: 20, lean_mass_kg: 60 }, { body_fat_percent: 18.5 });
    expect(valueOf(a, 'body_fat_percent')).toBe(18.5);
    expect(valueOf(a, 'lean_mass_kg')).toBe(60);
    expect(valueOf(mk('2026-01-01', {}), 'bmi')).toBeUndefined();
  });

  it('diferença com sinal e tempo entre avaliações', () => {
    expect(delta(80, 78.8, 'kg', fmt)).toBe('-1,2 kg');
    expect(delta(80, 81, '%', fmt)).toBe('+1 %');
    expect(delta(undefined, 1, 'kg', fmt)).toBeNull();
    expect(elapsed('2026-01-31', '2026-03-05')).toEqual({ months: 1, days: 5 });
  });

  it('resumo compara com a anterior e com a primeira, e só soma medidas que existem nas duas', () => {
    const items = [
      mk('2026-01-01', { weight_kg: 80, waist_cm: 90, hip_cm: 100 }),
      mk('2026-02-01', { weight_kg: 79, waist_cm: 88 }),
      mk('2026-03-01', { weight_kg: 77, waist_cm: 86, hip_cm: 98 }),
    ];
    const rows = summaryRows(items, fmt, (d) => `${d.months}m${d.days}d`);
    const weight = rows.find((r) => r.key === 'weight')!;
    expect(weight).toEqual({ key: 'weight', last: '-2 kg', overall: '-3 kg' });
    const trunk = rows.find((r) => r.key === 'trunk')!;
    expect(trunk.last).toBe('-2 cm');
    expect(trunk.overall).toBe('-6 cm');
    expect(summaryRows([items[0]], fmt, () => '')).toEqual([]);
  });

  it('série ignora quem não tem o valor', () => {
    const items = [mk('2026-01-01', { weight_kg: 80 }), mk('2026-02-01', {}), mk('2026-03-01', { weight_kg: 78 })];
    expect(seriesOf(items, 'weight_kg')).toEqual([{ date: '2026-01-01', value: 80 }, { date: '2026-03-01', value: 78 }]);
  });
});
