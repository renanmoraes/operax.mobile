import { api } from './client';

/** Parcela do crediário com o encargo do dia já calculado pelo servidor (valores em centavos). */
export type Receivable = {
  id: string;
  status: 'open' | 'partial' | 'paid' | 'cancelled';
  contact_id: string;
  contact_name: string | null;
  sale_id: string;
  installment_number: number;
  installment_total: number;
  due_date: string;
  purchase_date: string | null;
  amount_cents: number;
  paid_cents: number;
  principal_cents: number;
  late_fee_cents: number;
  interest_cents: number;
  total_cents: number;
  days_late: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  restored_at: string | null;
  can_restore: boolean;
};

export type InstallmentMethod = 'cash' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other';

export const isActive = (p: Receivable) => p.status === 'open' || p.status === 'partial';
export const isOverdue = (p: Receivable) => isActive(p) && p.days_late > 0;

export async function fetchContactReceivables(contactId: string): Promise<Receivable[]> {
  const { data } = await api.get(`/api/apps/pos/contacts/${contactId}/receivables`);
  return Array.isArray(data) ? (data as Receivable[]) : [];
}

/** Recebe um valor (em reais) de uma parcela. Passou do total: o excesso vai para a próxima parcela ou vira crédito. */
export async function receiveInstallment(
  id: string,
  amount: number,
  opts: { method?: InstallmentMethod; note?: string; excess?: 'next' | 'credit' | null } = {},
) {
  const { data } = await api.post(`/api/apps/pos/installments/${id}/payments`, {
    amount,
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.excess ? { excess_mode: opts.excess } : {}),
    ...(opts.method ? { method: opts.method } : {}),
  });
  return data;
}

/** Recebe várias parcelas do mesmo cadastro de uma vez, numa ou mais formas. */
export async function receiveInstallments(
  ids: string[],
  payments: { method: InstallmentMethod; amount: number }[],
  opts: { excessToCredit?: boolean; expectedTotalCents?: number } = {},
) {
  const { data } = await api.post('/api/apps/pos/installments/batch-payments', {
    installment_ids: ids,
    payments,
    ...(opts.excessToCredit ? { excess_mode: 'credit' } : {}),
    ...(opts.expectedTotalCents ? { expected_total_cents: opts.expectedTotalCents } : {}),
  });
  return data as { receipt_id: string; total_cents: number; credit_cents: number; open_cents: number; discount_cents: number };
}

/** Quita recebendo menos: o que falta vira desconto, com justificativa. */
export async function settleWithDiscount(id: string, amount: number, reason: string, method?: InstallmentMethod) {
  const { data } = await api.post(`/api/apps/pos/installments/${id}/discount-settle`, { amount, reason, ...(method ? { method } : {}) });
  return data;
}

/** Tira a dívida da fila de cobrança (não entra no caixa). Dá para restaurar depois. */
export async function cancelReceivable(id: string, reason: string) {
  const { data } = await api.post(`/api/apps/pos/installments/${id}/cancel`, { reason });
  return data;
}

export async function restoreReceivable(id: string) {
  const { data } = await api.post(`/api/apps/pos/installments/${id}/restore`, {});
  return data;
}

export type ReceivableReceiptSummary = {
  id: string;
  kind: string;
  received_at: string;
  received_cents: number;
  discount_cents: number;
  installments_count: number;
  payments: { method: string; amount_cents: number }[];
  reversed: 'total' | 'parcial' | null;
};
export async function fetchContactReceipts(contactId: string): Promise<ReceivableReceiptSummary[]> {
  const { data } = await api.get(`/api/apps/pos/contacts/${contactId}/receivable-receipts`);
  return Array.isArray(data) ? (data as ReceivableReceiptSummary[]) : [];
}

export type PurchaseDetail = {
  sale_id: string;
  human_number: string | null;
  purchased_at: string;
  amount_cents: number;
  discount_amount_cents: number;
  installment_total: number;
  items: { name: string; quantity: string; unit_code: string | null; unit_price_cents: number; line_total_cents: number }[];
};
export async function fetchInstallmentPurchase(id: string): Promise<PurchaseDetail> {
  const { data } = await api.get(`/api/apps/pos/installments/${id}/purchase`);
  return data as PurchaseDetail;
}
