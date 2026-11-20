import { CHART_GROUPS, valueOf, type AssessmentView } from '@/src/features/portal/assessments';

/** Para onde a medida "deveria" ir. Só as óbvias: o resto não ganha cor de bom ou ruim. */
export function goodDirection(key: string): 'down' | 'up' | null {
  if (key === 'lean_mass_kg') return 'up';
  if (['body_fat_percent', 'fat_mass_kg', 'waist_cm', 'abdomen_cm', 'waist_hip_ratio', FOLDS_SUM].includes(key) || key.endsWith('_mm')) return 'down';
  return null;
}

export type DeltaTone = 'good' | 'neutral' | 'flat';

export function deltaTone(key: string, diff: number): DeltaTone {
  if (Math.abs(diff) < 0.05) return 'flat';
  const dir = goodDirection(key);
  if (dir === 'down' && diff < 0) return 'good';
  if (dir === 'up' && diff > 0) return 'good';
  return 'neutral';
}

export type MetricDef = { key: string; unit: string; group: (typeof CHART_GROUPS)[number]['id'] };

/** Soma das dobras: o número que a equipe acompanha de verdade. */
export const FOLDS_SUM = 'folds_sum';
const FOLD_KEYS = CHART_GROUPS.find((g) => g.id === 'folds')!.charts.map((c) => c.key);

/** Todas as medidas que o app sabe mostrar, na ordem do formulário da empresa (a soma das dobras abre o grupo das dobras). */
export const METRICS: MetricDef[] = CHART_GROUPS.flatMap((g) => [
  ...(g.id === 'folds' ? [{ key: FOLDS_SUM, unit: 'mm', group: g.id }] : []),
  ...g.charts.map((c) => ({ key: c.key, unit: c.unit, group: g.id })),
]);

/** Só soma as dobras tiradas em todas as avaliações que têm dobra; senão a soma mudaria por falta de medida, não pelo corpo. */
function foldsSumPoints(items: AssessmentView[]): Point[] {
  const withFolds = items.filter((a) => FOLD_KEYS.some((k) => typeof a.measures[k] === 'number'));
  const keys = FOLD_KEYS.filter((k) => withFolds.every((a) => typeof a.measures[k] === 'number'));
  if (keys.length < 2) return [];
  return withFolds.map((a) => ({ id: a.id, date: a.assessed_on, value: Math.round(keys.reduce((s, k) => s + a.measures[k], 0) * 10) / 10 }));
}

export type Point = { id: string; date: string; value: number };

export const pointsOf = (items: AssessmentView[], key: string): Point[] =>
  key === FOLDS_SUM ? foldsSumPoints(items) : items.flatMap((a) => {
    const value = valueOf(a, key);
    return typeof value === 'number' && Number.isFinite(value) ? [{ id: a.id, date: a.assessed_on, value }] : [];
  });

export type CompareRow = MetricDef & { from: Point; to: Point; diff: number; count: number };

/** Primeira e última vez que cada medida apareceu. Medida que nunca foi tirada fica de fora. */
export function compareRows(items: AssessmentView[]): CompareRow[] {
  return METRICS.flatMap((m) => {
    const pts = pointsOf(items, m.key);
    if (!pts.length) return [];
    const from = pts[0];
    const to = pts[pts.length - 1];
    return [{ ...m, from, to, diff: to.value - from.value, count: pts.length }];
  });
}

/** Avaliação que tem a medida mais recente antes desta, para a diferença do histórico. */
export function previousValue(items: AssessmentView[], index: number, key: string): number | undefined {
  if (key === FOLDS_SUM) return undefined;
  for (let i = index - 1; i >= 0; i--) {
    const v = valueOf(items[i], key);
    if (typeof v === 'number') return v;
  }
  return undefined;
}

export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
