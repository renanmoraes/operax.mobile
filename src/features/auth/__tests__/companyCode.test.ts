import { normalizeCompanyCode } from '../companyCode';

describe('código da empresa', () => {
  it('só letras, em maiúsculas, até 4, como no login da web', () => {
    expect(normalizeCompanyCode('oprx')).toBe('OPRX');
    expect(normalizeCompanyCode(' o p-r1x2 ')).toBe('OPRX');
    expect(normalizeCompanyCode('abcdefg')).toBe('ABCD');
    expect(normalizeCompanyCode('123')).toBe('');
    expect(normalizeCompanyCode('')).toBe('');
  });
});
