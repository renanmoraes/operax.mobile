import type { IncomingNotice, TeamChannel, TeamMessage } from './model';
import { firstName, previewOf } from './model';

/**
 * Chat interno no modo demo: grupos e diretas de uma clínica, guardados em memória.
 * Um tempo depois de entrar chegam mensagens de colegas, para mostrar o aviso no topo,
 * o contador da aba Mais e a lista subindo a conversa — como acontece com o socket real.
 */

const ME = 'u1';
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const clock = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

type DemoChannel = Omit<TeamChannel, 'preview' | 'previewAuthor' | 'lastAt'> & { topic?: string };

const channels: DemoChannel[] = [
  { id: 'g-recepcao', kind: 'group', title: 'Recepção', topic: 'Agenda do dia e chegadas', unread: 3, pinned: true },
  { id: 'dm-juliana', kind: 'dm', title: 'Juliana Costa', unread: 1, pinned: false, online: true },
  { id: 'g-clinica', kind: 'group', title: 'Toda a clínica', topic: 'Avisos gerais', unread: 0, pinned: false },
  { id: 'dm-ricardo', kind: 'dm', title: 'Dr. Ricardo Alves', unread: 0, pinned: false, online: false },
  { id: 'g-comercial', kind: 'group', title: 'Comercial', topic: 'Leads e retornos', unread: 0, pinned: false },
  { id: 'dm-pedro', kind: 'dm', title: 'Pedro Lima', unread: 0, pinned: false, online: true },
];

type Seed = Omit<TeamMessage, 'id' | 'channelId' | 'mine' | 'at'> & { min: number };

const seed: Record<string, Seed[]> = {
  'g-recepcao': [
    { senderId: 'u4', senderName: 'Pedro Lima', type: 'text', body: 'Bom dia! Agenda de hoje está cheia, 14 confirmados.', min: 95 },
    { senderId: ME, senderName: 'Ana Atendente', type: 'text', body: 'Bom dia, Pedro. Eu fico com os retornos da manhã.', min: 90 },
    { senderId: 'u2', senderName: 'Juliana Costa', type: 'image', body: 'Pedido médico da Maria Silva', min: 26, asset: require('@/assets/demo/foto-joelho.jpg') },
    { senderId: 'u2', senderName: 'Juliana Costa', type: 'text', body: 'Alguém consegue encaixar ela às 15h com o Dr. Ricardo?', min: 25 },
    { senderId: 'u4', senderName: 'Pedro Lima', type: 'audio', body: 'Áudio', durationS: 14, min: 12 },
  ],
  'dm-juliana': [
    { senderId: ME, senderName: 'Ana Atendente', type: 'text', body: 'Ju, a avaliação de outubro do Carlos chegou?', min: 70 },
    { senderId: 'u2', senderName: 'Juliana Costa', type: 'document', body: '', fileName: 'avaliacao-outubro.pdf', sizeBytes: 182_000, min: 41, asset: require('@/assets/demo/avaliacao-outubro.pdf') },
    { senderId: 'u2', senderName: 'Juliana Costa', type: 'text', body: 'Chegou sim, te mandei aqui. Pode conferir antes de enviar pra ele?', min: 40 },
  ],
  'g-clinica': [
    { senderId: 'u3', senderName: 'Dr. Ricardo Alves', type: 'text', body: 'Pessoal, sexta não teremos atendimento à tarde por causa da manutenção.', min: 60 * 20 },
    { senderId: ME, senderName: 'Ana Atendente', type: 'text', body: 'Anotado, vou avisar os pacientes de sexta.', min: 60 * 19 },
  ],
  'dm-ricardo': [
    { senderId: 'u3', senderName: 'Dr. Ricardo Alves', type: 'text', body: 'Obrigado por organizar a agenda de ontem!', min: 60 * 26 },
  ],
  'g-comercial': [
    { senderId: 'u5', senderName: 'Camila Rocha', type: 'text', body: 'Fechamos 3 planos trimestrais essa semana 🎉', min: 60 * 50 },
  ],
  'dm-pedro': [
    { senderId: 'u4', senderName: 'Pedro Lima', type: 'text', body: 'Me cobre no almoço hoje?', min: 60 * 72 },
    { senderId: ME, senderName: 'Ana Atendente', type: 'text', body: 'Cubro sim, pode ir.', min: 60 * 71 },
  ],
};

const messages: Record<string, (TeamMessage & { iso: string })[]> = {};
for (const [channelId, list] of Object.entries(seed)) {
  messages[channelId] = list.map(({ min, ...m }, i) => {
    const iso = ago(min);
    return { ...m, id: `${channelId}-${i}`, channelId, mine: m.senderId === ME, at: clock(iso), iso };
  });
}

/** Mensagens que chegam sozinhas no demo, em ordem, depois de alguns segundos. */
const INCOMING: { channelId: string; senderId: string; senderName: string; body: string; afterMs: number }[] = [
  { channelId: 'g-recepcao', senderId: 'u2', senderName: 'Juliana Costa', body: 'Consegui! Maria Silva confirmada às 15h 🙌', afterMs: 9_000 },
  { channelId: 'dm-ricardo', senderId: 'u3', senderName: 'Dr. Ricardo Alves', body: 'Ana, pode me mandar a ficha da paciente das 15h?', afterMs: 26_000 },
];

let version = 0;
const listeners = new Set<() => void>();
const noticeListeners = new Set<(n: IncomingNotice) => void>();
let started = false;
const timers: ReturnType<typeof setTimeout>[] = [];

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export const demoTeamChat = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  onNotice(l: (n: IncomingNotice) => void) {
    noticeListeners.add(l);
    return () => void noticeListeners.delete(l);
  },
  version: () => version,

  channels(): TeamChannel[] {
    return channels.map((c) => {
      const list = messages[c.id] ?? [];
      const last = list[list.length - 1];
      return {
        id: c.id,
        kind: c.kind,
        title: c.title,
        unread: c.unread,
        pinned: c.pinned,
        online: c.online,
        preview: last ? previewOf(last) : c.topic ?? null,
        previewAuthor: last && c.kind === 'group' ? (last.mine ? 'Você' : firstName(last.senderName)) : last?.mine ? 'Você' : null,
        lastAt: last?.iso ?? null,
      };
    });
  },

  messages(channelId: string): TeamMessage[] {
    return messages[channelId] ?? [];
  },

  markRead(channelId: string) {
    const c = channels.find((x) => x.id === channelId);
    if (c && c.unread > 0) {
      c.unread = 0;
      emit();
    }
  },

  send(channelId: string, m: Omit<TeamMessage, 'id' | 'channelId' | 'senderId' | 'senderName' | 'mine' | 'at'>) {
    const iso = new Date().toISOString();
    (messages[channelId] ??= []).push({ ...m, id: `local-${Date.now()}`, channelId, senderId: ME, senderName: 'Ana Atendente', mine: true, at: clock(iso), iso });
    emit();
  },

  /** Recebe uma mensagem de colega: entra na conversa, soma não lida e dispara o aviso. */
  receive(channelId: string, senderId: string, senderName: string, body: string, openChannelId: string | null) {
    const c = channels.find((x) => x.id === channelId);
    if (!c) return;
    const iso = new Date().toISOString();
    (messages[channelId] ??= []).push({ id: `in-${Date.now()}`, channelId, senderId, senderName, mine: false, type: 'text', body, at: clock(iso), iso });
    if (openChannelId !== channelId) {
      c.unread += 1;
      const notice: IncomingNotice = { key: `${channelId}-${iso}`, channelId, channelTitle: c.title, kind: c.kind, senderName, body };
      noticeListeners.forEach((l) => l(notice));
    }
    emit();
  },

  /** Agenda as mensagens que chegam sozinhas (uma vez por abertura do app). */
  start(getOpenChannel: () => string | null) {
    if (started) return;
    started = true;
    for (const m of INCOMING) {
      timers.push(setTimeout(() => demoTeamChat.receive(m.channelId, m.senderId, m.senderName, m.body, getOpenChannel()), m.afterMs));
    }
  },

  stop() {
    timers.splice(0).forEach(clearTimeout);
    started = false;
  },
};
