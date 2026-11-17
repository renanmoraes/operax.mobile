/** Avaliações físicas do aluno (mesmos campos e contas do portal web). Aqui só números e chaves; os textos vêm do i18n. */
export type AssessmentMethod = 'pollock3' | 'pollock7' | 'petroski' | 'navy' | 'bioimpedance' | 'basic' | 'complete';
export type AssessmentDerived = {
  bmi?: number;
  waist_hip_ratio?: number;
  body_fat_percent?: number;
  fat_mass_kg?: number;
  lean_mass_kg?: number;
  body_density?: number;
  method?: AssessmentMethod;
  method_label?: string;
};
export type AssessmentView = {
  id: string;
  contact_id: string;
  assessed_on: string;
  assessor_name: string | null;
  method: AssessmentMethod | null;
  measures: Record<string, number>;
  derived: AssessmentDerived;
  notes: string | null;
};

/** Ordem do formulário da empresa: é a ordem em que as medidas aparecem para o aluno. */
export const MEASURE_KEYS = [
  'weight_kg', 'height_cm', 'body_fat_percent', 'lean_mass_kg',
  'neck_cm', 'shoulder_cm', 'chest_cm', 'waist_cm', 'abdomen_cm', 'hip_cm',
  'arm_right_cm', 'arm_left_cm', 'forearm_right_cm', 'forearm_left_cm', 'thigh_right_cm', 'thigh_left_cm', 'calf_right_cm', 'calf_left_cm',
  'triceps_mm', 'subscapular_mm', 'chest_fold_mm', 'midaxillary_mm', 'suprailiac_mm', 'abdominal_fold_mm', 'thigh_fold_mm', 'calf_fold_mm',
] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];

export const orderedMeasures = (m: Record<string, number>): [MeasureKey, number][] =>
  MEASURE_KEYS.filter((k) => m[k] !== undefined).map((k) => [k, m[k]]);

/** Faixas do IMC da Organização Mundial da Saúde. */
export const BMI_BANDS = [
  { key: 'under', from: 0, to: 18.5, tone: 'primary' },
  { key: 'normal', from: 18.5, to: 25, tone: 'success' },
  { key: 'over', from: 25, to: 30, tone: 'warn' },
  { key: 'ob1', from: 30, to: 35, tone: 'danger' },
  { key: 'ob2', from: 35, to: 40, tone: 'danger' },
  { key: 'ob3', from: 40, to: 100, tone: 'danger' },
] as const;
export type BmiBand = (typeof BMI_BANDS)[number];
export type ReadingTone = 'success' | 'warn' | 'danger' | 'primary' | 'neutral';

export const bmiBand = (bmi: number): BmiBand => BMI_BANDS.find((b) => bmi >= b.from && bmi < b.to) ?? BMI_BANDS[BMI_BANDS.length - 1];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Peso que dá IMC de 18,5 a 24,9 para a altura. Referência, não meta. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100;
  return { min: round1(18.5 * m * m), max: round1(24.9 * m * m) };
}

export function weightReading(weightKg: number, heightCm: number): { key: 'below' | 'above' | 'within'; tone: ReadingTone; diff: number } {
  const { min, max } = healthyWeightRange(heightCm);
  if (weightKg < min) return { key: 'below', tone: 'primary', diff: round1(min - weightKg) };
  if (weightKg > max) return { key: 'above', tone: 'warn', diff: round1(weightKg - max) };
  return { key: 'within', tone: 'success', diff: 0 };
}

/** Valor de um indicador numa avaliação. Gordura e massas preferem o que o método calculou; sem cálculo, valem as informadas. */
export const valueOf = (a: AssessmentView, key: string): number | undefined => {
  switch (key) {
    case 'bmi': return a.derived.bmi;
    case 'waist_hip_ratio': return a.derived.waist_hip_ratio;
    case 'body_fat_percent': return a.derived.body_fat_percent ?? a.measures.body_fat_percent;
    case 'fat_mass_kg': return a.derived.fat_mass_kg;
    case 'lean_mass_kg': return a.derived.lean_mass_kg ?? a.measures.lean_mass_kg;
    default: return a.measures[key];
  }
};

const TRUNK = ['neck_cm', 'shoulder_cm', 'chest_cm', 'waist_cm', 'abdomen_cm', 'hip_cm'];
const LIMBS = ['arm_right_cm', 'arm_left_cm', 'forearm_right_cm', 'forearm_left_cm', 'thigh_right_cm', 'thigh_left_cm', 'calf_right_cm', 'calf_left_cm'];

/** Soma só se a medida existir nas duas avaliações comparadas; senão a diferença seria de outra coisa. */
function commonSum(a: AssessmentView, b: AssessmentView, keys: string[]): { from: number; to: number } | null {
  const shared = keys.filter((k) => a.measures[k] !== undefined && b.measures[k] !== undefined);
  if (!shared.length) return null;
  return { from: shared.reduce((s, k) => s + a.measures[k], 0), to: shared.reduce((s, k) => s + b.measures[k], 0) };
}

/** Diferença já formatada com sinal ("+1,2 kg"). O separador decimal segue o idioma de quem chama. */
export function delta(from: number | undefined, to: number | undefined, unit: string, fmt: (n: number) => string): string | null {
  if (from === undefined || to === undefined) return null;
  const value = round1(to - from);
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${fmt(Math.abs(value))}${unit ? ` ${unit}` : ''}`;
}

/** Tempo entre duas datas em meses e dias. */
export function elapsed(fromDate: string, toDate: string): { months: number; days: number } {
  const a = new Date(`${fromDate}T12:00:00Z`);
  const b = new Date(`${toDate}T12:00:00Z`);
  /** Mesmo dia do mês `months` depois, sem passar do fim do mês (31/01 + 1 mês = 28/02). */
  const anchor = (months: number) => {
    const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + months, 1, 12));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
    first.setUTCDate(Math.min(a.getUTCDate(), last));
    return first;
  };
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (anchor(months) > b) months -= 1;
  return { months, days: Math.round((b.getTime() - anchor(months).getTime()) / 86400000) };
}

export type SummaryRow = { key: 'time' | 'weight' | 'bmi' | 'fat' | 'fatMass' | 'leanMass' | 'trunk' | 'limbs'; last: string | null; overall: string | null };

/** "Último" compara a última avaliação com a anterior; "Geral" compara com a primeira. Sem duas avaliações, não há resumo. */
export function summaryRows(items: AssessmentView[], fmt: (n: number) => string, time: (d: { months: number; days: number }) => string): SummaryRow[] {
  if (items.length < 2) return [];
  const first = items[0];
  const prev = items[items.length - 2];
  const last = items[items.length - 1];
  const both = (key: SummaryRow['key'], pick: (a: AssessmentView) => number | undefined, unit: string): SummaryRow | null => {
    const l = delta(pick(prev), pick(last), unit, fmt);
    const o = delta(pick(first), pick(last), unit, fmt);
    return l || o ? { key, last: l, overall: o } : null;
  };
  const sums = (key: SummaryRow['key'], keys: string[]): SummaryRow | null => {
    const l = commonSum(prev, last, keys);
    const o = commonSum(first, last, keys);
    const t = (v: { from: number; to: number } | null) => (v ? delta(v.from, v.to, 'cm', fmt) : null);
    return l || o ? { key, last: t(l), overall: t(o) } : null;
  };
  return [
    { key: 'time' as const, last: time(elapsed(prev.assessed_on, last.assessed_on)), overall: time(elapsed(first.assessed_on, last.assessed_on)) },
    both('weight', (a) => a.measures.weight_kg, 'kg'),
    both('bmi', (a) => a.derived.bmi, ''),
    both('fat', (a) => valueOf(a, 'body_fat_percent'), '%'),
    both('fatMass', (a) => valueOf(a, 'fat_mass_kg'), 'kg'),
    both('leanMass', (a) => valueOf(a, 'lean_mass_kg'), 'kg'),
    sums('trunk', TRUNK),
    sums('limbs', LIMBS),
  ].filter((r): r is SummaryRow => r !== null);
}

export type ChartDef = { key: string; unit: string };
export const CHART_GROUPS: { id: 'composition' | 'trunk' | 'limbs' | 'folds'; charts: ChartDef[] }[] = [
  { id: 'composition', charts: [{ key: 'weight_kg', unit: 'kg' }, { key: 'bmi', unit: '' }, { key: 'body_fat_percent', unit: '%' }, { key: 'fat_mass_kg', unit: 'kg' }, { key: 'lean_mass_kg', unit: 'kg' }] },
  { id: 'trunk', charts: ['neck_cm', 'shoulder_cm', 'chest_cm', 'waist_cm', 'abdomen_cm', 'hip_cm'].map((key) => ({ key, unit: 'cm' })).concat([{ key: 'waist_hip_ratio', unit: '' }]) },
  { id: 'limbs', charts: LIMBS.map((key) => ({ key, unit: 'cm' })) },
  { id: 'folds', charts: ['triceps_mm', 'subscapular_mm', 'chest_fold_mm', 'midaxillary_mm', 'suprailiac_mm', 'abdominal_fold_mm', 'thigh_fold_mm', 'calf_fold_mm'].map((key) => ({ key, unit: 'mm' })) },
];

/** Série de um indicador ao longo das avaliações, na ordem do tempo. */
export const seriesOf = (items: AssessmentView[], key: string): { date: string; value: number }[] =>
  items.flatMap((a) => {
    const value = valueOf(a, key);
    return value === undefined ? [] : [{ date: a.assessed_on, value }];
  });
