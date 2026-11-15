import { useQuery } from '@tanstack/react-query';
import { showDialog } from '@/src/design-system/Dialog';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, Screen, ScreenHeader, StatTile } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { ConversationCard } from '@/src/features/inbox/ConversationCard';
import { conversations as mockConversations, type Conversation } from '@/src/mocks/data';
import { useAuth } from '@/src/features/auth/AuthContext';
import { claimConversation, getMyHistory, listConversations } from '@/src/shared/api/conversations.api';
import { mapApiConversation } from '@/src/features/inbox/mapConversation';
import { sortForHome } from '@/src/features/inbox/sortConversations';
import { useSocketEvents } from '@/src/shared/realtime/socket';
import { useQueueDrawer } from '@/src/features/queue/QueueDrawerContext';
import { QueueDrawer } from '@/src/features/queue/QueueDrawer';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { NumberFilter, useInboxConnections } from '@/src/features/attendance/channels';
import { PresenceButton } from '@/src/features/attendance/TeamPresence';

export default function InboxScreenGuarded() {
  const { t } = useTranslation('inbox');
  return (
    <RequirePermission need="inbox" title={t('inbox.title')}>
      <InboxScreen />
    </RequirePermission>
  );
}

function InboxScreen() {
  const { t } = useTranslation('inbox');
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const { open, close, setQueueCount } = useQueueDrawer();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const can = useCan();
  // Empresa com vários números: filtra as conversas de um número só (o servidor filtra; no demo, aqui).
  const [numberId, setNumberId] = useState<string | null>(null);
  const { idOf, multi } = useInboxConnections();
  const filterBy = multi ? numberId : null;

  const query = useQuery({
    queryKey: ['inbox', mode, user?.id, filterBy],
    enabled: mode === 'live',
    // Reserva se o tempo real cair (o normal é atualizar pelo socket, na hora).
    refetchInterval: 20_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [list, history] = await Promise.all([
        listConversations({ limit: 50, sort_by: 'unread_first', ...(filterBy ? { connection_id: filterBy } : {}) }),
        getMyHistory({ limit: 30 }),
      ]);
      const mapped = (list.data ?? []).map((c) => mapApiConversation(c, user?.id));
      const hist = (history.data ?? []).map((c) => ({
        ...mapApiConversation(c, user?.id),
        segment: 'history' as const,
      }));
      return { live: mapped, history: hist };
    },
  });

  // Ao vivo: chegou mensagem, alguém assumiu/liberou/encerrou → a lista e os contadores mudam na hora.
  const refresh = () => void query.refetch();
  useSocketEvents(
    {
      'conversation.new': refresh,
      'conversation.updated': refresh,
      'conversation.closed': refresh,
      'message.received': refresh,
      'message.sent': refresh,
      'assignment.claimed': refresh,
      'assignment.released': refresh,
    },
    mode === 'live',
  );

  const { active, queue } = useMemo(() => {
    const all = mode === 'mock' ? mockConversations.filter((c) => !filterBy || idOf(c) === filterBy) : query.data?.live ?? [];
    return {
      active: sortForHome(all.filter((c) => c.segment === 'active' || c.ownership === 'mine')),
      queue: all.filter((c) => c.segment === 'queue' || c.ownership === 'queue'),
    };
  }, [mode, query.data, filterBy, idOf]);

  useEffect(() => {
    setQueueCount(queue.length);
  }, [queue.length, setQueueCount]);

  const handleClaim = async (id: string) => {
    setClaimingId(id);
    try {
      if (mode === 'live') {
        await claimConversation(id);
        await query.refetch();
      }
      close();
      router.push(`/conversation/${id}`);
    } catch (e) {
      // A fila continua aberta; explica o motivo (outra pessoa assumiu, sem conexão…).
      const status = (e as { response?: { status?: number; data?: { message?: unknown } } })?.response;
      const msg = typeof status?.data?.message === 'string' && (status?.status ?? 500) < 500 ? status.data.message : t('inbox.claimFailed');
      void showDialog({ title: t('inbox.claimFailedTitle'), message: msg, tone: 'warn' });
      void query.refetch();
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        safe
        title={t('inbox.title')}
        onMenuPress={open}
        menuBadge={queue.length}
        right={can('teamPresence') ? <PresenceButton /> : <Badge label={mode === 'live' ? (query.isFetching ? t('inbox.updating') : t('inbox.online')) : t('inbox.demo')} tone={mode === 'live' ? 'success' : 'primary'} />}
      />
      <NumberFilter value={numberId} onChange={setNumberId} />
      <View style={styles.stats}>
        <StatTile value={String(queue.length)} label={t('inbox.inQueue')} accent />
        <StatTile value={String(active.length)} label={t('inbox.withYou')} />
        <StatTile value={String(active.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0))} label={t('inbox.unreadLabel')} />
      </View>

      {mode === 'live' && query.isLoading ? (
        <SkeletonList variant="conversation" count={4} style={{ paddingHorizontal: 20, paddingTop: 4 }} />
      ) : (
        <FlatList
          data={active}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom, gap: 10 }}
          refreshControl={
            mode === 'live' ? (
              <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              title={t('inbox.emptyTitle')}
              subtitle={t('inbox.emptySub')}
              actionLabel={t('inbox.viewQueue')}
              onAction={open}
            />
          }
          renderItem={({ item }) => <ConversationCard item={item} onPress={() => router.push(`/conversation/${item.id}`)} />}
        />
      )}

      <QueueDrawer items={queue as Conversation[]} claimingId={claimingId} onClaim={handleClaim} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
});
