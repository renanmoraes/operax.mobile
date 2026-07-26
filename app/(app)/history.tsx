import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ListRow, Loading, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { conversations as mockConversations } from '@/src/mocks/data';
import { useAuth } from '@/src/features/auth/AuthContext';
import { getMyHistory } from '@/src/shared/api/conversations.api';
import { mapApiConversation } from '@/src/features/inbox/mapConversation';

const channelLabel = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
} as const;

export default function HistoryScreen() {
  const { mode, user } = useAuth();

  const query = useQuery({
    queryKey: ['history', mode, user?.id],
    enabled: mode === 'live',
    queryFn: async () => {
      const history = await getMyHistory({ limit: 40 });
      return (history.data ?? []).map((c) => ({
        ...mapApiConversation(c, user?.id),
        segment: 'history' as const,
      }));
    },
  });

  const data = useMemo(() => {
    if (mode === 'mock') {
      return mockConversations.filter((c) => c.segment === 'history' || c.ownership === 'closed');
    }
    return query.data ?? [];
  }, [mode, query.data]);

  return (
    <Screen>
      <ScreenHeader title="Histórico" />
      {mode === 'live' && query.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          refreshControl={
            mode === 'live' ? (
              <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
            ) : undefined
          }
          ListEmptyComponent={
            <Muted style={{ textAlign: 'center', marginTop: 48 }}>Nenhum histórico ainda.</Muted>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.contactName}
              subtitle={item.lastMessage}
              meta={`${item.queue} · ${channelLabel[item.channel] ?? item.channel}`}
              trailing={<Muted>{item.updatedAt}</Muted>}
              onPress={() => router.push(`/conversation/${item.id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
