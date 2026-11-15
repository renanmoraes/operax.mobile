import { api } from './client';
import { appendUpload } from './upload';
import type { PosProduct } from '@/src/features/pos/cart';

/**
 * PDV (venda em campo): as mesmas rotas do PDV do Operax web (`/api/apps/pos/*`), protegidas pelo app
 * `pos` instalado e pelas permissões `pos:*`. O servidor recalcula preço e oferta no fechamento; a
 * chave da venda (`idempotency_key`) impede venda em dobro quando a internet falha no meio.
 */

export type { PosProduct };

export type PosPaymentMethod = 'cash' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other' | 'on_account' | 'store_credit';

/** Formas que o operador escolhe sempre (crediário e crédito do cliente dependem do cliente). */
export const BASE_PAYMENT_METHODS: PosPaymentMethod[] = ['cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer', 'other'];

export type PosShift = {
  id: string;
  register_id: string;
  register_name: string | null;
  status: 'open' | 'closed';
  opened_at: string;
  opened_by_name: string | null;
  opening_cash_cents: number;
  expected_cash_cents: number;
  sales_count: number;
  sales_total_cents: number;
};

export type PosBootstrap = {
  settings: {
    on_account_enabled: boolean;
    max_discount_percent_without_approval: number | null;
    shifts_enabled: boolean;
    individual_cashier_shifts_enabled: boolean;
    show_offer_expiry: boolean;
  } | null;
  /** Caixa aberto deste operador/terminal; nulo com a abertura desligada ou o caixa fechado. */
  shift: PosShift | null;
  default_register_id: string | null;
  registers: { id: string; name: string; code: string }[];
  sellers: { id: string; name: string }[];
  operator_user_id: string;
};

export async function fetchPosBootstrap(): Promise<PosBootstrap> {
  const { data } = await api.get<PosBootstrap>('/api/apps/pos/bootstrap');
  return data;
}

export async function searchPosProducts(q: string): Promise<PosProduct[]> {
  const { data } = await api.get<PosProduct[]>('/api/apps/pos/products', { params: { q } });
  return data;
}

/** Preço e oferta de agora das variações do carrinho (a oferta pode ter acabado com o carrinho aberto). */
export async function refreshPosProducts(variantIds: string[]): Promise<PosProduct[]> {
  const { data } = await api.post<PosProduct[]>('/api/apps/pos/products/refresh', { variant_ids: [...new Set(variantIds)] });
  return data;
}

/** Código lido pela câmera (EAN, SKU, etiqueta de balança). Etiqueta de balança já volta com a quantidade. */
export async function resolvePosBarcode(code: string): Promise<PosProduct & { quantity: number | null }> {
  const { data } = await api.post('/api/apps/pos/barcodes/resolve', { code });
  return data;
}

/** QR da etiqueta do estoque do Operax: `{app:'operax-inventory', variant_id}`. */
export function variantFromLabelQr(raw: string): string | null {
  if (!raw.trim().startsWith('{')) return null;
  try {
    const qr = JSON.parse(raw) as { app?: string; variant_id?: string };
    return qr.app === 'operax-inventory' && qr.variant_id ? qr.variant_id : null;
  } catch {
    return null;
  }
}

export type PosContact = { id: string; name: string; phone?: string | null; document_number?: string | null; email?: string | null };

export async function searchPosContacts(q: string): Promise<PosContact[]> {
  if (!q.trim()) return [];
  const { data } = await api.get<{ data: { id: string; name: string | null; phone_e164?: string | null; document_number?: string | null; email?: string | null }[] }>('/api/contacts', {
    params: { search: q, limit: 8 },
  });
  return (data.data ?? []).map((c) => ({ id: c.id, name: c.name ?? '', phone: c.phone_e164 ?? null, document_number: c.document_number ?? null, email: c.email ?? null }));
}

export async function fetchContactCredit(contactId: string): Promise<{ balance_cents: number }> {
  const { data } = await api.get(`/api/apps/pos/contacts/${contactId}/credit`);
  return { balance_cents: data?.balance_cents ?? 0 };
}

export async function openPosShift(registerId: string, openingCash: number): Promise<PosShift> {
  const { data } = await api.post(`/api/apps/pos/registers/${registerId}/shifts/open`, { opening_cash: openingCash });
  return data;
}

export type PosSaleItemInput = {
  variant_id: string;
  quantity: number;
  discount_type?: 'percent' | 'fixed' | 'price_override' | 'total_override' | null;
  discount_value?: number | null;
};

export type CreatePosSalePayload = {
  idempotency_key: string;
  items: PosSaleItemInput[];
  contact_id?: string | null;
  seller_user_id?: string | null;
  register_id?: string | null;
  order_discount_type?: 'percent' | 'fixed' | null;
  order_discount_value?: number | null;
  payments: { method: PosPaymentMethod; amount: number }[];
  on_account?: { installments: number; first_due_date: string };
};

export type PosSaleCreated = {
  id: string;
  human_number?: string | null;
  amount: number;
  member_contracts?: { id: string; number: string; plan_name: string | null; monthly_cents: number | null; contact_id: string }[];
};

export async function createPosSale(payload: CreatePosSalePayload): Promise<PosSaleCreated> {
  const { data } = await api.post('/api/apps/pos/sales', payload);
  return data;
}

export type PosReceipt = {
  sale_id: string;
  human_number: string | null;
  origin_label?: string;
  situacao?: string | null;
  created_at: string;
  contact_name: string | null;
  agent_name: string | null;
  gross_amount: number;
  discount_amount: number;
  amount: number;
  items: { name: string; quantity: number; unit_price: number; line_total: number; list_unit_price?: number | null; offer_label?: string | null; offer_valid_until?: string | null }[];
  installments: { number: number; amount_cents: number; due_date: string }[];
  payments: { method: string; amount_cents: number }[];
  footer: string;
  reprint: boolean;
  installment_total?: number;
  company_name: string;
};

export async function fetchPosReceipt(saleId: string): Promise<PosReceipt> {
  const { data } = await api.get<PosReceipt>(`/api/apps/pos/sales/${saleId}/receipt`);
  return data;
}

export type PosSaleRow = {
  id: string;
  created_at: string;
  human_number?: string | null;
  status?: 'completed' | 'voided' | 'partially_refunded' | 'refunded';
  contact_id: string | null;
  contact_name: string | null;
  agent_name: string | null;
  amount: number;
  items: { name: string; quantity: number }[];
};

export async function fetchPosSales(params: { from: string; to: string; page?: number; page_size?: number }) {
  const { data } = await api.get<{ rows: PosSaleRow[]; total: number; page: number; page_size: number }>('/api/apps/pos/sales', { params });
  return data;
}

export async function voidPosSale(saleId: string, reason: string) {
  const { data } = await api.post(`/api/apps/pos/sales/${saleId}/void`, { reason });
  return data;
}

export type PosPaymentSnapshot = {
  sale_id: string;
  method: PosPaymentMethod | 'mixed' | null;
  installments: number;
  first_due_date: string | null;
  editable: boolean;
  blocked_reason: string | null;
};

export async function fetchPosSalePayment(saleId: string): Promise<PosPaymentSnapshot> {
  const { data } = await api.get<PosPaymentSnapshot>(`/api/apps/pos/sales/${saleId}/payment`);
  return data;
}

/** Mensagem do servidor (a validação do Nest manda lista), ou nula para a tela usar a sua. */
export function apiMessage(e: unknown): string | null {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join(' ') || null;
  return typeof m === 'string' && m.trim() ? m : null;
}

export function apiStatus(e: unknown): number | null {
  return (e as { response?: { status?: number } })?.response?.status ?? null;
}

// ---------- Cadastro de cliente na venda ----------

export type NewContactInput = {
  name: string;
  /** Só dígitos com DDI ("5511999990000"); o servidor normaliza. */
  phone: string;
  email?: string;
  document_number?: string;
  birth_date?: string;
  sex?: 'female' | 'male';
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
};

export async function createPosContact(input: NewContactInput): Promise<PosContact> {
  const { phone, ...rest } = input;
  const body = Object.fromEntries(Object.entries({ ...rest, wa_id: phone, phone_e164: phone, source: 'pos', lifecycle_stage: 'customer' }).filter(([, v]) => v !== undefined && v !== ''));
  const { data } = await api.post('/api/contacts', body);
  return { id: data.id, name: data.name ?? input.name, phone: data.phone_e164 ?? phone, document_number: data.document_number ?? null };
}

/** Foto do documento: multipart com o arquivo da câmera/galeria. */
export async function uploadContactDocument(contactId: string, file: { uri: string; name: string; type: string }, description?: string) {
  const form = new FormData();
  // No navegador o descritor { uri, name, type } viraria "[object Object]": o helper lê o arquivo como Blob.
  await appendUpload(form, 'file', file);
  const { data } = await api.post(`/api/contacts/${contactId}/documents/upload`, form, {
    params: description ? { description } : undefined,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function recordContactConsent(contactId: string, input: { consent_type: 'marketing' | 'service' | 'all'; status: 'opted_in' | 'opted_out'; channel?: 'whatsapp' | 'email'; source_description?: string }) {
  const { data } = await api.post(`/api/contacts/${contactId}/consents`, input);
  return data;
}

// ---------- Comprovante pela empresa ----------

export type ReceiptChannel = 'whatsapp' | 'email';

export type ReceiptSendResult = {
  channel: ReceiptChannel;
  to: string;
  /** `session`: mensagem normal (janela de 24 h aberta). `template`: modelo aprovado (janela fechada). */
  via: 'session' | 'template' | 'email';
};

/** Manda o comprovante pelo WhatsApp ou pelo e-mail da empresa, para o cliente da venda (ou outro destino). */
export async function sendPosReceipt(saleId: string, input: { channel: ReceiptChannel; to?: string }): Promise<ReceiptSendResult> {
  const { data } = await api.post<ReceiptSendResult>(`/api/apps/pos/sales/${saleId}/receipt/send`, input);
  return data;
}

export async function updatePosSalePayment(saleId: string, input: { method: PosPaymentMethod; contact_id?: string; installments?: number; first_due_date?: string }) {
  const { data } = await api.patch<PosPaymentSnapshot>(`/api/apps/pos/sales/${saleId}/payment`, input);
  return data;
}
