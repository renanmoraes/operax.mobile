/**
 * O mesmo produto aparece na câmera com números diferentes: o UPC-A tem 12 dígitos, o mesmo código
 * lido como EAN-13 ganha um zero na frente, e a caixa vira GTIN-14. O cadastro guarda o que foi lido
 * na hora; na venda a câmera pode entregar a outra forma e o produto "some".
 *
 * Devolve o código lido e as outras formas do mesmo número, na ordem em que vale tentar.
 * Só código numérico muda; SKU e texto passam como vieram.
 */
export function barcodeVariants(raw: string): string[] {
  const code = raw.trim();
  if (!/^\d{8,14}$/.test(code)) return [code];
  const bare = code.replace(/^0+/, '');
  if (bare.length < 6) return [code];
  const forms = [code];
  for (const size of [12, 13, 8, 14]) {
    if (bare.length <= size) forms.push(bare.padStart(size, '0'));
  }
  forms.push(bare);
  return [...new Set(forms)];
}

/**
 * Procura o código lido e, se o cadastro não tem aquela forma (404 ou 400), as outras formas do mesmo
 * número. Qualquer outro erro (sem internet, servidor) sobe na hora; se nenhuma forma acha, sobe o
 * erro da leitura original.
 */
export async function resolveWithVariants<T>(
  code: string,
  resolve: (c: string) => Promise<T>,
  statusOf: (e: unknown) => number | null | undefined,
): Promise<T> {
  const [first, ...others] = barcodeVariants(code);
  const missed = (e: unknown) => {
    const st = statusOf(e);
    return st === 404 || st === 400;
  };
  try {
    return await resolve(first);
  } catch (e) {
    if (!missed(e)) throw e;
    for (const other of others) {
      try {
        return await resolve(other);
      } catch (err) {
        if (!missed(err)) throw err;
      }
    }
    throw e;
  }
}
