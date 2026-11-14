import { applyPick, compactName, detectPicker, mentionsInBody, splitMentions } from '../mentions';

describe('marcações no chat da equipe (igual ao Operax web)', () => {
  it('detecta @ para equipe e # para paciente no fim do texto', () => {
    expect(detectPicker('oi @ju')).toEqual({ kind: 'user', query: 'ju', start: 3 });
    expect(detectPicker('#mar')).toEqual({ kind: 'contact', query: 'mar', start: 0 });
    expect(detectPicker('@Ana viu o #Jo')).toEqual({ kind: 'contact', query: 'Jo', start: 11 });
    expect(detectPicker('email a@b.com')).toEqual({ kind: 'none' });
    expect(detectPicker('texto normal')).toEqual({ kind: 'none' });
  });

  it('insere o nome compacto, sem acento, e um espaço', () => {
    expect(compactName('Lívia Torres')).toBe('LiviaTorres');
    const p = detectPicker('Pode ver a #mar');
    expect(applyPick('Pode ver a #mar', p, 'Maria Silva')).toBe('Pode ver a #MariaSilva ');
    expect(applyPick('@ju', detectPicker('@ju'), 'Juliana Costa')).toBe('@JulianaCosta ');
  });

  it('envia só as marcações que continuam no texto', () => {
    const r = mentionsInBody(
      '@JulianaCosta veja a #MariaSilva',
      [
        { id: 'u2', name: 'Juliana Costa' },
        { id: 'u4', name: 'Pedro Lima' },
      ],
      [
        { contact_id: 'c1', label: 'MariaSilva' },
        { contact_id: 'c2', label: 'JoaoPedro' },
      ],
    );
    expect(r).toEqual({ mentions: ['u2'], contact_refs: [{ contact_id: 'c1', label: 'MariaSilva' }] });
  });

  it('separa o texto para destacar as marcações no balão', () => {
    expect(splitMentions('Oi @Ana, a #MariaSilva chegou')).toEqual([
      { text: 'Oi ', kind: 'plain' },
      { text: '@Ana', kind: 'user' },
      { text: ', a ', kind: 'plain' },
      { text: '#MariaSilva', kind: 'contact' },
      { text: ' chegou', kind: 'plain' },
    ]);
  });
});
