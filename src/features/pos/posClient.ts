import { useAuth } from '@/src/features/auth/AuthContext';
import * as live from '@/src/shared/api/pos.api';
import type {
  CreatePosSalePayload,
  NewContactInput,
  PosBootstrap,
  PosContact,
  PosPaymentSnapshot,
  PosProduct,
  PosReceipt,
  PosSaleCreated,
  PosSaleRow,
  PosShift,
  ReceiptChannel,
  ReceiptSendResult,
} from '@/src/shared/api/pos.api';
import { addToCart, detalhesDoCarrinho, setLineDiscount, type CartLine } from './cart';
import { round2 } from './checkout';

/**
 * As chamadas do PDV, do servidor (login real) ou da demonstração (sem servidor). A tela não sabe
 * qual está usando; a demonstração guarda as vendas na memória enquanto o app está aberto.
 */
export type PosClient = {
  bootstrap(): Promise<PosBootstrap>;
  searchProducts(q: string): Promise<PosProduct[]>;
  refreshProducts(ids: string[]): Promise<PosProduct[]>;
  resolveBarcode(code: string): Promise<PosProduct & { quantity: number | null }>;
  searchContacts(q: string): Promise<PosContact[]>;
  contactCredit(id: string): Promise<{ balance_cents: number }>;
  openShift(registerId: string, openingCash: number): Promise<PosShift>;
  createSale(p: CreatePosSalePayload): Promise<PosSaleCreated>;
  receipt(saleId: string): Promise<PosReceipt>;
  sales(params: { from: string; to: string; page?: number; page_size?: number }): Promise<{ rows: PosSaleRow[]; total: number }>;
  voidSale(saleId: string, reason: string): Promise<unknown>;
  salePayment(saleId: string): Promise<PosPaymentSnapshot>;
  updatePayment(saleId: string, input: Parameters<typeof live.updatePosSalePayment>[1]): Promise<PosPaymentSnapshot>;
  createContact(input: NewContactInput): Promise<PosContact>;
  uploadDocument(contactId: string, file: { uri: string; name: string; type: string }, description?: string): Promise<unknown>;
  recordConsent(contactId: string, input: Parameters<typeof live.recordContactConsent>[1]): Promise<unknown>;
  sendReceipt(saleId: string, input: { channel: ReceiptChannel; to?: string }): Promise<ReceiptSendResult>;
};

const liveClient: PosClient = {
  bootstrap: live.fetchPosBootstrap,
  searchProducts: live.searchPosProducts,
  refreshProducts: live.refreshPosProducts,
  resolveBarcode: live.resolvePosBarcode,
  searchContacts: live.searchPosContacts,
  contactCredit: live.fetchContactCredit,
  openShift: live.openPosShift,
  createSale: live.createPosSale,
  receipt: live.fetchPosReceipt,
  sales: live.fetchPosSales,
  voidSale: live.voidPosSale,
  salePayment: live.fetchPosSalePayment,
  updatePayment: live.updatePosSalePayment,
  createContact: live.createPosContact,
  uploadDocument: live.uploadContactDocument,
  recordConsent: live.recordContactConsent,
  sendReceipt: live.sendPosReceipt,
};

// ---------- Demonstração ----------

const P = (p: Partial<PosProduct> & Pick<PosProduct, 'variant_id' | 'name' | 'unit_price'>): PosProduct => ({
  item_id: p.variant_id,
  sku: null,
  barcode: null,
  unit_code: 'un',
  is_weighed: false,
  offer: null,
  ...p,
});

export const DEMO_PRODUCTS: PosProduct[] = [
  P({
    variant_id: 'demo-queijo',
    name: 'Queijo minas frescal',
    sku: 'QJ-MINAS',
    barcode: '2000001000007',
    unit_code: 'kg',
    is_weighed: true,
    unit_price: 39.9,
    list_price: 49.9,
    offer: { promotion_id: 'demo-promo-queijo', label: 'Oferta do dia', limit_quantity: 2, valid_until: null },
  }),
  P({ variant_id: 'demo-presunto', name: 'Presunto cozido fatiado', sku: 'PRES-01', unit_code: 'kg', is_weighed: true, unit_price: 42.5 }),
  P({ variant_id: 'demo-pao', name: 'Pão francês', sku: 'PAO-FR', barcode: '7891000100103', unit_price: 0.9 }),
  P({ variant_id: 'demo-cafe', name: 'Café torrado 500 g', sku: 'CAFE-500', barcode: '7896005800010', unit_price: 21.9 }),
  P({ variant_id: 'demo-refri', name: 'Refrigerante 2 L', sku: 'REF-2L', barcode: '7894900011517', unit_price: 11.49, list_price: 12.99, offer: { promotion_id: 'demo-promo-refri', label: 'Leve mais', limit_quantity: null, valid_until: null } }),
  P({ variant_id: 'demo-azeite', name: 'Azeite extravirgem 500 ml', sku: 'AZ-500', barcode: '5601252111018', unit_price: 34.9 }),
];

const DEMO_CONTACTS: PosContact[] = [
  { id: 'demo-c1', name: 'Mariana Souza', phone: '+5511987654321', document_number: '12345678909', email: 'mariana@exemplo.com' },
  { id: 'demo-c2', name: 'João Pereira', phone: '+5511912345678', document_number: null },
  { id: 'demo-c3', name: 'Ana Lima', phone: '+5521998887766', document_number: null },
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

type DemoSale = PosSaleRow & { receipt: PosReceipt; method: PosPaymentSnapshot['method'] };
const demo = { sales: [] as DemoSale[], seq: 1040, shiftOpen: true, contacts: [...DEMO_CONTACTS], openedAt: new Date(Date.now() - 3 * 3600_000).toISOString() };

const demoShift = (): PosShift => ({
  id: 'demo-shift',
  register_id: 'demo-reg',
  register_name: 'Caixa da rua',
  status: 'open',
  opened_at: demo.openedAt,
  opened_by_name: 'Você',
  opening_cash_cents: 10000,
  expected_cash_cents: 10000 + demo.sales.filter((s) => s.status !== 'voided').reduce((s, x) => s + Math.round(x.amount * 100), 0),
  sales_count: demo.sales.length,
  sales_total_cents: demo.sales.reduce((s, x) => s + Math.round(x.amount * 100), 0),
});

const demoClient: PosClient = {
  async bootstrap() {
    await wait(150);
    return {
      settings: { on_account_enabled: true, max_discount_percent_without_approval: 10, shifts_enabled: true, individual_cashier_shifts_enabled: false, show_offer_expiry: false },
      shift: demo.shiftOpen ? demoShift() : null,
      default_register_id: 'demo-reg',
      registers: [{ id: 'demo-reg', name: 'Caixa da rua', code: '01' }],
      sellers: [
        { id: 'demo-me', name: 'Você' },
        { id: 'demo-s2', name: 'Carla Mendes' },
      ],
      operator_user_id: 'demo-me',
    };
  },
  async searchProducts(q) {
    await wait();
    const f = fold(q);
    return DEMO_PRODUCTS.filter((p) => fold(p.name).includes(f) || fold(p.sku ?? '').includes(f) || (p.barcode ?? '') === q);
  },
  async refreshProducts(ids) {
    return DEMO_PRODUCTS.filter((p) => ids.includes(p.variant_id));
  },
  async resolveBarcode(code) {
    await wait();
    const p = DEMO_PRODUCTS.find((x) => x.barcode === code || x.sku === code);
    if (!p) throw Object.assign(new Error('not found'), { response: { status: 404, data: { message: null } } });
    return { ...p, quantity: p.is_weighed ? null : 1 };
  },
  async searchContacts(q) {
    await wait();
    const f = fold(q);
    return demo.contacts.filter((c) => fold(c.name).includes(f) || (c.phone ?? '').includes(q.replace(/\D/g, '') || '§'));
  },
  async contactCredit(id) {
    return { balance_cents: id === 'demo-c1' ? 2500 : 0 };
  },
  async openShift() {
    await wait(400);
    demo.shiftOpen = true;
    return demoShift();
  },
  async createSale(p) {
    await wait(600);
    // A mesma conta do carrinho (oferta com lote, descontos), para o comprovante bater com a tela.
    let cart: CartLine[] = [];
    for (const i of p.items) {
      const prod = DEMO_PRODUCTS.find((x) => x.variant_id === i.variant_id)!;
      cart = addToCart(cart, { ...prod, is_weighed: true }, i.quantity);
      cart = setLineDiscount(cart, cart[cart.length - 1].line_id, i.discount_type ?? null, i.discount_value ?? null);
    }
    const det = detalhesDoCarrinho(cart);
    const items = cart.map((l) => {
      const d = det.get(l.line_id)!;
      const qty = l.quantity ?? 0;
      return { name: l.name, quantity: qty, unit_price: qty ? round2(d.liquido / qty) : l.unit_price, line_total: d.liquido, offer_label: d.rotulo, list_unit_price: d.emOferta ? (l.list_price ?? null) : null };
    });
    const amount = round2(p.payments.reduce((s, x) => s + x.amount, 0));
    const gross = round2(items.reduce((s, i) => s + i.line_total, 0));
    demo.seq += 1;
    const id = `demo-sale-${demo.seq}`;
    const contact = demo.contacts.find((c) => c.id === p.contact_id) ?? null;
    const created_at = new Date().toISOString();
    const receipt: PosReceipt = {
      sale_id: id,
      human_number: `V-${demo.seq}`,
      created_at,
      contact_name: contact?.name ?? null,
      agent_name: 'Você',
      gross_amount: Math.max(gross, amount),
      discount_amount: round2(Math.max(0, gross - amount)),
      amount,
      items,
      installments: [],
      payments: p.payments.map((x) => ({ method: x.method, amount_cents: Math.round(x.amount * 100) })),
      footer: 'Obrigado pela preferência!',
      reprint: false,
      company_name: 'Empório Demonstração',
    };
    const methods = [...new Set(p.payments.map((x) => x.method))];
    demo.sales.unshift({
      id,
      created_at,
      human_number: receipt.human_number,
      status: 'completed',
      contact_id: contact?.id ?? null,
      contact_name: contact?.name ?? null,
      agent_name: 'Você',
      amount,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      receipt,
      method: methods.length === 1 ? methods[0] : 'mixed',
    });
    return { id, human_number: receipt.human_number, amount };
  },
  async receipt(saleId) {
    const s = demo.sales.find((x) => x.id === saleId);
    if (!s) throw new Error('not found');
    return { ...s.receipt, reprint: true };
  },
  async sales() {
    await wait();
    return { rows: demo.sales, total: demo.sales.length };
  },
  async voidSale(saleId) {
    await wait(400);
    const s = demo.sales.find((x) => x.id === saleId);
    if (s) s.status = 'voided';
    return {};
  },
  async salePayment(saleId) {
    const s = demo.sales.find((x) => x.id === saleId);
    return { sale_id: saleId, method: s?.method ?? 'cash', installments: 1, first_due_date: null, editable: s?.status === 'completed' && s.method !== 'mixed', blocked_reason: s?.method === 'mixed' ? 'Venda com mais de uma forma de pagamento.' : null };
  },
  async updatePayment(saleId, input) {
    await wait(400);
    const s = demo.sales.find((x) => x.id === saleId);
    if (s) s.method = input.method;
    return { sale_id: saleId, method: input.method, installments: input.installments ?? 1, first_due_date: input.first_due_date ?? null, editable: true, blocked_reason: null };
  },
  async createContact(input) {
    await wait(500);
    const c: PosContact = { id: `demo-c${demo.contacts.length + 1}`, name: input.name, phone: `+${input.phone}`, document_number: input.document_number ?? null, email: input.email ?? null };
    demo.contacts.push(c);
    return c;
  },
  async uploadDocument() {
    await wait(500);
    return {};
  },
  async recordConsent() {
    return {};
  },
  async sendReceipt(saleId, input) {
    await wait(700);
    const s = demo.sales.find((x) => x.id === saleId);
    const c = demo.contacts.find((x) => x.id === s?.contact_id);
    const to = input.to ?? (input.channel === 'email' ? c?.email : c?.phone) ?? '';
    return { channel: input.channel, to, via: input.channel === 'email' ? 'email' : 'session' };
  },
};

export function usePosClient(): PosClient {
  const { mode } = useAuth();
  return mode === 'live' ? liveClient : demoClient;
}
