import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import i18n from '@/src/i18n';
import { useAuth } from '@/src/features/auth/AuthContext';
import { listTeamChannels, markTeamChannelRead } from '@/src/shared/api/team-chat.api';
import { useSocketEvents } from '@/src/shared/realtime/socket';
import { demoTeamChat } from './demoStore';
import { IncomingNotice, mapApiChannel, sortChannels, TeamChannel, unreadTotal } from './model';

type TeamChatValue = {
  enabled: boolean;
  channels: TeamChannel[];
  loading: boolean;
  unread: number;
  notice: IncomingNotice | null;
  dismissNotice: () => void;
  /** A conversa aberta na tela: não gera aviso e é marcada como lida. */
  setOpenChannel: (id: string | null) => void;
  markRead: (id: string) => void;
  refresh: () => void;
};

const Ctx = createContext<TeamChatValue | null>(null);
export const TEAM_CHANNELS_KEY = ['team-chat', 'channels'] as const;

/**
 * Chat interno da equipe (DMs e grupos, como no Operax web). Fica acima das telas para
 * que a aba Mais mostre o total de não lidas e o aviso apareça em qualquer lugar do app.
 * No backend real: socket `chat.message.new` + consulta a cada 20 s como rede de segurança.
 */
export function TeamChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, mode } = useAuth();
  const enabled = isAuthenticated && user?.kind === 'staff';
  const live = enabled && mode === 'live';
  const demo = enabled && mode === 'mock';
  const qc = useQueryClient();
  const openRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<IncomingNotice | null>(null);
  const lastUnread = useRef<Map<string, number> | null>(null);

  // Trocou de conta (ou saiu): o aviso e a contagem da conta anterior não podem aparecer para a próxima.
  const accountKey = `${mode}:${user?.id ?? '-'}`;
  const [noticeAccount, setNoticeAccount] = useState(accountKey);
  if (noticeAccount !== accountKey) {
    setNoticeAccount(accountKey);
    setNotice(null);
  }
  useEffect(() => {
    lastUnread.current = null;
    openRef.current = null;
  }, [accountKey]);

  // ---------- demo ----------
  const demoVersion = useSyncExternalStore(demoTeamChat.subscribe, demoTeamChat.version, demoTeamChat.version);
  useEffect(() => {
    if (!demo) return;
    demoTeamChat.start(() => openRef.current);
    const off = demoTeamChat.onNotice(setNotice);
    return () => {
      off();
      demoTeamChat.stop();
    };
  }, [demo]);

  // ---------- backend real ----------
  const query = useQuery({
    queryKey: [...TEAM_CHANNELS_KEY, user?.id],
    enabled: live,
    refetchInterval: 20_000,
    queryFn: async () => (await listTeamChannels()).map(mapApiChannel),
  });

  // Sem socket (ou se ele cair), percebe a chegada pela contagem que subiu.
  useEffect(() => {
    if (!live || !query.data) return;
    const prev = lastUnread.current;
    const next = new Map(query.data.map((c) => [c.id, c.unread]));
    if (prev) {
      const grew = query.data.find((c) => c.unread > (prev.get(c.id) ?? 0) && c.id !== openRef.current);
      if (grew) {
        setNotice({ key: `${grew.id}-${Date.now()}`, channelId: grew.id, channelTitle: grew.title, kind: grew.kind, senderName: grew.kind === 'dm' ? grew.title : '', body: grew.preview || i18n.t('team:model.newMessage') });
      }
    }
    lastUnread.current = next;
  }, [live, query.data]);

  // Ao vivo: mensagem nova, edição, reação ou canal alterado → lista, contador e conversa aberta na hora.
  const onTeamEvent = (raw: unknown) => {
    const payload = raw as { channel_id?: string; channelId?: string; sender_id?: string } | undefined;
    void qc.invalidateQueries({ queryKey: TEAM_CHANNELS_KEY });
    const channel = payload?.channel_id ?? payload?.channelId;
    if (channel && payload?.sender_id !== user?.id) void qc.invalidateQueries({ queryKey: ['team-chat', 'messages', channel] });
  };
  useSocketEvents(
    {
      'chat.message.new': onTeamEvent,
      'chat.message.edited': onTeamEvent,
      'chat.message.reaction': onTeamEvent,
      'chat.channel.updated': onTeamEvent,
      'chat.notify': onTeamEvent,
    },
    live,
  );

  const markRead = useCallback(
    (id: string) => {
      if (demo) return demoTeamChat.markRead(id);
      if (!live) return;
      qc.setQueryData<TeamChannel[]>([...TEAM_CHANNELS_KEY, user?.id], (list) => list?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      lastUnread.current?.set(id, 0);
      void markTeamChannelRead(id).catch(() => undefined);
    },
    [demo, live, qc, user?.id],
  );

  const setOpenChannel = useCallback(
    (id: string | null) => {
      openRef.current = id;
      if (id) {
        setNotice((n) => (n?.channelId === id ? null : n));
        markRead(id);
      }
    },
    [markRead],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  const channels = useMemo(
    () => sortChannels(demo ? demoTeamChat.channels() : live ? query.data ?? [] : []),
    // demoVersion muda a cada mensagem do demo: é o que faz a lista se refazer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, live, query.data, demoVersion],
  );

  const value: TeamChatValue = {
    enabled,
    channels,
    loading: live && query.isLoading,
    unread: unreadTotal(channels),
    notice: enabled ? notice : null,
    dismissNotice,
    setOpenChannel,
    markRead,
    refresh: () => void query.refetch(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeamChat(): TeamChatValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTeamChat fora do TeamChatProvider');
  return v;
}
