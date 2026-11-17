import type { UploadFile } from '@/src/shared/api/upload';

/** Mesmo teto do servidor: acima disso a grade é recusada. */
export const GRID_LIMIT = 120;
/** A capa mais 9, como o produto. */
export const MAX_VARIATION_PHOTOS = 10;
export const MAX_PRODUCT_PHOTOS = 10;

/** Uma opção do produto (Tamanho, Cor, Voltagem...) e os valores escolhidos. */
export type Option = { name: string; values: string[] };

/** Uma variação como texto de formulário (cada campo do que se digita no celular). */
export type VariationRow = {
  /** Chave da combinação: não muda quando a pessoa edita o nome. */
  key: string;
  name: string;
  attributes: Record<string, string>;
  priceCents: number;
  costCents: number;
  sku: string;
  barcode: string;
  weight: string;
  height: string;
  width: string;
  length: string;
  /** Saldo inicial desta variação. */
  stock: string;
  active: boolean;
  photos: UploadFile[];
};

/** Chave de comparação, a mesma do servidor: sem acento, sem maiúscula, sem espaço sobrando. */
export const keyOf = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** "gg" vira "GG"; número e cor ficam como foram digitados. */
export function tidyValue(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return /^[a-z]{1,4}$/i.test(clean) ? clean.toUpperCase() : clean;
}

/** Sem vazio e sem repetição (ignora maiúscula e acento), na ordem digitada. */
export function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const k = keyOf(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export function newRow(name: string, attributes: Record<string, string>): VariationRow {
  return {
    key: keyOf(name), name, attributes, priceCents: 0, costCents: 0, sku: '', barcode: '', weight: '', height: '', width: '', length: '',
    stock: '', active: true, photos: [],
  };
}

/** Cada combinação das opções com valor, na ordem das opções: "P / Preto". */
export function combinations(options: Option[]): { name: string; attributes: Record<string, string> }[] {
  const used = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (used.length === 0) return [];
  return used
    .reduce<[string, string][][]>((acc, opt) => acc.flatMap((partial) => opt.values.map((v) => [...partial, [opt.name.trim(), v] as [string, string]])), [[]])
    .map((combo) => ({ name: combo.map(([, v]) => v).join(' / '), attributes: Object.fromEntries(combo) }));
}

/**
 * Ajusta a tabela ao que a pessoa escolheu nas opções: a combinação que saiu some, a que entrou aparece vazia
 * e o que já foi preenchido numa linha continua quando a pessoa volta e muda as opções.
 */
export function syncRows(rows: VariationRow[], options: Option[]): VariationRow[] {
  const current = new Map(rows.map((r) => [r.key, r]));
  return combinations(options).map((c) => current.get(keyOf(c.name)) ?? newRow(c.name, c.attributes));
}

export type VariationProblem =
  | { code: 'limit'; value: number }
  | { code: 'dupSku' | 'dupBarcode'; value: string }
  | { code: 'negPrice'; name: string }
  | { code: 'measure' | 'weightInt'; name: string; field: 'weight' | 'height' | 'width' | 'length' };

/** Texto de peso ou medida para número: vazio é `null`, vírgula vale como ponto, o resto que não é número é `NaN`. */
export function measureOf(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  return Number(clean);
}

/** O que o servidor recusaria, dito antes de gravar qualquer coisa. */
export function variationProblem(rows: VariationRow[]): VariationProblem | null {
  if (rows.length > GRID_LIMIT) return { code: 'limit', value: GRID_LIMIT };
  const skus = new Set<string>();
  const codes = new Set<string>();
  for (const r of rows) {
    const sku = r.sku.trim().toUpperCase();
    if (sku) {
      if (skus.has(sku)) return { code: 'dupSku', value: sku };
      skus.add(sku);
    }
    const code = r.barcode.trim();
    if (code) {
      if (codes.has(code)) return { code: 'dupBarcode', value: code };
      codes.add(code);
    }
    for (const field of ['weight', 'height', 'width', 'length'] as const) {
      const n = measureOf(r[field]);
      if (n === null) continue;
      if (!Number.isFinite(n) || n <= 0) return { code: 'measure', name: r.name, field };
      if (field === 'weight' && !Number.isInteger(n)) return { code: 'weightInt', name: r.name, field };
    }
  }
  return null;
}

/** O que cada variação nova leva além do nome: só o que foi preenchido. */
export type VariantFields = {
  sku?: string;
  barcode?: string;
  sale_price?: number;
  reference_cost?: number;
  weight_grams?: number;
  height_cm?: number;
  width_cm?: number;
  length_cm?: number;
};
export function variantFields(r: VariationRow, canSeeCost: boolean): VariantFields {
  const f: VariantFields = {};
  if (r.sku.trim()) f.sku = r.sku.trim();
  if (r.barcode.trim()) f.barcode = r.barcode.trim();
  if (r.priceCents > 0) f.sale_price = r.priceCents / 100;
  if (canSeeCost && r.costCents > 0) f.reference_cost = r.costCents / 100;
  const w = measureOf(r.weight);
  if (w !== null) f.weight_grams = w;
  const h = measureOf(r.height);
  if (h !== null) f.height_cm = h;
  const wd = measureOf(r.width);
  if (wd !== null) f.width_cm = wd;
  const l = measureOf(r.length);
  if (l !== null) f.length_cm = l;
  return f;
}

/** Linha com algo preenchido além do nome (para o resumo mostrar que tem dado, sem abrir). */
export const rowHasData = (r: VariationRow): boolean =>
  r.priceCents > 0 || r.costCents > 0 || !!r.sku.trim() || !!r.barcode.trim() || !!r.stock.trim() || r.photos.length > 0 || !!(r.weight || r.height || r.width || r.length) || !r.active;

/** Só as opções e os valores que as linhas usam, na ordem das opções (o que a grade recebe). */
export function gridAttributes(options: Option[], rows: VariationRow[]): { name: string; values: string[] }[] {
  return options
    .map((o) => ({
      name: o.name.trim(),
      values: o.values.filter((v) => rows.some((r) => keyOf(r.attributes[o.name.trim()] ?? '') === keyOf(v))),
    }))
    .filter((a) => a.name && a.values.length > 0);
}
