import { isPhoneLike, maskIdentifier } from '../identifier';

describe('isPhoneLike', () => {
  it('só número é celular; vazio, letra ou @ é e-mail', () => {
    expect(isPhoneLike('(31) 99563-7020')).toBe(true);
    expect(isPhoneLike('3')).toBe(true);
    expect(isPhoneLike('')).toBe(false);
    expect(isPhoneLike('(')).toBe(false);
    expect(isPhoneLike('31rafa')).toBe(false);
    expect(isPhoneLike('a@b.com')).toBe(false);
  });
});

describe('maskIdentifier', () => {
  it('celular ganha a máscara enquanto a pessoa digita', () => {
    expect(maskIdentifier('31995637020')).toBe('(31) 99563-7020');
    expect(maskIdentifier('3199563')).toBe('(31) 9956-3');
    expect(maskIdentifier('31')).toBe('(31');
    expect(maskIdentifier('(31) 99563-70201')).toBe('(31) 99563-7020');
  });

  it('apagar até sobrar nada deixa o campo vazio', () => {
    expect(maskIdentifier('(')).toBe('(');
    expect(maskIdentifier('')).toBe('');
  });

  it('e-mail fica como foi digitado, mesmo começando com número', () => {
    expect(maskIdentifier('rafael@email.com')).toBe('rafael@email.com');
    expect(maskIdentifier('31rafa')).toBe('31rafa');
    expect(maskIdentifier('31995@')).toBe('31995@');
  });
});
