import { linkToAppRoute } from './linkRoute';

/**
 * Onde a pessoa está agora, para o aviso não chegar quando ela já está olhando a conversa dele.
 * `setActivePath` é chamado a cada troca de tela (caminho sem parâmetros de busca).
 */
let activePath = '';

export function setActivePath(path: string): void {
  activePath = path;
}

export function getActivePath(): string {
  return activePath;
}

/** A tela que o aviso abriria: o `url` do aluno ou o `link` da equipe convertido (`/conversation/:id`, `/equipe/:id`…). */
export function routeOfNotification(data: Record<string, unknown> | null | undefined): string | null {
  const d = data ?? {};
  if (typeof d.url === 'string' && d.url.startsWith('/')) return d.url.split('?')[0];
  if (d.notificationId || d.link) return linkToAppRoute(d.link, d).split('?')[0];
  return null;
}

/**
 * Aviso que chega com o app aberto: não aparece (nem toca) se a pessoa já está na conversa a que ele se refere. Em qualquer
 * outra tela, ou em outra conversa, aparece normalmente. Rotas genéricas (`/notifications`, `/inbox`) nunca silenciam.
 */
export function shouldSilenceInForeground(data: Record<string, unknown> | null | undefined, current: string = activePath): boolean {
  const target = routeOfNotification(data);
  if (!target || !current) return false;
  if (target === '/notifications' || target === '/inbox' || target === '/equipe' || target === '/agenda') return false;
  return target === current;
}

/** Tratador dos avisos com o app aberto, o mesmo em todo lugar que registra o `setNotificationHandler`. */
export async function foregroundNotificationHandler(notification: { request: { content: { data?: unknown } } }) {
  const silent = shouldSilenceInForeground(notification.request.content.data as Record<string, unknown> | undefined);
  return { shouldShowBanner: !silent, shouldShowList: !silent, shouldPlaySound: !silent, shouldSetBadge: false };
}
