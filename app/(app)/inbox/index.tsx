import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, Loading, Screen, ScreenHeader, StatTile } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { ConversationCard } from '@/src/features/inbox/ConversationCard';
import { conversations as mockConversations, type Conversation } from '@/src/mocks/data';
import { useAuth } from '@/src/features/auth/AuthContext';
import { claimConversation, getMyHistory, listConversations } from '@/src/shared/api/conversations.api';
import { mapApiConversation } from '@/src/features/inbox/mapConversation';
import { sortForHome } from '@/src/features/inbox/sortConversations';
import { getSocket } from '@/src/shared/realtime/socket';
import { useQueueDrawer } from '@/src/features/queue/QueueDrawerContext';
import { QueueDrawer } from '@/src/features/queue/QueueDrawer';

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const { open, close, setQueueCount } = useQueueDrawer();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['inbox', mode, user?.id],
    enabled: mode === 'live',
    queryFn: async () => {
      const [list, history] = await Promise.all([
        listConversations({ limit: 50, sort_by: 'unread_first' }),
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

  useEffect(() => {
    if (mode !== 'live') return;
    const socket = getSocket();
    if (!socket) return;
    const invalidate = () => query.refetch();
    socket.on('conversation.new', invalidate);
    socket.on('conversation.updated', invalidate);
    socket.on('message.received', invalidate);
    return () => {
      socket.off('conversation.new', invalidate);
      socket.off('conversation.updated', invalidate);
      socket.off('message.received', invalidate);
    };
  }, [mode, query]);

  const { active, queue } = useMemo(() => {
    if (mode === 'mock') {
      return {
        active: sortForHome(
          mockConversations.filter((c) => c.segment === 'active' || c.ownership === 'mine'),
        ),
        queue: mockConversations.filter((c) => c.segment === 'queue' || c.ownership === 'queue'),
      };
    }
    const live = query.data?.live ?? [];
    return {
      active: sortForHome(live.filter((c) => c.segment === 'active' || c.ownership === 'mine')),
      queue: live.filter((c) => c.segment === 'queue' || c.ownership === 'queue'),
    };
  }, [mode, query.data]);

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
    } catch {
      /* keep drawer open */
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        safe
        title="Atendimento"
        onMenuPress={open}
        menuBadge={queue.length}
        right={<Badge label={mode === 'live' ? (query.isFetching ? 'Atualizando…' : 'Online') : 'Demo'} tone={mode === 'live' ? 'success' : 'primary'} />}
      />
      <View style={styles.stats}>
        <StatTile value={String(queue.length)} label="na fila" accent />
        <StatTile value={String(active.length)} label="com você" />
        <StatTile value={String(active.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0))} label="não lidas" />
      </View>

      {mode === 'live' && query.isLoading ? (
        <Loading />
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
              title="Nenhum atendimento com você"
              subtitle="Assuma alguém da fila para começar."
              actionLabel="Ver fila"
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
