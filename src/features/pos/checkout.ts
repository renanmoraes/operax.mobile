import { locale } from '@/src/i18n';
import type { CartLine } from './cart';
import type { CreatePosSalePayload, PosPaymentMethod } from '@/src/shared/api/pos.api';

/**
 * Contas do receber, separadas da tela para ter teste. Valores em reais com 2 casas (igual ao web);
 * o servidor recalcula tudo no fechamento, então aqui só se decide o que a tela mostra e se o botão
 * "Confirmar" pode acender.
 */

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Número digitado com vírgula ou ponto e até 4 casas; nulo enquanto não é um número. */
export function decimalDigitado(raw: string): number | null {
  const n = raw.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(n)) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/** Moeda é sempre real; o idioma só muda a pontuação. */
export function formatMoney(reais: number): string {
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'BRL' }).format(round2(reais));
}

/** Valor sem o "R$", para dentro de campo. */
export function moneyPlain(reais: number): string {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(round2(reais));
}

/** Quilos mostrados em gramas, com uma casa só quando existe ("735", "120,5"). */
export function gramsText(kg: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(Math.round(kg * 10000) / 10);
}

export function quantityText(q: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 4 }).format(q);
}

// ---------- Teclado numérico ----------

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'del' | 'clear';

/**
 * Uma tecla no valor do teclado grande. `decimals` é quantas casas depois da vírgula valem (0 tira a
 * vírgula); `maxInt` limita os dígitos inteiros para ninguém digitar 9999999 g sem querer.
 */
export function keypadPress(value: string, key: KeypadKey, decimals: number, maxInt = 6): string {
  if (key === 'clear') return '';
  if (key === 'del') return value.slice(0, -1);
  if (key === ',') {
    if (decimals === 0 || value.includes(',')) return value;
    return value === '' ? '0,' : `${value},`;
  }
  const [int, dec] = value.split(',');
  if (dec !== undefined) return dec.length >= decimals ? value : value + key;
  if (int === '0') return key;
  if (int.length >= maxInt) return value;
  return value + key;
}

/** O valor do teclado como número (aceita "0," no meio da digitação). */
export function keypadNumber(value: string): number | null {
  if (!value) return null;
  return decimalDigitado(value.endsWith(',') ? value.slice(0, -1) : value);
}

// ---------- Pagamento ----------

export type PaymentRow = {
  id: string;
  method: PosPaymentMethod;
  /** Valor desta forma, em reais. Com uma forma só, é sempre o total. */
  amount: number;
  /** Só no dinheiro: quanto o cliente entregou, para a tela calcular o troco. Não vai ao servidor. */
  tendered?: number | null;
};

export type CheckoutInput = {
  payments: PaymentRow[];
  total: number;
  /** Saldo de crédito do cliente, em centavos. */
  creditCents: number;
  installments: number;
  firstDueDate: string;
};

export function checkoutState({ payments, total, creditCents, installments, firstDueDate }: CheckoutInput) {
  const sum = round2(payments.reduce((s, p) => s + (p.amount || 0), 0));
  const closes = payments.length > 0 && Math.abs(sum - total) < 0.005;
  const creditUsedCents = Math.round(payments.filter((p) => p.method === 'store_credit').reduce((s, p) => s + p.amount, 0) * 100);
  const creditOver = creditUsedCents > creditCents;
  const hasOnAccount = payments.some((p) => p.method === 'on_account');
  const onAccountReady = !hasOnAccount || (installments > 0 && /^\d{4}-\d{2}-\d{2}$/.test(firstDueDate));
  const missing = round2(total - sum);
  return { sum, closes, missing, creditOver, hasOnAccount, onAccountReady, canConfirm: closes && onAccountReady && !creditOver };
}

/** Troco do dinheiro: o que o cliente entregou menos a parte em dinheiro. Nulo sem valor entregue. */
export function changeDue(row: PaymentRow): number | null {
  if (row.method !== 'cash' || row.tendered == null) return null;
  return round2(row.tendered - row.amount);
}

/** Notas para tocar e preencher o "recebido": o próprio valor e as notas logo acima dele. */
export function quickCash(amount: number): number[] {
  const notes = [5, 10, 20, 50, 100, 200];
  const out = new Set<number>([round2(amount)]);
  for (const n of notes) {
    const up = Math.ceil(amount / n) * n;
    if (up > amount) out.add(up);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Ao acrescentar uma forma, a nova já nasce com o que falta (o operador quase sempre divide
 * "o resto no Pix"); sem nada faltando, nasce zerada.
 */
export function addPaymentRow(rows: PaymentRow[], total: number, method: PosPaymentMethod, id: string): PaymentRow[] {
  const sum = rows.reduce((s, p) => s + p.amount, 0);
  return [...rows, { id, method, amount: Math.max(0, round2(total - sum)), tendered: null }];
}

/** Com uma forma só, o valor dela acompanha o total (desconto mexido depois de abrir o receber). */
export function syncSingle(rows: PaymentRow[], total: number): PaymentRow[] {
  if (rows.length !== 1 || rows[0].amount === total) return rows;
  return [{ ...rows[0], amount: total }];
}

/** Anda meses numa data "AAAA-MM-DD" mantendo o dia (31 vira o último dia do mês curto). */
export function shiftMonth(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const days = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, days);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Data local de hoje em "AAAA-MM-DD" (sem `toISOString`, que daria o dia em UTC). */
export function todayYmd(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function buildSalePayload(input: {
  saleKey: string;
  cart: CartLine[];
  sellerId: string | null;
  contactId: string | null;
  registerId: string | null;
  orderDiscount: { type: 'percent' | 'fixed'; value: number } | null;
  payments: PaymentRow[];
  installments: number;
  firstDueDate: string;
}): CreatePosSalePayload {
  const onAccount = input.payments.some((p) => p.method === 'on_account');
  return {
    idempotency_key: input.saleKey,
    seller_user_id: input.sellerId || null,
    contact_id: input.contactId,
    register_id: input.registerId ?? undefined,
    items: input.cart.map((l) => ({
      variant_id: l.variant_id,
      quantity: l.quantity as number,
      discount_type: l.discount_type,
      discount_value: l.discount_value,
    })),
    order_discount_type: input.orderDiscount?.type ?? null,
    order_discount_value: input.orderDiscount?.value ?? null,
    payments: input.payments.map((p) => ({ method: p.method, amount: round2(p.amount) })),
    on_account: onAccount ? { installments: input.installments || 1, first_due_date: input.firstDueDate } : undefined,
  };
}

/** Id curto para chave de venda e de linha (o RN não tem `crypto.randomUUID` em todo aparelho). */
export function uid(): string {
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${((Math.random() * 4) | 8).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}
