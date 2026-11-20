import { CHART_GROUPS, valueOf, type AssessmentView } from '@/src/features/portal/assessments';

/** Para onde a medida "deveria" ir. Só as óbvias: o resto não ganha cor de bom ou ruim. */
export function goodDirection(key: string): 'down' | 'up' | null {
  if (key === 'lean_mass_kg') return 'up';
  if (['body_fat_percent', 'fat_mass_kg', 'waist_cm', 'abdomen_cm', 'waist_hip_ratio'].includes(key) || key.endsWith('_mm')) return 'down';
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

/** Todas as medidas que o app sabe mostrar, na ordem do formulário da empresa. */
export const METRICS: MetricDef[] = CHART_GROUPS.flatMap((g) => g.charts.map((c) => ({ key: c.key, unit: c.unit, group: g.id })));

export type Point = { id: string; date: string; value: number };

export const pointsOf = (items: AssessmentView[], key: string): Point[] =>
  items.flatMap((a) => {
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
  for (let i = index - 1; i >= 0; i--) {
    const v = valueOf(items[i], key);
    if (typeof v === 'number') return v;
  }
  return undefined;
}

export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
