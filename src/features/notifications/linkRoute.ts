/**
 * Push do Operax (equipe) traz o `link` da tela no web (`/inbox/:id`, `/chat/:id`, `/agenda`…).
 * Aqui vira a tela equivalente do app. O que o app ainda não tem abre a aba Avisos, onde o aviso aparece.
 */
const UUID = '[0-9a-f-]{36}';

export function linkToAppRoute(link: unknown, data: Record<string, unknown> = {}): string {
  const conv = typeof data.conversation_id === 'string' ? data.conversation_id : typeof data.conversationId === 'string' ? data.conversationId : null;
  const channel = typeof data.channel_id === 'string' ? data.channel_id : null;
  if (typeof link !== 'string' || !link.startsWith('/')) {
    if (conv) return `/conversation/${conv}`;
    if (channel) return `/equipe/${channel}`;
    return '/notifications';
  }
  const path = link.split('?')[0];
  let m = path.match(new RegExp(`^/inbox/(${UUID})`, 'i'));
  if (m) return `/conversation/${m[1]}`;
  if (path.startsWith('/inbox')) return conv ? `/conversation/${conv}` : '/inbox';
  m = path.match(new RegExp(`^/(?:chat|team-chat)/(${UUID})`, 'i'));
  if (m) return `/equipe/${m[1]}`;
  if (path.startsWith('/chat') || path.startsWith('/team-chat')) return channel ? `/equipe/${channel}` : '/equipe';
  m = path.match(new RegExp(`^/contacts/(${UUID})`, 'i'));
  if (m) return `/contact/${m[1]}`;
  if (path.startsWith('/agenda') || path.startsWith('/scheduling')) return '/agenda';
  if (path.startsWith('/kanban')) return '/kanban';
  return '/notifications';
}
