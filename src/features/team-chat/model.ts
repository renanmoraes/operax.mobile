import type { ApiTeamChannel, ApiTeamMessage } from '@/src/shared/api/team-chat.api';

/** Modelo de tela do chat interno: igual para o modo demo e para o backend real. */

export type TeamChannel = {
  id: string;
  kind: 'dm' | 'group';
  title: string;
  /** Linha de baixo: última mensagem quando houver, senão o assunto do grupo. */
  preview: string | null;
  previewAuthor: string | null;
  lastAt: string | null;
  unread: number;
  pinned: boolean;
  /** Só nas diretas: colega está online agora. */
  online?: boolean;
};

export type TeamMessageType = 'text' | 'image' | 'video' | 'document' | 'audio';

export type TeamMessage = {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  mine: boolean;
  type: TeamMessageType;
  body: string;
  at: string;
  mediaUri?: string;
  fileName?: string;
  sizeBytes?: number;
  durationS?: number;
  /** Arquivo embutido no app (fotos/PDF do modo demo). */
  asset?: number;
};

export type IncomingNotice = {
  key: string;
  channelId: string;
  channelTitle: string;
  kind: 'dm' | 'group';
  senderName: string;
  body: string;
};

/** Cores tonais por grupo: cada grupo fica reconhecível de relance na lista. */
export const GROUP_TONES = [
  { bg: '#e3ebff', fg: '#1e4ed8' },
  { bg: '#ddf5ff', fg: '#0369a1' },
  { bg: '#e3f6ea', fg: '#15803d' },
  { bg: '#fff1e6', fg: '#c2410c' },
  { bg: '#f1e9ff', fg: '#6d28d9' },
  { bg: '#ffe9f1', fg: '#be185d' },
] as const;

export function toneFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_TONES[h % GROUP_TONES.length];
}

/** "14:05" hoje, "Ontem", dia da semana nesta semana, "12/11" antes disso. */
export function timeLabel(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Ontem';
  if (days < 7) {
    const w = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function clockLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Fixadas primeiro; depois as com não lidas; depois a mais recente. */
export function sortChannels(list: TeamChannel[]): TeamChannel[] {
  const t = (c: TeamChannel) => (c.lastAt ? new Date(c.lastAt).getTime() : 0);
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    return t(b) - t(a);
  });
}

export function unreadTotal(list: TeamChannel[]): number {
  return list.reduce((sum, c) => sum + (c.unread > 0 ? c.unread : 0), 0);
}

export function mapApiChannel(c: ApiTeamChannel): TeamChannel {
  const kind = c.type === 'dm' ? 'dm' : 'group';
  return {
    id: c.id,
    kind,
    title: kind === 'dm' ? c.peer?.name || 'Conversa direta' : c.name || 'Grupo',
    preview: c.topic ?? null,
    previewAuthor: null,
    lastAt: c.last_message_at ?? c.created_at ?? null,
    unread: Number(c.unread_count ?? 0),
    pinned: !!c.pinned_at,
  };
}

export function messageTypeOf(mime: string | null | undefined, hasMedia: boolean): TeamMessageType {
  if (!hasMedia) return 'text';
  if (!mime) return 'document';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export function absoluteMediaUrl(url: string | null | undefined, apiUrl: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${apiUrl.replace(/\/$/, '')}${url}` : url;
}

export function mapApiMessage(m: ApiTeamMessage, viewerId: string | undefined, apiUrl: string): TeamMessage {
  const type = messageTypeOf(m.media_mime, !!m.media_url);
  return {
    id: m.id,
    channelId: m.channel_id,
    senderId: m.sender_id,
    senderName: m.sender_name || 'Equipe',
    mine: !!viewerId && m.sender_id === viewerId,
    type,
    body: m.deleted_at ? 'Mensagem apagada' : m.body ?? '',
    at: clockLabel(m.created_at),
    mediaUri: absoluteMediaUrl(m.media_url, apiUrl),
    fileName: m.media_filename ?? undefined,
    sizeBytes: m.media_size_bytes ?? undefined,
  };
}

/** Texto curto da mensagem para lista e aviso: "🎤 Áudio", "📷 Foto"… */
export function previewOf(m: Pick<TeamMessage, 'type' | 'body' | 'fileName'>): string {
  switch (m.type) {
    case 'audio':
      return 'Áudio';
    case 'image':
      return m.body ? `Foto · ${m.body}` : 'Foto';
    case 'video':
      return m.body ? `Vídeo · ${m.body}` : 'Vídeo';
    case 'document':
      return m.fileName || 'Documento';
    default:
      return m.body;
  }
}

/** Primeiro nome, para "Juliana: texto" nos grupos. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
