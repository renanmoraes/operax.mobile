import { locale } from '@/src/i18n';

/**
 * Carrinho do PDV (mesma conta do Operax web, `operax-frontend/src/apps/pos/lib/cart.ts`).
 * Carrinho do balcão. Estado local puro: o servidor recalcula tudo no
 * fechamento, então o que vive aqui é só o que o operador precisa ver enquanto
 * monta a venda.
 *
 * O total daqui e o total do backend têm que bater no centavo — se divergirem,
 * o cliente vê um valor na tela e outro no comprovante. Por isso o
 * arredondamento é por linha, igual ao `round2` do core.
 */

/** Oferta valendo agora para o produto, vinda do preço efetivo do Estoque. */
export interface PosOffer {
  promotion_id: string;
  /** O texto que o cliente vê. Nunca fala de validade. */
  label: string;
  /** Até quantas unidades vale o preço de oferta (o que resta do lote); nulo = sem limite. */
  limit_quantity: number | null;
  /** Validade do lote em oferta; só vem com o interruptor "mostrar validade" ligado. */
  valid_until: string | null;
  /** As unidades que passam de `limit_quantity` saem por esta oferta; sem ela, pelo preço de tabela. */
  beyond_limit?: { promotion_id: string; label: string; unit_price: number } | null;
}

export interface PosProduct {
  variant_id: string;
  item_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_code: string;
  /** O preço cobrado por unidade: o de oferta, se há oferta valendo, ou o normal. */
  unit_price: number;
  /** O preço normal (de tabela). Sem ele vale o `unit_price`. */
  list_price?: number;
  offer?: PosOffer | null;
  is_weighed: boolean;
}

export interface CartLine extends PosProduct {
  /** Identidade da linha na tela. Dois pesos do mesmo queijo são linhas
   *  diferentes, então o `variant_id` não serve de chave. */
  line_id: string;
  /** Nulo enquanto o produto por peso não foi pesado. */
  quantity: number | null;
  discount_type: 'percent' | 'fixed' | 'price_override' | 'total_override' | null;
  discount_value: number | null;
}

function pick(foto: CartLine): Pick<CartLine, 'unit_price' | 'list_price' | 'offer'> {
  return { unit_price: foto.unit_price, list_price: foto.list_price, offer: foto.offer };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type DescontoDaLinha = 'percent' | 'fixed' | 'price_override' | 'total_override';

interface ParteDaLinha {
  quantity: number;
  unit_price: number;
  discount_type: DescontoDaLinha | null;
  discount_value: number | null;
}

/** Total da linha depois do desconto. Espelha `applyLineDiscount` do servidor. */
function liquidoDaParte(parte: ParteDaLinha): number {
  const gross = round2(parte.quantity * parte.unit_price);
  if (!parte.discount_type || parte.discount_value == null) return gross;
  if (parte.discount_type === 'price_override') return round2(parte.quantity * parte.discount_value);
  if (parte.discount_type === 'total_override') return round2(parte.discount_value);
  const raw =
    parte.discount_type === 'percent' ? round2((gross * parte.discount_value) / 100) : round2(parte.discount_value);
  return round2(gross - Math.min(raw, gross));
}

/**
 * Total de uma linha sozinha, sem olhar o resto do carrinho. Serve para linha sem oferta ou com
 * oferta sem limite; com limite de unidades, quem manda é `detalhesDoCarrinho`, porque o limite é
 * gasto linha a linha.
 */
export function lineNetTotal(line: CartLine): number {
  if (line.quantity == null) return 0;
  return liquidoDaParte({
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_type: line.discount_type,
    discount_value: line.discount_value,
  });
}

export function setLineDiscount(
  cart: CartLine[],
  lineId: string,
  type: 'percent' | 'fixed' | 'price_override' | 'total_override' | null,
  value: number | null,
): CartLine[] {
  return cart.map((line) =>
    line.line_id === lineId ? { ...line, discount_type: type, discount_value: value } : line,
  );
}

export function cartTotal(cart: CartLine[]): number {
  return round2(precificarCarrinho(cart).reduce((sum, parte) => sum + liquidoDaParte(parte), 0));
}

// ---------------------------------------------------------------------------------------------
// Oferta no carrinho
//
// Espelha `dividirLinhasPelaOferta` (operax-backend/src/apps/inventory-catalog/oferta-da-linha.util.ts): só as unidades
// do lote em oferta saem pelo preço de oferta, as demais pelo normal, e a linha se divide em duas, a
// de oferta primeiro. A mesma conta no servidor e aqui faz o total da tela bater com o cupom.

export interface ParteDoCarrinho extends ParteDaLinha {
  /** Posição, no carrinho, da linha de onde esta saiu. */
  origem: number;
  list_unit_price: number;
  offer_label: string | null;
  offer_promotion_id: string | null;
}

/** Décimos de milésimo, a precisão da quantidade: sem perder centavo de grama em soma de decimal. */
const ESCALA = 10_000;

/**
 * O servidor tem um preço e uma oferta por variação, valendo para todas as linhas dela. Aqui vale o da
 * linha mais recente da variação: bipar de novo traz o preço de agora, e as linhas anteriores o seguem.
 */
function fotoPorVariacao(cart: CartLine[]): Map<string, CartLine> {
  const fotos = new Map<string, CartLine>();
  for (const line of cart) fotos.set(line.variant_id, line);
  return fotos;
}

/** Quanto do lote em oferta ainda resta antes da linha `ate`, em unidades da variação dela. */
export function restanteDaOfertaAntes(cart: CartLine[], ate: number): number {
  const alvo = cart[ate];
  const oferta = fotoPorVariacao(cart).get(alvo.variant_id)?.offer ?? null;
  if (!oferta || oferta.limit_quantity == null) return Number.POSITIVE_INFINITY;
  const limite = alvo.is_weighed ? oferta.limit_quantity : Math.floor(oferta.limit_quantity);
  const gasto = cart
    .slice(0, ate)
    .filter((l) => l.variant_id === alvo.variant_id && l.quantity != null && l.quantity > 0)
    .reduce((soma, l) => soma + (l.quantity as number), 0);
  return Math.max(0, limite - gasto);
}

export function precificarCarrinho(cart: CartLine[]): ParteDoCarrinho[] {
  const restante = new Map<string, number>();
  const partes: ParteDoCarrinho[] = [];
  const fotos = fotoPorVariacao(cart);

  for (const [origem, linha] of cart.entries()) {
    if (linha.quantity == null || !(linha.quantity > 0)) continue;
    const quantidade: number = linha.quantity;
    // Preço, tabela e oferta são os da variação (a foto mais recente); quantidade e desconto, os da linha.
    const line: CartLine = { ...linha, ...pick(fotos.get(linha.variant_id) ?? linha) };
    const tabela = line.list_price ?? line.unit_price;
    const tipo = line.discount_type;
    const valor = line.discount_value;
    const precoCombinado = tipo === 'price_override' || tipo === 'total_override';
    const oferta = line.offer ?? null;

    const normal = (quantity: number, discountValue: number | null): ParteDoCarrinho => ({
      origem,
      quantity,
      unit_price: tabela,
      list_unit_price: tabela,
      offer_label: null,
      offer_promotion_id: null,
      discount_type: tipo,
      discount_value: discountValue,
    });

    // As unidades que não cabem na oferta do lote: a melhor oferta que não é de lote, ou o preço de tabela.
    const fora = oferta?.beyond_limit ?? null;
    const resto = (quantity: number, discountValue: number | null): ParteDoCarrinho =>
      fora
        ? {
            origem,
            quantity,
            unit_price: fora.unit_price,
            list_unit_price: tabela,
            offer_label: fora.label,
            offer_promotion_id: fora.promotion_id,
            discount_type: tipo,
            discount_value: discountValue,
          }
        : normal(quantity, discountValue);

    if (!oferta) {
      partes.push(normal(quantidade, valor));
      continue;
    }

    if (!restante.has(line.variant_id)) {
      const limite =
        oferta.limit_quantity == null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, Math.round((line.is_weighed ? oferta.limit_quantity : Math.floor(oferta.limit_quantity)) * ESCALA));
      restante.set(line.variant_id, limite);
    }
    const total = Math.round(quantidade * ESCALA);
    const emOferta = Math.min(total, restante.get(line.variant_id) as number);
    restante.set(line.variant_id, (restante.get(line.variant_id) as number) - emOferta);

    // Preço combinado à mão vale na linha inteira, mas as unidades saem do mesmo lote: gastam o limite.
    if (precoCombinado) {
      partes.push(normal(quantidade, valor));
      continue;
    }
    const quantidadeEmOferta = emOferta / ESCALA;
    const quantidadeNormal = (total - emOferta) / ESCALA;

    const comOferta = (quantity: number, discountValue: number | null): ParteDoCarrinho => ({
      origem,
      quantity,
      unit_price: line.unit_price,
      list_unit_price: tabela,
      offer_label: oferta.label,
      offer_promotion_id: oferta.promotion_id,
      discount_type: tipo,
      discount_value: discountValue,
    });

    if (emOferta === 0) {
      partes.push(resto(quantidade, valor));
    } else if (quantidadeNormal === 0) {
      partes.push(comOferta(quantidade, valor));
    } else {
      let valorDaOferta = valor;
      let valorDoNormal = valor;
      if (tipo === 'fixed' && valor != null) {
        const brutoDaOferta = round2(quantidadeEmOferta * line.unit_price);
        const brutoDoNormal = round2(quantidadeNormal * (fora?.unit_price ?? tabela));
        const brutoTotal = brutoDaOferta + brutoDoNormal;
        valorDoNormal = brutoTotal > 0 ? round2((valor * brutoDoNormal) / brutoTotal) : 0;
        valorDaOferta = round2(valor - valorDoNormal);
      }
      partes.push(comOferta(quantidadeEmOferta, valorDaOferta));
      partes.push(resto(quantidadeNormal, valorDoNormal));
    }
  }
  return partes;
}

/** O que a tela mostra de cada linha do carrinho: se tem oferta, se se dividiu e os valores. */
export interface DetalheDaLinha {
  emOferta: boolean;
  /** A quantidade passou do lote em oferta: parte pelo preço de oferta, parte pelo normal. */
  dividida: boolean;
  rotulo: string | null;
  partes: ParteDoCarrinho[];
  /** Soma de quantidade × preço cobrado, antes do desconto manual. */
  bruto: number;
  /** Soma de quantidade × preço de tabela: o "de" riscado ao lado do "por". */
  tabela: number;
  /** O que a linha cobra, com o desconto manual. */
  liquido: number;
}

export function detalhesDoCarrinho(cart: CartLine[]): Map<string, DetalheDaLinha> {
  const partes = precificarCarrinho(cart);
  const detalhes = new Map<string, DetalheDaLinha>();
  for (const [origem, line] of cart.entries()) {
    const daLinha = partes.filter((p) => p.origem === origem);
    const emOferta = daLinha.some((p) => p.offer_label != null);
    detalhes.set(line.line_id, {
      emOferta,
      dividida: daLinha.length > 1,
      rotulo: daLinha.find((p) => p.offer_label != null)?.offer_label ?? null,
      partes: daLinha,
      bruto: round2(daLinha.reduce((soma, p) => soma + round2(p.quantity * p.unit_price), 0)),
      tabela: round2(daLinha.reduce((soma, p) => soma + round2(p.quantity * p.list_unit_price), 0)),
      liquido: round2(daLinha.reduce((soma, p) => soma + liquidoDaParte(p), 0)),
    });
  }
  return detalhes;
}

export function cartTotalWithOrderDiscount(
  cart: CartLine[],
  type: 'percent' | 'fixed' | null,
  value: number | null,
): number {
  const linesTotal = cartTotal(cart);
  if (!type || value == null) return linesTotal;
  const raw = type === 'percent' ? round2((linesTotal * value) / 100) : round2(value);
  return round2(linesTotal - Math.min(raw, linesTotal));
}

let sequence = 0;
function nextLineId(): string {
  sequence += 1;
  return `linha-${sequence}`;
}

/**
 * Produto por unidade soma na linha que já existe: bipar cinco vezes o mesmo
 * refrigerante tem que virar "5x", não cinco linhas de um.
 *
 * Produto por peso nunca soma — cada pesagem é um evento distinto, e juntar
 * 0,735 kg com 0,42 kg apagaria o que foi pesado em cada uma.
 */
export function addToCart(
  cart: CartLine[],
  product: PosProduct,
  quantity: number | null,
): CartLine[] {
  if (!product.is_weighed) {
    const index = cart.findIndex((line) => line.variant_id === product.variant_id);
    if (index >= 0) {
      const next = [...cart];
      next[index] = {
        ...next[index],
        ...pick(product as CartLine),
        quantity: (next[index].quantity ?? 0) + (quantity ?? 1),
      };
      return next;
    }
  }

  return [
    ...cart,
    { ...product, line_id: nextLineId(), quantity, discount_type: null, discount_value: null },
  ];
}

/** Zerar a quantidade é como o operador tira o item: sem confirmar nada. */
export function changeQuantity(
  cart: CartLine[],
  lineId: string,
  quantity: number | null,
): CartLine[] {
  if (quantity != null && quantity <= 0) return removeLine(cart, lineId);
  return cart.map((line) => (line.line_id === lineId ? { ...line, quantity } : line));
}

export function removeLine(cart: CartLine[], lineId: string): CartLine[] {
  return cart.filter((line) => line.line_id !== lineId);
}

/** Só fecha venda com tudo pesado e nada zerado. */
export function isCartReady(cart: CartLine[]): boolean {
  return cart.length > 0 && cart.every((line) => (line.quantity ?? 0) > 0);
}

/** Quantidade formatada com a casa decimal que a unidade pede. */
export function formatQuantity(line: CartLine): string {
  if (line.quantity == null) return '—';
  if (!line.is_weighed) return String(line.quantity);
  return line.quantity.toLocaleString(locale(), {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/** Produto em quilo: no balcão se fala em gramas, não em "0,250 kg". */
export function vendidoEmQuilo(line: Pick<PosProduct, 'unit_code' | 'is_weighed'>): boolean {
  return line.is_weighed && line.unit_code.trim().toLowerCase() === 'kg';
}

/**
 * Quanto pesar para dar o valor pedido ("me vê R$ 10 de queijo").
 *
 * A quantidade tem quatro casas (a coluna é numeric(14,4)) e o total da linha
 * é arredondado no centavo, então a divisão pura pode fechar um centavo acima
 * ou abaixo. Entre a quantidade calculada e as vizinhas, fica a que fecha
 * exatamente no valor pedido; sem nenhuma exata, a mais próxima dele.
 */
export function quantidadePeloValor(valor: number, unitPrice: number): number | null {
  if (!(valor > 0) || !(unitPrice > 0)) return null;
  const base = Math.round((valor / unitPrice) * 10000);
  let melhor: number | null = null;
  let menorDiferenca = Infinity;
  for (const passo of [0, -1, 1, -2, 2]) {
    const quantidade = (base + passo) / 10000;
    if (quantidade <= 0) continue;
    const diferenca = Math.abs(round2(quantidade * unitPrice) - valor);
    if (diferenca < menorDiferenca - 1e-9) {
      melhor = quantidade;
      menorDiferenca = diferenca;
    }
  }
  return melhor;
}

/**
 * Troca o preço, a tabela e a oferta de cada linha pelos que o servidor devolveu agora. `mudou` diz se
 * alguma coisa que o operador via mudou (preço cobrado ou oferta), para a tela avisar.
 */
export function atualizarPrecos(
  cart: CartLine[],
  produtos: Pick<PosProduct, 'variant_id' | 'unit_price' | 'list_price' | 'offer'>[],
): { cart: CartLine[]; mudou: boolean } {
  const porVariacao = new Map(produtos.map((p) => [p.variant_id, p]));
  let mudou = false;
  const next = cart.map((line) => {
    const novo = porVariacao.get(line.variant_id);
    if (!novo) return line;
    const mesmaOferta =
      (line.offer?.promotion_id ?? null) === (novo.offer?.promotion_id ?? null) &&
      (line.offer?.limit_quantity ?? null) === (novo.offer?.limit_quantity ?? null) &&
      (line.offer?.beyond_limit?.unit_price ?? null) === (novo.offer?.beyond_limit?.unit_price ?? null);
    if (line.unit_price !== novo.unit_price || (line.list_price ?? line.unit_price) !== (novo.list_price ?? novo.unit_price) || !mesmaOferta) {
      mudou = true;
    }
    return { ...line, unit_price: novo.unit_price, list_price: novo.list_price, offer: novo.offer ?? null };
  });
  return { cart: next, mudou };
}

/**
 * Quanto pesar para dar o valor pedido, levando em conta a oferta: as primeiras unidades, até o que resta do
 * lote em oferta, saem pelo preço de oferta e o resto pelo normal. Com preço combinado à mão vale o combinado.
 */
export function quantidadePeloValorNaLinha(cart: CartLine[], lineId: string, valor: number): number | null {
  const indice = cart.findIndex((l) => l.line_id === lineId);
  if (indice < 0) return null;
  const linha = cart[indice];
  if (linha.discount_type === 'price_override' && linha.discount_value != null && linha.discount_value > 0) {
    return quantidadePeloValor(valor, linha.discount_value);
  }
  const foto = fotoPorVariacao(cart).get(linha.variant_id) ?? linha;
  const tabela = foto.list_price ?? foto.unit_price;
  const restante = restanteDaOfertaAntes(cart, indice);
  // Passou do limite do lote, o resto sai pela melhor oferta que não é de lote, ou pela tabela.
  const precoDoResto = foto.offer?.beyond_limit?.unit_price ?? tabela;
  if (!foto.offer || restante === 0) return quantidadePeloValor(valor, precoDoResto);
  if (!Number.isFinite(restante)) return quantidadePeloValor(valor, foto.unit_price);

  const valorDaOferta = round2(restante * foto.unit_price);
  if (valor <= valorDaOferta) return quantidadePeloValor(valor, foto.unit_price);

  const resto = quantidadePeloValor(round2(valor - valorDaOferta), precoDoResto);
  if (resto == null) return null;
  const base = Math.round((restante + resto) * 10000);
  // O total da linha é a soma das duas partes, cada uma arredondada no centavo: procura a quantidade
  // vizinha que fecha exatamente no valor pedido, ou a mais próxima.
  const brutoCom = (q: number) => round2(restante * foto.unit_price) + round2((q - restante) * precoDoResto);
  let melhor = base / 10000;
  let menor = Infinity;
  for (const passo of [0, -1, 1, -2, 2]) {
    const q = (base + passo) / 10000;
    const diferenca = Math.abs(round2(brutoCom(q)) - valor);
    if (diferenca < menor - 1e-9) {
      melhor = q;
      menor = diferenca;
    }
  }
  return melhor;
}
