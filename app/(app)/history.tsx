import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Loading, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { conversations as mockConversations } from '@/src/mocks/data';
import { useAuth } from '@/src/features/auth/AuthContext';
import { getMyHistory } from '@/src/shared/api/conversations.api';
import { mapApiConversation } from '@/src/features/inbox/mapConversation';
import { ConversationCard } from '@/src/features/inbox/ConversationCard';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
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
      <ScreenHeader safe title="Histórico" subtitle="Atendimentos encerrados" onBack={() => router.back()} />
      {mode === 'live' && query.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom, gap: 10 }}
          refreshControl={mode === 'live' ? <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} /> : undefined}
          ListEmptyComponent={<EmptyState icon="time-outline" title="Nenhum histórico ainda" subtitle="Atendimentos encerrados aparecem aqui." />}
          renderItem={({ item }) => <ConversationCard item={item} onPress={() => router.push(`/conversation/${item.id}`)} />}
        />
      )}
    </Screen>
  );
}
