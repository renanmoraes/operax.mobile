import { applyQuickReply, filterQuickReplies, resolveQuickReplyVariables, slashTerm } from '../quickReplyMatch';

const list = [
  { id: '1', slug: 'saudacao', title: 'Saudação', body: 'Olá {{contact.name}}! Sou {{agent.name}}.' },
  { id: '2', slug: 'horario', title: 'Horário de atendimento', body: 'Seg a sex, 8h às 18h.' },
  { id: '3', slug: 'docs', title: 'Documentos', body: 'Envie foto do pedido médico.' },
];

describe('atalho / de respostas rápidas (igual ao Operax web)', () => {
  it('detecta /termo no fim do texto, no começo ou depois de quebra de linha', () => {
    expect(slashTerm('/')).toBe('');
    expect(slashTerm('/Hor')).toBe('hor');
    expect(slashTerm('oi\n/doc')).toBe('doc');
    expect(slashTerm('oi /doc')).toBeNull();
    expect(slashTerm('/doc ')).toBeNull();
    expect(slashTerm('texto normal')).toBeNull();
  });

  it('filtra pelo atalho primeiro e depois pelo título, sem acento', () => {
    expect(filterQuickReplies(list, '').map((q) => q.slug)).toEqual(['saudacao', 'horario', 'docs']);
    expect(filterQuickReplies(list, 'hor').map((q) => q.slug)).toEqual(['horario']);
    expect(filterQuickReplies(list, 'saud').map((q) => q.slug)).toEqual(['saudacao']);
    expect(filterQuickReplies(list, 'atendimento').map((q) => q.slug)).toEqual(['horario']);
    expect(filterQuickReplies(list, 'xyz')).toEqual([]);
  });

  it('preenche as variáveis do contato e do atendente', () => {
    expect(resolveQuickReplyVariables(list[0].body, { name: 'Maria' }, 'Ana')).toBe('Olá Maria! Sou Ana.');
    expect(resolveQuickReplyVariables('{{contact.phone}} {{contact.company}}', {}, 'Ana')).toBe(' ');
  });

  it('troca só o /termo do fim pelo texto do atalho', () => {
    expect(applyQuickReply('/hor', 'Seg a sex.')).toBe('Seg a sex.');
    expect(applyQuickReply('Oi Maria!\n/hor', 'Seg a sex.')).toBe('Oi Maria!\nSeg a sex.');
  });
});
