import { combinations, gridAttributes, keyOf, newRow, syncRows, tidyValue, uniqueValues, variantFields, variationProblem, GRID_LIMIT } from '../variations';
import { companyModel, optionsOfModel, optionsToSave, READY_MODELS } from '../models';
import { fiscalPayload, fiscalProblem, EMPTY_FISCAL } from '../fiscal';

describe('variações do produto', () => {
  it('compara textos sem acento, sem maiúscula e sem espaço sobrando', () => {
    expect(keyOf('  Verão  Azul ')).toBe('verao azul');
    expect(tidyValue('gg')).toBe('GG');
    expect(tidyValue('Azul claro')).toBe('Azul claro');
    expect(uniqueValues(['P', 'p', '', 'M', 'Ç', 'c'])).toEqual(['P', 'M', 'Ç']);
  });

  it('monta cada combinação das opções, na ordem das opções', () => {
    const opts = [{ name: 'Tamanho', values: ['P', 'M'] }, { name: 'Cor', values: ['Azul', 'Preto'] }];
    expect(combinations(opts).map((c) => c.name)).toEqual(['P / Azul', 'P / Preto', 'M / Azul', 'M / Preto']);
    expect(combinations(opts)[0].attributes).toEqual({ Tamanho: 'P', Cor: 'Azul' });
    expect(combinations([{ name: 'Cor', values: [] }])).toEqual([]);
  });

  it('ao mudar as opções, a linha preenchida continua e a nova entra vazia', () => {
    const first = syncRows([], [{ name: 'Tamanho', values: ['P', 'M'] }]);
    first[0] = { ...first[0], priceCents: 1990, sku: 'CAM-P' };
    const next = syncRows(first, [{ name: 'Tamanho', values: ['P', 'G'] }]);
    expect(next.map((r) => r.name)).toEqual(['P', 'G']);
    expect(next[0].priceCents).toBe(1990);
    expect(next[1].priceCents).toBe(0);
  });

  it('recusa SKU e código repetidos, medida inválida e grade grande demais', () => {
    const a = { ...newRow('P', {}), sku: 'abc', barcode: '789' };
    const b = { ...newRow('M', {}), sku: 'ABC' };
    expect(variationProblem([a, b])).toEqual({ code: 'dupSku', value: 'ABC' });
    expect(variationProblem([a, { ...newRow('M', {}), barcode: '789' }])).toEqual({ code: 'dupBarcode', value: '789' });
    expect(variationProblem([{ ...a, height: '0' }])).toEqual({ code: 'measure', name: 'P', field: 'height' });
    expect(variationProblem([{ ...a, weight: '10,5' }])).toEqual({ code: 'weightInt', name: 'P', field: 'weight' });
    expect(variationProblem([a, { ...newRow('M', {}), sku: 'x' }])).toBeNull();
    expect(variationProblem(Array.from({ length: GRID_LIMIT + 1 }, (_, i) => newRow(String(i), {})))).toEqual({ code: 'limit', value: GRID_LIMIT });
  });

  it('leva só o que foi preenchido, e o custo só para quem pode ver', () => {
    const r = { ...newRow('P', {}), priceCents: 1990, costCents: 800, barcode: ' 789 ', weight: '250', height: '10,5' };
    expect(variantFields(r, true)).toEqual({ barcode: '789', sale_price: 19.9, reference_cost: 8, weight_grams: 250, height_cm: 10.5 });
    expect(variantFields(r, false).reference_cost).toBeUndefined();
    expect(variantFields(newRow('P', {}), true)).toEqual({});
  });

  it('a grade recebe só as opções e os valores que as linhas usam', () => {
    const opts = [{ name: 'Tamanho', values: ['P', 'M', 'G'] }, { name: 'Cor', values: ['Azul'] }];
    const rows = syncRows([], opts).filter((r) => r.attributes.Tamanho !== 'M');
    expect(gridAttributes(opts, rows)).toEqual([{ name: 'Tamanho', values: ['P', 'G'] }, { name: 'Cor', values: ['Azul'] }]);
  });

  it('modelos prontos e da empresa viram opções sem valor marcado', () => {
    expect(READY_MODELS.map((m) => m.id)).toContain('roupa');
    expect(optionsOfModel(READY_MODELS[0])).toEqual([{ name: 'Tamanho', values: [] }, { name: 'Cor', values: [] }]);
    const mine = companyModel({ id: '1', name: 'Meus tamanhos', options: [{ name: 'Tamanho', values: ['U'] }] });
    expect(mine.options[0].suggestions).toEqual(['U']);
    expect(optionsToSave([{ name: ' Tamanho ', suggestions: ['P'], values: ['p', 'M'] }, { name: '', suggestions: [], values: [] }])).toEqual([{ name: 'Tamanho', values: ['P', 'M'] }]);
  });
});

describe('dados fiscais', () => {
  it('confere o tamanho de cada código e manda só o preenchido', () => {
    expect(fiscalProblem({ ...EMPTY_FISCAL, ncm: '1234' })).toBe('ncm');
    expect(fiscalProblem({ ...EMPTY_FISCAL, ncm: '12345678', cest: '123' })).toBe('cest');
    expect(fiscalProblem({ ...EMPTY_FISCAL, cfop: '510' })).toBe('cfop');
    expect(fiscalProblem({ ...EMPTY_FISCAL, cst: '1' })).toBe('cst');
    expect(fiscalProblem(EMPTY_FISCAL)).toBeNull();
    expect(fiscalPayload({ ...EMPTY_FISCAL, ncm: '12345678', origin: '0' })).toEqual({ fiscal_ncm: '12345678', fiscal_origem: 0 });
    expect(fiscalPayload(EMPTY_FISCAL)).toEqual({});
  });
});
