import { FOLDS_SUM, compareRows, daysBetween, deltaTone, pointsOf, previousValue } from '../bodyEvolution';
import type { AssessmentView } from '@/src/features/portal/assessments';

const a = (id: string, date: string, measures: Record<string, number>, derived: AssessmentView['derived'] = {}): AssessmentView => ({
  id, contact_id: 'c', assessed_on: date, assessor_name: null, method: 'complete', notes: null, measures, derived,
});

const items = [
  a('1', '2026-04-29', { weight_kg: 94, body_fat_percent: 20.5, lean_mass_kg: 74.7, thigh_right_cm: 85 }),
  a('2', '2026-05-30', { weight_kg: 88 }),
  a('3', '2026-07-04', { weight_kg: 82.9, body_fat_percent: 16.9, lean_mass_kg: 68.9, thigh_right_cm: 54 }),
];

describe('evolução corporal', () => {
  it('compara a primeira com a última vez que cada medida apareceu', () => {
    const rows = compareRows(items);
    const weight = rows.find((r) => r.key === 'weight_kg')!;
    expect(weight.from.value).toBe(94);
    expect(weight.to.value).toBe(82.9);
    expect(weight.count).toBe(3);
    const fat = rows.find((r) => r.key === 'body_fat_percent')!;
    expect(fat.count).toBe(2);
    expect(fat.diff).toBeCloseTo(-3.6);
    expect(rows.find((r) => r.key === 'hip_cm')).toBeUndefined();
  });

  it('gordura calculada pelo método vale mais que a informada', () => {
    const rows = compareRows([a('x', '2026-01-01', { weight_kg: 80, body_fat_percent: 30 }, { body_fat_percent: 22 })]);
    expect(rows.find((r) => r.key === 'body_fat_percent')!.to.value).toBe(22);
  });

  it('pinta de verde só o que melhorou de forma óbvia', () => {
    expect(deltaTone('body_fat_percent', -3.6)).toBe('good');
    expect(deltaTone('lean_mass_kg', -5.8)).toBe('neutral');
    expect(deltaTone('lean_mass_kg', 1)).toBe('good');
    expect(deltaTone('weight_kg', -11.1)).toBe('neutral');
    expect(deltaTone('triceps_mm', -1.7)).toBe('good');
    expect(deltaTone('waist_cm', 0)).toBe('flat');
  });

  it('a diferença do histórico usa a última avaliação que tinha a medida', () => {
    expect(previousValue(items, 2, 'body_fat_percent')).toBe(20.5);
    expect(previousValue(items, 2, 'weight_kg')).toBe(88);
    expect(previousValue(items, 0, 'weight_kg')).toBeUndefined();
  });

  it('soma só as dobras tiradas em todas as avaliações com dobra', () => {
    const folds = [
      a('1', '2026-01-01', { triceps_mm: 10, subscapular_mm: 20, calf_fold_mm: 5 }),
      a('2', '2026-02-01', { weight_kg: 80 }),
      a('3', '2026-03-01', { triceps_mm: 8, subscapular_mm: 18 }),
    ];
    expect(pointsOf(folds, FOLDS_SUM).map((p) => p.value)).toEqual([30, 26]);
    expect(deltaTone(FOLDS_SUM, -4)).toBe('good');
    expect(pointsOf([a('x', '2026-01-01', { triceps_mm: 10 })], FOLDS_SUM)).toEqual([]);
  });

  it('conta os dias entre as avaliações', () => {
    expect(daysBetween('2026-04-29', '2026-07-04')).toBe(66);
  });
});
