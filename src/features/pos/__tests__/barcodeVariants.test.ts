import { barcodeVariants, resolveWithVariants } from '../barcodeVariants';

describe('formas do mesmo código de barras', () => {
  it('EAN-13 com zero na frente também vale como o UPC-A de 12 dígitos', () => {
    expect(barcodeVariants('0871110682857')).toEqual(['0871110682857', '871110682857', '00871110682857']);
  });

  it('UPC-A de 12 dígitos também vale como EAN-13 e GTIN-14', () => {
    expect(barcodeVariants('871110682857')).toEqual(['871110682857', '0871110682857', '00871110682857']);
  });

  it('EAN-13 sem zero na frente só tem a forma de 14 dígitos além dele', () => {
    expect(barcodeVariants('7891234567895')).toEqual(['7891234567895', '07891234567895']);
  });

  it('SKU, texto e número curto passam como vieram', () => {
    expect(barcodeVariants('TERERE-2000-0002')).toEqual(['TERERE-2000-0002']);
    expect(barcodeVariants('12345')).toEqual(['12345']);
    expect(barcodeVariants('  ')).toEqual(['']);
  });
});

describe('procura do código lido', () => {
  const miss = (status: number) => Object.assign(new Error('x'), { status });
  const statusOf = (e: unknown) => (e as { status?: number }).status;
  const base = { '871110682857': 'Terere 2000' } as Record<string, string>;
  const resolve = jest.fn(async (c: string) => {
    if (base[c]) return base[c];
    throw miss(404);
  });
  beforeEach(() => resolve.mockClear());

  it('acha o cadastro de 12 dígitos quando a câmera entrega 13 com zero na frente', async () => {
    await expect(resolveWithVariants('0871110682857', resolve, statusOf)).resolves.toBe('Terere 2000');
    expect(resolve.mock.calls.map((c) => c[0])).toEqual(['0871110682857', '871110682857']);
  });

  it('acha na primeira quando o cadastro é igual ao lido, sem pedir à toa', async () => {
    await expect(resolveWithVariants('871110682857', resolve, statusOf)).resolves.toBe('Terere 2000');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('sem nenhuma forma cadastrada, devolve o erro da leitura original', async () => {
    await expect(resolveWithVariants('7891234567895', resolve, statusOf)).rejects.toMatchObject({ status: 404 });
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('erro de rede ou servidor não tenta as outras formas', async () => {
    const down = jest.fn(async () => { throw miss(503); });
    await expect(resolveWithVariants('0871110682857', down, statusOf)).rejects.toMatchObject({ status: 503 });
    expect(down).toHaveBeenCalledTimes(1);
  });
});
