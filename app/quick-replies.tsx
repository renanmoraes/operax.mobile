import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Body, Muted, Screen, Title } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { listQuickReplies } from '@/src/shared/api/quick-replies.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { quickReplies as mockQuickReplies } from '@/src/mocks/data';

export default function QuickRepliesScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { mode } = useAuth();
  const query = useQuery({
    queryKey: ['quick-replies'],
    enabled: mode === 'live',
    queryFn: listQuickReplies,
  });

  const data = mode === 'live' ? query.data ?? [] : mockQuickReplies;

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Respostas rápidas</Title>
        <Muted>{mode === 'live' ? 'API real' : 'Mock'} — toque para voltar à conversa.</Muted>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: 40 }}>
            {query.isLoading ? 'Carregando…' : 'Nenhuma resposta rápida.'}
          </Muted>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => {
              if (conversationId) router.back();
              else router.replace('/(app)/inbox');
            }}
          >
            <Body style={styles.title}>{item.title}</Body>
            <Muted>/{item.slug}</Muted>
            <Body style={{ marginTop: 4 }}>{item.body}</Body>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  row: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: 2,
  },
  title: { fontFamily: typography.fontFamilySemiBold },
});
