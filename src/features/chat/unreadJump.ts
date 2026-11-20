import type { Message } from '@/src/mocks/data';

/**
 * Primeira mensagem não lida da conversa aberta: das mensagens que chegaram (do contato, desta conversa), a de número `unread`
 * contando do fim. Se o contato mandou mais do que a página trouxe, vale a primeira que chegou na página.
 */
export function firstUnreadId(thread: Message[], unread: number): string | null {
  if (unread <= 0) return null;
  const inbound = thread.filter((m) => m.direction === 'in' && !m.otherConversation);
  if (!inbound.length) return null;
  return inbound[Math.max(0, inbound.length - unread)].id;
}
