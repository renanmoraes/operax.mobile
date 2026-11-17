import type { CreateProductInput, ProductCondition, StockControl } from '@/src/shared/api/catalog.api';
import type { UploadFile } from '@/src/shared/api/upload';
import { birthToIso } from '@/src/features/pos/signup';
import { EMPTY_FISCAL, fiscalPayload, fiscalProblem, type Fiscal } from './fiscal';
import { measureOf, variationProblem, type Option, type VariationRow } from './variations';

/** Código do lote que guarda o saldo inicial quando o cadastro traz a validade (igual ao do Operax web). */
export const INITIAL_LOT = 'SALDO-INICIAL';

/** Como o produto é vendido: em peso ou medida aceita fração, o resto só inteiro. */
export const UNITS = ['UN', 'KG', 'G', 'L', 'ML', 'M'] as const;
export type Unit = (typeof UNITS)[number];
export const byMeasure = (unit: string): boolean => ['KG', 'G', 'L', 'ML', 'M'].includes(unit.trim().toUpperCase());

export const CONDITIONS: ProductCondition[] = ['new', 'used', 'refurbished'];

export type Draft = {
  name: string;
  description: string;
  brand: string;
  sku: string;
  barcode: string;
  categoryId: string;
  priceCents: number;
  costCents: number;
  unit: Unit;
  /** A empresa tem o Estoque e a pessoa pode mexer nele: o produto passa a controlar saldo. */
  withStock: boolean;
  control: StockControl;
  /** Texto digitado (vírgula ou ponto). */
  initialQty: string;
  /** dd/mm/aaaa, opcional; preenchida, o produto passa a controlar por lote. */
  expires: string;
  reorder: string;
  /** Embalagem e anúncio: peso em gramas e medidas em cm. */
  condition: ProductCondition;
  weight: string;
  height: string;
  width: string;
  length: string;
  fiscal: Fiscal;
  /** Entra na lista do nó "Mostrar produtos" do fluxo do WhatsApp. */
  inWorkflow: boolean;
  /** É plano de associado: vender no PDV abre contrato (só com o app Associados). */
  memberPlan: boolean;
  options: Option[];
  /** Sugestões e atalhos de cada opção (vêm do modelo escolhido e dos valores digitados), para a tela de variações lembrar. */
  hints: Record<string, { suggestions: string[]; shortcuts: { label: string; values: string[] }[] }>;
  rows: VariationRow[];
  cover: UploadFile | null;
  gallery: UploadFile[];
};

export const EMPTY_DRAFT: Draft = {
  name: '', description: '', brand: '', sku: '', barcode: '', categoryId: '', priceCents: 0, costCents: 0, unit: 'UN',
  withStock: false, control: 'tracked', initialQty: '', expires: '', reorder: '',
  condition: 'new', weight: '', height: '', width: '', length: '', fiscal: EMPTY_FISCAL, inWorkflow: false, memberPlan: false,
  options: [], hints: {}, rows: [], cover: null, gallery: [],
};

/** "12,5" ou "12.5" → 12.5; vazio ou inválido → null. */
export function parseQty(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** O saldo inicial do cadastro só vale para o controle comum: lote e série entram por Movimentos. */
export const acceptsInitialBalance = (control: StockControl): boolean => control === 'tracked';

export const hasVariations = (d: Pick<Draft, 'rows'>): boolean => d.rows.length > 0;

const FAR_FUTURE = new Date(8640000000000000);

/** Só o controle comum aceita validade no cadastro, e só sem variações; ela troca o controle para "por lote". */
export function expiryIso(d: Pick<Draft, 'withStock' | 'control' | 'expires' | 'rows'>): string {
  if (!d.withStock || d.control !== 'tracked' || !d.expires.trim() || d.rows.length > 0) return '';
  return birthToIso(d.expires, FAR_FUTURE) ?? '';
}

export function effectiveControl(d: Pick<Draft, 'withStock' | 'control' | 'expires' | 'rows'>): StockControl {
  return expiryIso(d) ? 'lot_tracked' : d.control;
}

export type Problem = { key: string; params?: Record<string, string | number> };

/** O que o servidor recusaria, dito antes de criar qualquer coisa. */
export function problemOf(d: Draft): Problem | null {
  if (d.name.trim().length < 2) return { key: 'name' };
  const fiscal = fiscalProblem(d.fiscal);
  if (fiscal) return { key: fiscal };
  for (const field of ['weight', 'height', 'width', 'length'] as const) {
    const raw = d[field];
    if (!raw.trim()) continue;
    const n = measureOf(raw);
    if (n == null || !Number.isFinite(n) || n <= 0) return { key: 'productMeasure', params: { field } };
  }
  const v = variationProblem(d.rows);
  if (v) {
    if (v.code === 'limit') return { key: 'limit', params: { count: v.value } };
    if (v.code === 'dupSku' || v.code === 'dupBarcode') return { key: v.code, params: { value: v.value } };
    if (v.code === 'negPrice') return { key: 'negPrice', params: { name: v.name } };
    const m = v as { name: string; field: string };
    return { key: v.code, params: { name: m.name, field: m.field } };
  }
  if (d.withStock) {
    if (d.initialQty.trim() && d.rows.length === 0) {
      const q = parseQty(d.initialQty);
      if (q == null || q <= 0) return { key: 'qty' };
      if (!byMeasure(d.unit) && !Number.isInteger(q)) return { key: 'qtyInt' };
    }
    for (const r of d.rows) {
      if (!r.stock.trim()) continue;
      const q = parseQty(r.stock);
      if (q == null || q <= 0) return { key: 'qtyRow', params: { name: r.name } };
      if (!byMeasure(d.unit) && !Number.isInteger(q)) return { key: 'qtyIntRow', params: { name: r.name } };
    }
    if (d.expires.trim() && d.rows.length === 0 && !birthToIso(d.expires, FAR_FUTURE)) return { key: 'expires' };
    if (d.reorder.trim()) {
      const r = parseQty(d.reorder);
      if (r == null || r < 0) return { key: 'reorder' };
    }
  }
  return null;
}

export function toCreateInput(d: Draft): CreateProductInput {
  const text = (v: string) => v.trim() || undefined;
  return {
    name: d.name.trim(),
    description: text(d.description),
    sku: text(d.sku),
    // Com variações, o código de barras é de cada uma: um só para o produto inteiro identificaria a variação errada no leitor.
    barcode: d.rows.length > 0 ? undefined : text(d.barcode),
    category_id: d.categoryId || undefined,
    base_price: d.priceCents > 0 ? d.priceCents / 100 : undefined,
    reference_cost: d.costCents > 0 && d.rows.length === 0 ? d.costCents / 100 : undefined,
    unit_code: d.unit,
    ...(d.withStock ? { stock_policy: effectiveControl(d) } : {}),
    ...fiscalPayload(d.fiscal),
  };
}

/** Marca, condição, medidas, fluxo e plano: só existem como edição, porque o produto nasce comum. */
export function complementOf(d: Draft, opts: { associates: boolean }) {
  const n = (v: string) => (v.trim() ? measureOf(v) : null);
  const out: Record<string, unknown> = {};
  if (d.brand.trim()) out.brand_name = d.brand.trim();
  if (d.condition !== 'new') out.product_condition = d.condition;
  if (n(d.weight) != null) out.weight_grams = n(d.weight);
  if (n(d.height) != null) out.height_cm = n(d.height);
  if (n(d.width) != null) out.width_cm = n(d.width);
  if (n(d.length) != null) out.length_cm = n(d.length);
  if (d.inWorkflow) out.show_in_workflow = true;
  if (opts.associates && d.memberPlan) out.is_member_plan = true;
  return out;
}
