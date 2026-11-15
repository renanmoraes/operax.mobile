import {
  addToCart,
  atualizarPrecos,
  cartTotal,
  cartTotalWithOrderDiscount,
  changeQuantity,
  detalhesDoCarrinho,
  lineNetTotal,
  precificarCarrinho,
  quantidadePeloValor,
  quantidadePeloValorNaLinha,
  removeLine,
  setLineDiscount,
  type CartLine,
  type PosProduct,
  vendidoEmQuilo,
} from '../cart';

const leite: PosProduct = {
  variant_id: 'var-leite',
  item_id: 'item-1',
  name: 'Leite integral 1L',
  sku: 'LEITE',
  barcode: '7891000315507',
  unit_code: 'un',
  unit_price: 5.49,
  is_weighed: false,
};

const queijo: PosProduct = {
  variant_id: 'var-queijo',
  item_id: 'item-2',
  name: 'Queijo minas',
  sku: 'QUEIJO',
  barcode: null,
  unit_code: 'kg',
  unit_price: 49.9,
  is_weighed: true,
};

describe('carrinho do PDV', () => {
  it('bipar o mesmo produto duas vezes soma na mesma linha', () => {
    let cart: CartLine[] = [];
    cart = addToCart(cart, leite, 1);
    cart = addToCart(cart, leite, 1);

    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });

  it('cada pesagem vira uma linha própria, senão perde o peso individual', () => {
    let cart: CartLine[] = [];
    cart = addToCart(cart, queijo, 0.735);
    cart = addToCart(cart, queijo, 0.42);

    expect(cart).toHaveLength(2);
    expect(cart.map((l) => l.quantity)).toEqual([0.735, 0.42]);
  });

  it('calcula o total do jeito que o servidor calcula', () => {
    let cart: CartLine[] = [];
    cart = addToCart(cart, leite, 2);
    cart = addToCart(cart, queijo, 0.735);

    // 5,49 × 2 = 10,98 · 49,90 × 0,735 = 36,6765 → 36,68
    expect(cartTotal(cart)).toBe(47.66);
  });

  it('arredonda cada linha antes de somar, e não a soma no fim', () => {
    let cart: CartLine[] = [];
    cart = addToCart(cart, { ...queijo, unit_price: 0.333 }, 3);

    // 0,333 × 3 = 0,999 → 1,00 por linha
    expect(cartTotal(cart)).toBe(1);
  });

  it('mudar a quantidade recalcula a linha', () => {
    let cart = addToCart([], leite, 1);
    cart = changeQuantity(cart, cart[0].line_id, 3);

    expect(cart[0].quantity).toBe(3);
    expect(cartTotal(cart)).toBe(16.47);
  });

  it('quantidade zero ou negativa tira a linha do carrinho', () => {
    let cart = addToCart([], leite, 2);
    cart = changeQuantity(cart, cart[0].line_id, 0);

    expect(cart).toHaveLength(0);
  });

  it('remover linha não mexe nas outras', () => {
    let cart = addToCart([], leite, 1);
    cart = addToCart(cart, queijo, 1);
    cart = removeLine(cart, cart[0].line_id);

    expect(cart).toHaveLength(1);
    expect(cart[0].name).toBe('Queijo minas');
  });

  it('carrinho vazio soma zero', () => {
    expect(cartTotal([])).toBe(0);
  });

  it('produto por peso entra sem quantidade e não conta no total até ser pesado', () => {
    const cart = addToCart([], queijo, null);

    expect(cart[0].quantity).toBeNull();
    expect(cartTotal(cart)).toBe(0);
  });
});

describe('desconto no carrinho', () => {
  it('desconto percentual de linha reduz o total da linha', () => {
    let cart = addToCart([], leite, 2);
    cart = setLineDiscount(cart, cart[0].line_id, 'percent', 10);

    expect(lineNetTotal(cart[0])).toBe(9.88); // 10,98 - 10%
  });

  it('aceita o total da balança sem recalcular pelo preço do quilo', () => {
    const cart = addToCart([], queijo, 0.735);
    const ajustado = setLineDiscount(cart, cart[0].line_id, 'total_override', 36.67);
    expect(lineNetTotal(ajustado[0])).toBe(36.67);
  });

  it('remover o desconto volta ao total cheio', () => {
    let cart = addToCart([], leite, 2);
    cart = setLineDiscount(cart, cart[0].line_id, 'percent', 10);
    cart = setLineDiscount(cart, cart[0].line_id, null, null);

    expect(lineNetTotal(cart[0])).toBe(cartTotal(cart));
  });

  it('mantém o tipo enquanto o operador apaga e redigita o valor', () => {
    let cart = addToCart([], leite, 2);
    cart = setLineDiscount(cart, cart[0].line_id, 'fixed', 5);
    cart = setLineDiscount(cart, cart[0].line_id, 'fixed', null);

    expect(cart[0].discount_type).toBe('fixed');
    expect(cart[0].discount_value).toBeNull();
    expect(lineNetTotal(cart[0])).toBe(10.98);
  });

  it('desconto de pedido soma em cima do total líquido das linhas', () => {
    const cart = addToCart([], leite, 2);
    const total = cartTotalWithOrderDiscount(cart, 'fixed', 1);

    expect(total).toBe(round2Test(cartTotal(cart) - 1));
  });
});

function round2Test(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

describe('venda por peso', () => {
  it('reconhece produto em quilo, com a unidade em qualquer caixa', () => {
    expect(vendidoEmQuilo({ unit_code: 'KG', is_weighed: true })).toBe(true);
    expect(vendidoEmQuilo({ unit_code: 'kg', is_weighed: true })).toBe(true);
    expect(vendidoEmQuilo({ unit_code: 'l', is_weighed: true })).toBe(false);
    expect(vendidoEmQuilo({ unit_code: 'kg', is_weighed: false })).toBe(false);
  });

  it('calcula o peso que fecha exatamente no valor pedido', () => {
    const quantidade = quantidadePeloValor(10, 39.9)!;
    expect(Math.round(quantidade * 39.9 * 100) / 100).toBe(10);
    expect(quantidade).toBeCloseTo(0.2506, 4);
    expect(quantidadePeloValor(20, 80)).toBe(0.25);
  });

  it('não calcula sem valor ou sem preço', () => {
    expect(quantidadePeloValor(0, 40)).toBeNull();
    expect(quantidadePeloValor(10, 0)).toBeNull();
  });
});

/**
 * A mesma conta do servidor (`oferta-da-linha.util.ts`): os casos abaixo espelham os do teste de lá. Se
 * um mudar sem o outro, o total da tela diverge do cupom.
 */
describe('oferta no carrinho', () => {
  const iogurte: PosProduct = {
    variant_id: 'var-iogurte',
    item_id: 'item-3',
    name: 'Iogurte natural',
    sku: 'IOG',
    barcode: null,
    unit_code: 'un',
    unit_price: 7,
    list_price: 10,
    offer: { promotion_id: 'promo-1', label: 'Oferta', limit_quantity: 3, valid_until: null },
    is_weighed: false,
  };
  const semLimite: PosProduct = { ...iogurte, offer: { ...iogurte.offer!, limit_quantity: null } };

  it('sem oferta a linha é uma só, pelo preço de tabela', () => {
    const cart = addToCart([], leite, 2);
    const partes = precificarCarrinho(cart);
    expect(partes).toHaveLength(1);
    expect(partes[0]).toMatchObject({ quantity: 2, unit_price: 5.49, list_unit_price: 5.49, offer_label: null });
  });

  it('oferta sem limite vale para a linha inteira', () => {
    const cart = addToCart([], semLimite, 5);
    expect(precificarCarrinho(cart)).toHaveLength(1);
    expect(cartTotal(cart)).toBe(35);
  });

  it('passou do limite do lote: três em oferta, duas pelo preço normal, oferta primeiro', () => {
    const cart = addToCart([], iogurte, 5);
    const partes = precificarCarrinho(cart);
    expect(partes.map((p) => [p.quantity, p.unit_price, p.offer_label])).toEqual([
      [3, 7, 'Oferta'],
      [2, 10, null],
    ]);
    expect(cartTotal(cart)).toBe(41);
  });

  it('o limite é consumido na ordem das linhas e cada parte diz de qual linha veio', () => {
    let cart = addToCart([], iogurte, 2);
    cart = addToCart(cart, leite, 1);
    // Mesma variação em outra linha (peso/produto repetido por outro caminho): o limite segue de onde parou.
    cart = [...cart, { ...cart[0], line_id: 'outra', quantity: 3 }];
    const partes = precificarCarrinho(cart);
    expect(partes.map((p) => [p.origem, p.quantity, p.unit_price])).toEqual([
      [0, 2, 7],
      [1, 1, 5.49],
      [2, 1, 7],
      [2, 2, 10],
    ]);
  });

  it('preço combinado à mão substitui a oferta da linha, mas gasta o limite: as unidades saem do mesmo lote', () => {
    let cart = addToCart([], iogurte, 2);
    cart = setLineDiscount(cart, cart[0].line_id, 'price_override', 6);
    cart = [...cart, { ...cart[0], line_id: 'outra', quantity: 3, discount_type: null, discount_value: null }];
    const partes = precificarCarrinho(cart);
    expect(partes.map((p) => [p.quantity, p.unit_price])).toEqual([
      [2, 10],
      [1, 7],
      [2, 10],
    ]);
  });

  it('passou do lote: as unidades de fora saem pela melhor oferta que não é de lote, não pela tabela', () => {
    const comCampanha: PosProduct = {
      ...iogurte,
      offer: { ...iogurte.offer!, beyond_limit: { promotion_id: 'promo-camp', label: 'Preço especial', unit_price: 9 } },
    };
    const partes = precificarCarrinho(addToCart([], comCampanha, 5));
    expect(partes.map((p) => [p.quantity, p.unit_price, p.offer_label])).toEqual([
      [3, 7, 'Oferta'],
      [2, 9, 'Preço especial'],
    ]);
    expect(cartTotal(addToCart([], comCampanha, 5))).toBe(39);
  });

  it('produto de unidade inteira: saldo fracionado do lote não vira meia unidade em oferta', () => {
    const fracionado: PosProduct = { ...iogurte, offer: { ...iogurte.offer!, limit_quantity: 2.5 } };
    const partes = precificarCarrinho(addToCart([], fracionado, 3));
    expect(partes.map((p) => [p.quantity, p.unit_price])).toEqual([
      [2, 7],
      [1, 10],
    ]);
  });

  it('bipar de novo traz o preço e a oferta de agora para a linha e para as outras da mesma variação', () => {
    let cart = addToCart([], iogurte, 1);
    const semOferta: PosProduct = { ...iogurte, unit_price: 10, offer: null };
    cart = addToCart(cart, semOferta, 1);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ unit_price: 10, offer: null, quantity: 2 });
    expect(cartTotal(cart)).toBe(20);
  });

  it('atualizarPrecos troca o preço e a oferta pelos do servidor e diz se algo mudou', () => {
    const cart = addToCart([], iogurte, 5);
    const igual = atualizarPrecos(cart, [iogurte]);
    expect(igual.mudou).toBe(false);

    const acabou = atualizarPrecos(cart, [{ ...iogurte, unit_price: 10, offer: null }]);
    expect(acabou.mudou).toBe(true);
    expect(cartTotal(acabou.cart)).toBe(50);

    const lotesMenor = atualizarPrecos(cart, [{ ...iogurte, offer: { ...iogurte.offer!, limit_quantity: 1 } }]);
    expect(lotesMenor.mudou).toBe(true);
    expect(cartTotal(lotesMenor.cart)).toBe(47);

    // Produto que o servidor não devolveu fica como está.
    expect(atualizarPrecos(cart, []).mudou).toBe(false);
  });

  it('valor pedido em produto por peso com oferta: a primeira parte pelo preço de oferta, o resto pelo normal', () => {
    const queijoOferta: PosProduct = {
      ...queijo,
      unit_price: 30,
      list_price: 40,
      offer: { promotion_id: 'promo-q', label: 'Oferta', limit_quantity: 0.75, valid_until: null },
    };
    const cart = addToCart([], queijoOferta, null);
    // R$ 22,50 = 0,75 kg inteiros em oferta; R$ 50 passa do lote: 0,75 kg a 30 + o resto a 40.
    expect(quantidadePeloValorNaLinha(cart, cart[0].line_id, 22.5)).toBe(0.75);
    const q = quantidadePeloValorNaLinha(cart, cart[0].line_id, 50) as number;
    const cobrado = cartTotal(changeQuantity(cart, cart[0].line_id, q));
    expect(cobrado).toBe(50);
  });

  it('desconto em percentual vale nas duas partes; em reais é rateado pelo bruto com a sobra na primeira', () => {
    let cart = addToCart([], iogurte, 5);
    cart = setLineDiscount(cart, cart[0].line_id, 'percent', 10);
    expect(cartTotal(cart)).toBe(36.9);

    cart = setLineDiscount(cart, cart[0].line_id, 'fixed', 4.1);
    const partes = precificarCarrinho(cart);
    expect(partes.map((p) => p.discount_value)).toEqual([2.1, 2]);
    expect(cartTotal(cart)).toBe(36.9);
  });

  it('produto por peso: o limite aceita fração', () => {
    const queijoEmOferta: PosProduct = {
      ...queijo,
      unit_price: 30,
      list_price: 40,
      offer: { promotion_id: 'p2', label: 'Oferta', limit_quantity: 0.75, valid_until: null },
    };
    const cart = addToCart([], queijoEmOferta, 1.25);
    expect(precificarCarrinho(cart).map((p) => [p.quantity, p.unit_price])).toEqual([
      [0.75, 30],
      [0.5, 40],
    ]);
    expect(cartTotal(cart)).toBe(42.5);
  });

  it('linha sem quantidade (produto por peso ainda não pesado) não entra', () => {
    const cart = addToCart([], iogurte, null);
    expect(precificarCarrinho(cart)).toEqual([]);
    expect(cartTotal(cart)).toBe(0);
  });

  it('o detalhe da linha diz o que mostrar: em oferta, dividida, bruto, tabela e líquido', () => {
    const cart = addToCart(addToCart([], iogurte, 5), leite, 1);
    const detalhes = detalhesDoCarrinho(cart);
    expect(detalhes.get(cart[0].line_id)).toMatchObject({
      emOferta: true,
      dividida: true,
      bruto: 41,
      tabela: 50,
      liquido: 41,
      rotulo: 'Oferta',
    });
    expect(detalhes.get(cart[1].line_id)).toMatchObject({ emOferta: false, dividida: false, bruto: 5.49, liquido: 5.49, rotulo: null });
  });

  it('o carrinho sem oferta continua somando como antes', () => {
    const cart = addToCart(addToCart([], leite, 2), queijo, 0.735);
    expect(cartTotal(cart)).toBe(47.66);
  });
});
