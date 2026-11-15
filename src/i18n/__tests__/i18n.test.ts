import { resources } from '../resources';

/** Todas as chaves do português existem em inglês e espanhol (e nenhuma a mais), com as mesmas variáveis {{x}}. */
function flat(o: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') acc[key] = v;
    else Object.assign(acc, flat(v as Record<string, unknown>, key));
    return acc;
  }, {});
}
const vars = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((v) => v.replace(/\s/g, '')).sort();

describe('traduções', () => {
  const pt = flat(resources.pt as unknown as Record<string, unknown>);
  for (const lang of ['en', 'es'] as const) {
    const other = flat(resources[lang] as unknown as Record<string, unknown>);
    it(`${lang}: mesmas chaves do português`, () => {
      expect(Object.keys(other).sort()).toEqual(Object.keys(pt).sort());
    });
    it(`${lang}: mesmas variáveis em cada texto e nenhum texto vazio`, () => {
      for (const [k, v] of Object.entries(pt)) {
        expect([k, vars(other[k] ?? '')]).toEqual([k, vars(v)]);
        expect([k, (other[k] ?? '').trim().length > 0]).toEqual([k, true]);
      }
    });
  }
});
