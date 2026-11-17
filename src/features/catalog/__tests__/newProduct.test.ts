import { EMPTY_DRAFT, effectiveControl, expiryIso, parseQty, problemOf, toCreateInput, type Draft } from '../newProduct';

const base = (over: Partial<Draft> = {}): Draft => ({ ...EMPTY_DRAFT, name: 'Café 500g', ...over });

describe('cadastro de produto pelo celular', () => {
  it('lê quantidade com vírgula ou ponto', () => {
    expect(parseQty('12,5')).toBe(12.5);
    expect(parseQty('3')).toBe(3);
    expect(parseQty('')).toBeNull();
    expect(parseQty('abc')).toBeNull();
  });

  it('pede nome e recusa quantidade inválida só quando tem estoque', () => {
    expect(problemOf(base({ name: ' a ' }))).toBe('name');
    expect(problemOf(base())).toBeNull();
    expect(problemOf(base({ initialQty: '-2' }))).toBeNull(); // sem estoque o saldo nem é lido
    expect(problemOf(base({ withStock: true, initialQty: '-2' }))).toBe('qty');
    expect(problemOf(base({ withStock: true, initialQty: '1,5' }))).toBe('qtyInt');
    expect(problemOf(base({ withStock: true, unit: 'KG', initialQty: '1,5' }))).toBeNull();
    expect(problemOf(base({ withStock: true, reorder: '-1' }))).toBe('reorder');
    expect(problemOf(base({ withStock: true, expires: '31/02/2027' }))).toBe('expires');
  });

  it('validade troca o controle comum para por lote, e só no controle comum', () => {
    const d = base({ withStock: true, expires: '15/12/2027' });
    expect(expiryIso(d)).toBe('2027-12-15');
    expect(effectiveControl(d)).toBe('lot_tracked');
    expect(effectiveControl({ ...d, control: 'serial_tracked' })).toBe('serial_tracked');
    expect(expiryIso({ ...d, withStock: false })).toBe('');
  });

  it('monta o corpo do cadastro em reais e sem campos vazios', () => {
    expect(toCreateInput(base({ priceCents: 1250, sku: '  ', unit: 'KG' }))).toEqual({
      name: 'Café 500g', description: undefined, sku: undefined, barcode: undefined, category_id: undefined,
      base_price: 12.5, reference_cost: undefined, unit_code: 'KG',
    });
    expect(toCreateInput(base({ withStock: true, control: 'tracked', expires: '15/12/2027' })).stock_policy).toBe('lot_tracked');
    expect(toCreateInput(base({ withStock: false })).stock_policy).toBeUndefined();
  });
});
