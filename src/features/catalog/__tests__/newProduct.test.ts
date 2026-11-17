import { complementOf, EMPTY_DRAFT, effectiveControl, expiryIso, hasVariations, parseQty, problemOf, toCreateInput, type Draft } from '../newProduct';
import { newRow } from '../variations';

const base = (over: Partial<Draft> = {}): Draft => ({ ...EMPTY_DRAFT, name: 'Café 500g', ...over });

describe('cadastro de produto pelo celular', () => {
  it('lê quantidade com vírgula ou ponto', () => {
    expect(parseQty('12,5')).toBe(12.5);
    expect(parseQty('3')).toBe(3);
    expect(parseQty('')).toBeNull();
    expect(parseQty('abc')).toBeNull();
  });

  it('pede nome e recusa quantidade inválida só quando tem estoque', () => {
    expect(problemOf(base({ name: ' a ' }))?.key).toBe('name');
    expect(problemOf(base())).toBeNull();
    expect(problemOf(base({ initialQty: '-2' }))).toBeNull(); // sem estoque o saldo nem é lido
    expect(problemOf(base({ withStock: true, initialQty: '-2' }))?.key).toBe('qty');
    expect(problemOf(base({ withStock: true, initialQty: '1,5' }))?.key).toBe('qtyInt');
    expect(problemOf(base({ withStock: true, unit: 'KG', initialQty: '1,5' }))).toBeNull();
    expect(problemOf(base({ withStock: true, reorder: '-1' }))?.key).toBe('reorder');
    expect(problemOf(base({ withStock: true, expires: '31/02/2027' }))?.key).toBe('expires');
  });

  it('confere fiscal, medidas do produto e saldo de cada variação', () => {
    expect(problemOf(base({ fiscal: { ...EMPTY_DRAFT.fiscal, ncm: '123' } }))?.key).toBe('ncm');
    expect(problemOf(base({ weight: '0' }))).toEqual({ key: 'productMeasure', params: { field: 'weight' } });
    const rows = [{ ...newRow('P', {}), stock: '-1' }];
    expect(problemOf(base({ withStock: true, rows }))).toEqual({ key: 'qtyRow', params: { name: 'P' } });
    expect(problemOf(base({ rows: [{ ...newRow('P', {}), sku: 'A' }, { ...newRow('M', {}), sku: 'a' }] }))?.key).toBe('dupSku');
  });

  it('validade troca o controle comum para por lote, e só no controle comum e sem variações', () => {
    const d = base({ withStock: true, expires: '15/12/2027' });
    expect(expiryIso(d)).toBe('2027-12-15');
    expect(effectiveControl(d)).toBe('lot_tracked');
    expect(effectiveControl({ ...d, control: 'serial_tracked' })).toBe('serial_tracked');
    expect(expiryIso({ ...d, withStock: false })).toBe('');
    expect(expiryIso({ ...d, rows: [newRow('P', {})] })).toBe('');
  });

  it('monta o corpo do cadastro em reais, sem campos vazios e com o fiscal só se preenchido', () => {
    expect(toCreateInput(base({ priceCents: 1250, sku: '  ', unit: 'KG' }))).toEqual({
      name: 'Café 500g', description: undefined, sku: undefined, barcode: undefined, category_id: undefined,
      base_price: 12.5, reference_cost: undefined, unit_code: 'KG',
    });
    expect(toCreateInput(base({ withStock: true, control: 'tracked', expires: '15/12/2027' })).stock_policy).toBe('lot_tracked');
    expect(toCreateInput(base({ withStock: false })).stock_policy).toBeUndefined();
    expect(toCreateInput(base({ fiscal: { ...EMPTY_DRAFT.fiscal, ncm: '12345678', origin: '0' } }))).toMatchObject({ fiscal_ncm: '12345678', fiscal_origem: 0 });
  });

  it('com variações, o código de barras e o custo são de cada variação', () => {
    const d = base({ barcode: '789', costCents: 500, rows: [newRow('P', {})] });
    expect(hasVariations(d)).toBe(true);
    const body = toCreateInput(d);
    expect(body.barcode).toBeUndefined();
    expect(body.reference_cost).toBeUndefined();
  });

  it('marca, condição, medidas, fluxo e plano entram como edição, só o que foi preenchido', () => {
    expect(complementOf(base(), { associates: true })).toEqual({});
    expect(complementOf(base({ brand: ' Nike ', condition: 'used', weight: '250', height: '10,5', inWorkflow: true, memberPlan: true }), { associates: true })).toEqual({
      brand_name: 'Nike', product_condition: 'used', weight_grams: 250, height_cm: 10.5, show_in_workflow: true, is_member_plan: true,
    });
    expect(complementOf(base({ memberPlan: true }), { associates: false })).toEqual({});
  });
});
