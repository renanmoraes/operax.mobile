import { addToCart, type PosProduct } from '../cart';
import {
  addPaymentRow,
  buildSalePayload,
  changeDue,
  checkoutState,
  decimalDigitado,
  gramsText,
  keypadNumber,
  keypadPress,
  quickCash,
  shiftMonth,
  syncSingle,
  todayYmd,
  type PaymentRow,
} from '../checkout';
import { receiptFileName, receiptHtml } from '../receiptHtml';
import { birthToIso, cpfValid, maskCpf, maskPhone, phoneForServer } from '../signup';

const row = (p: Partial<PaymentRow>): PaymentRow => ({ id: 'r', method: 'cash', amount: 0, tendered: null, ...p });

describe('teclado da pesagem', () => {
  it('gramas com uma casa: 7, 3, 5 vira 735 e a vírgula aceita uma casa só', () => {
    let v = '';
    for (const k of ['7', '3', '5', ',', '4', '9'] as const) v = keypadPress(v, k, 1);
    expect(v).toBe('735,4');
    expect(keypadNumber(v)).toBe(735.4);
  });

  it('zero à esquerda some e vírgula no começo vira "0,"', () => {
    expect(keypadPress('0', '5', 2)).toBe('5');
    expect(keypadPress('', ',', 2)).toBe('0,');
    expect(keypadNumber('0,')).toBe(0);
  });

  it('sem casas decimais a vírgula não entra; apagar e limpar', () => {
    expect(keypadPress('12', ',', 0)).toBe('12');
    expect(keypadPress('12', 'del', 0)).toBe('1');
    expect(keypadPress('12', 'clear', 0)).toBe('');
  });

  it('limita os dígitos inteiros', () => {
    expect(keypadPress('99999', '9', 1, 5)).toBe('99999');
  });

  it('número digitado aceita vírgula ou ponto e recusa lixo', () => {
    expect(decimalDigitado('10,5')).toBe(10.5);
    expect(decimalDigitado('10.5')).toBe(10.5);
    expect(decimalDigitado('1,2,3')).toBeNull();
    expect(decimalDigitado('abc')).toBeNull();
  });

  it('quilo mostrado em gramas', () => {
    expect(gramsText(0.735)).toBe('735');
    expect(gramsText(0.1205)).toBe('120,5');
  });
});

describe('receber', () => {
  const base = { total: 100, creditCents: 0, installments: 1, firstDueDate: '2026-12-15' };

  it('uma forma que fecha o total libera o confirmar', () => {
    const s = checkoutState({ ...base, payments: [row({ amount: 100 })] });
    expect(s.closes).toBe(true);
    expect(s.canConfirm).toBe(true);
  });

  it('formas divididas precisam fechar no centavo', () => {
    expect(checkoutState({ ...base, payments: [row({ amount: 60 }), row({ id: 'b', method: 'pix', amount: 39.99 })] }).canConfirm).toBe(false);
    expect(checkoutState({ ...base, payments: [row({ amount: 60 }), row({ id: 'b', method: 'pix', amount: 40 })] }).canConfirm).toBe(true);
  });

  it('crédito do cliente não passa do saldo', () => {
    const s = checkoutState({ ...base, creditCents: 2500, payments: [row({ method: 'store_credit', amount: 30 }), row({ id: 'b', amount: 70 })] });
    expect(s.creditOver).toBe(true);
    expect(s.canConfirm).toBe(false);
  });

  it('crediário precisa de parcelas e data', () => {
    expect(checkoutState({ ...base, firstDueDate: '', payments: [row({ method: 'on_account', amount: 100 })] }).canConfirm).toBe(false);
    expect(checkoutState({ ...base, installments: 3, payments: [row({ method: 'on_account', amount: 100 })] }).canConfirm).toBe(true);
  });

  it('troco é o entregue menos a parte em dinheiro; sem valor entregue não há troco', () => {
    expect(changeDue(row({ amount: 37.5, tendered: 50 }))).toBe(12.5);
    expect(changeDue(row({ amount: 37.5, tendered: 20 }))).toBe(-17.5);
    expect(changeDue(row({ amount: 37.5 }))).toBeNull();
    expect(changeDue(row({ method: 'pix', amount: 37.5, tendered: 50 }))).toBeNull();
  });

  it('notas rápidas: o valor certo e as notas logo acima', () => {
    expect(quickCash(37.5)).toEqual([37.5, 40, 50, 100]);
    expect(quickCash(50)).toEqual([50, 60, 100, 200]);
  });

  it('nova forma nasce com o que falta', () => {
    const rows = addPaymentRow([row({ amount: 60 })], 100, 'pix', 'b');
    expect(rows[1]).toMatchObject({ method: 'pix', amount: 40 });
    expect(addPaymentRow([row({ amount: 100 })], 100, 'pix', 'b')[1].amount).toBe(0);
  });

  it('com uma forma só o valor acompanha o total', () => {
    expect(syncSingle([row({ amount: 100 })], 90)[0].amount).toBe(90);
    const two = [row({ amount: 50 }), row({ id: 'b', amount: 50 })];
    expect(syncSingle(two, 90)).toBe(two);
  });
});

describe('datas', () => {
  it('anda meses mantendo o dia e encurta no mês curto', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
    expect(shiftMonth('2026-03-10', -1)).toBe('2026-02-10');
  });

  it('hoje pelo relógio local', () => {
    expect(todayYmd(new Date(2026, 10, 15, 23, 30))).toBe('2026-11-15');
  });
});

describe('payload da venda', () => {
  const queijo: PosProduct = { variant_id: 'v1', item_id: 'i1', name: 'Queijo', sku: null, barcode: null, unit_code: 'kg', unit_price: 40, is_weighed: true };
  it('manda itens, desconto, pagamentos e crediário só quando há crediário', () => {
    const cart = addToCart([], queijo, 0.25);
    const p = buildSalePayload({
      saleKey: 'k',
      cart,
      sellerId: 's',
      contactId: null,
      registerId: 'r',
      orderDiscount: { type: 'percent', value: 10 },
      payments: [row({ amount: 9 })],
      installments: 2,
      firstDueDate: '2026-12-15',
    });
    expect(p).toMatchObject({ idempotency_key: 'k', seller_user_id: 's', register_id: 'r', order_discount_type: 'percent', order_discount_value: 10 });
    expect(p.items).toEqual([{ variant_id: 'v1', quantity: 0.25, discount_type: null, discount_value: null }]);
    expect(p.on_account).toBeUndefined();
    const fiado = buildSalePayload({ saleKey: 'k', cart, sellerId: null, contactId: 'c', registerId: null, orderDiscount: null, payments: [row({ method: 'on_account', amount: 10 })], installments: 2, firstDueDate: '2026-12-15' });
    expect(fiado.on_account).toEqual({ installments: 2, first_due_date: '2026-12-15' });
    expect(fiado.register_id).toBeUndefined();
  });
});

describe('cadastro rápido', () => {
  it('CPF com dígito verificador', () => {
    expect(cpfValid('529.982.247-25')).toBe(true);
    expect(cpfValid('529.982.247-26')).toBe(false);
    expect(cpfValid('111.111.111-11')).toBe(false);
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
  });

  it('telefone com DDD vira 55… para o servidor', () => {
    expect(phoneForServer('(11) 98765-4321')).toBe('5511987654321');
    expect(phoneForServer('+55 11 98765-4321')).toBe('5511987654321');
    expect(phoneForServer('98765-4321')).toBeNull();
    expect(phoneForServer('+351 912 345 678')).toBe('351912345678');
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
    expect(maskPhone('+5511987654321')).toBe('(11) 98765-4321');
  });

  it('data de nascimento', () => {
    const now = new Date(2026, 10, 15);
    expect(birthToIso('31/12/1990', now)).toBe('1990-12-31');
    expect(birthToIso('31/02/1990', now)).toBeNull();
    expect(birthToIso('01/01/2030', now)).toBeNull();
  });
});

describe('comprovante em PDF', () => {
  const t = (k: string, o?: Record<string, unknown>) => (o?.number ? `${k}:${o.number}` : k);
  const r = {
    sale_id: 'abcdef123456',
    human_number: 'V-1041',
    created_at: '2026-11-15T15:30:00.000Z',
    contact_name: 'Ana <b>',
    agent_name: 'Você',
    gross_amount: 50,
    discount_amount: 5,
    amount: 45,
    items: [{ name: 'Queijo', quantity: 0.25, unit_price: 40, line_total: 10, offer_label: 'Oferta' }],
    installments: [],
    payments: [{ method: 'pix', amount_cents: 4500 }],
    footer: 'Volte sempre',
    reprint: false,
    company_name: 'Empório & Cia',
  };

  it('escapa o que vem do cadastro e traz itens, desconto e pagamento', () => {
    const html = receiptHtml(r, t);
    expect(html).toContain('Empório &amp; Cia');
    expect(html).toContain('Ana &lt;b&gt;');
    expect(html).not.toContain('Ana <b>');
    expect(html).toContain('receipt.number:V-1041');
    expect(html).toContain('methods.pix');
    expect(html).toContain('receipt.discount');
  });

  it('nome do arquivo pelo número da venda', () => {
    expect(receiptFileName(r, 'comprovante')).toBe('comprovante-V-1041.pdf');
    expect(receiptFileName({ ...r, human_number: null }, 'comprovante')).toBe('comprovante-abcdef12.pdf');
  });
});
