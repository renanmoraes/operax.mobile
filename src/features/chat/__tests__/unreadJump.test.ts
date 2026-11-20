import { firstUnreadId } from '../unreadJump';
import type { Message } from '@/src/mocks/data';

const m = (id: string, direction: 'in' | 'out', other = false): Message =>
  ({ id, conversationId: 'c', direction, type: 'text', body: id, at: '10:00', ...(other ? { otherConversation: { channel: null, connectionId: null } } : {}) });

describe('firstUnreadId', () => {
  const thread = [m('a', 'in'), m('b', 'out'), m('c', 'in'), m('x', 'in', true), m('d', 'in'), m('e', 'out')];

  it('acha a primeira não lida contando as que chegaram do fim, sem as de outra conversa', () => {
    expect(firstUnreadId(thread, 1)).toBe('d');
    expect(firstUnreadId(thread, 2)).toBe('c');
  });

  it('mais não lidas do que a página trouxe: a primeira que chegou na página', () => {
    expect(firstUnreadId(thread, 9)).toBe('a');
  });

  it('nada a ler, ou nenhuma mensagem do contato: sem marca', () => {
    expect(firstUnreadId(thread, 0)).toBeNull();
    expect(firstUnreadId([m('b', 'out')], 2)).toBeNull();
  });
});
