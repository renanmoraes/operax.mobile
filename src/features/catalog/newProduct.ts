import type { CreateProductInput, StockControl } from '@/src/shared/api/catalog.api';
import { birthToIso } from '@/src/features/pos/signup';

/** Código do lote que guarda o saldo inicial quando o cadastro traz a validade (igual ao do Operax web). */
export const INITIAL_LOT = 'SALDO-INICIAL';

/** Como o produto é vendido: em peso ou medida aceita fração, o resto só inteiro. */
export const UNITS = ['UN', 'KG', 'G', 'L', 'ML', 'M'] as const;
export type Unit = (typeof UNITS)[number];
export const byMeasure = (unit: string): boolean => ['KG', 'G', 'L', 'ML', 'M'].includes(unit.trim().toUpperCase());

export type Draft = {
  name: string;
  description: string;
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
};

export const EMPTY_DRAFT: Draft = {
  name: '', description: '', sku: '', barcode: '', categoryId: '', priceCents: 0, costCents: 0, unit: 'UN',
  withStock: false, control: 'tracked', initialQty: '', expires: '', reorder: '',
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

/** Só o controle comum aceita validade no cadastro; ela troca o controle para "por lote". */
export function expiryIso(d: Pick<Draft, 'withStock' | 'control' | 'expires'>): string {
  if (!d.withStock || d.control !== 'tracked' || !d.expires.trim()) return '';
  return birthToIso(d.expires, new Date(8640000000000000)) ?? '';
}

export function effectiveControl(d: Pick<Draft, 'withStock' | 'control' | 'expires'>): StockControl {
  return expiryIso(d) ? 'lot_tracked' : d.control;
}

export type ProblemCode = 'name' | 'qty' | 'qtyInt' | 'expires' | 'reorder';

/** O que o servidor recusaria, dito antes de criar qualquer coisa. */
export function problemOf(d: Draft): ProblemCode | null {
  if (d.name.trim().length < 2) return 'name';
  if (d.withStock) {
    if (d.initialQty.trim()) {
      const q = parseQty(d.initialQty);
      if (q == null || q <= 0) return 'qty';
      if (!byMeasure(d.unit) && !Number.isInteger(q)) return 'qtyInt';
    }
    if (d.expires.trim() && !birthToIso(d.expires, new Date(8640000000000000))) return 'expires';
    if (d.reorder.trim()) {
      const r = parseQty(d.reorder);
      if (r == null || r < 0) return 'reorder';
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
    barcode: text(d.barcode),
    category_id: d.categoryId || undefined,
    base_price: d.priceCents > 0 ? d.priceCents / 100 : undefined,
    reference_cost: d.costCents > 0 ? d.costCents / 100 : undefined,
    unit_code: d.unit,
    ...(d.withStock ? { stock_policy: effectiveControl(d) } : {}),
  };
}
