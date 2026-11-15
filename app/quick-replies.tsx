import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, EmptyState, IconTile, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { listQuickReplies } from '@/src/shared/api/quick-replies.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { quickReplies as mockQuickReplies } from '@/src/mocks/data';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission } from '@/src/features/auth/useCan';

export default function QuickRepliesScreenGuarded() {
  const { t } = useTranslation('inbox');
  return (
    <RequirePermission need="quickReplies" title={t('quickReplies.title')}>
      <QuickRepliesScreen />
    </RequirePermission>
  );
}

function QuickRepliesScreen() {
  const { t } = useTranslation('inbox');
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const query = useQuery({
    queryKey: ['quick-replies'],
    enabled: mode === 'live',
    queryFn: () => listQuickReplies(),
  });

  const data = mode === 'live' ? query.data ?? [] : mockQuickReplies;

  return (
    <Screen>
      <ScreenHeader
        safe
        title={t('quickReplies.title')}
        subtitle={conversationId ? t('quickReplies.subtitleConv') : t('quickReplies.subtitle')}
        onBack={() => router.back()}
      />
      {mode === 'live' && query.isLoading ? (
        <SkeletonList variant="contact" count={5} style={{ marginHorizontal: 20, marginTop: 8 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 10 }}
          ListEmptyComponent={<EmptyState icon="flash-outline" title={t('quickReplies.emptyTitle')} subtitle={t('quickReplies.emptySub')} />}
          renderItem={({ item }) => (
            <Card
              style={{ flexDirection: 'row', gap: 12 }}
              onPress={() => {
                if (conversationId) router.back();
                else router.replace('/(app)/inbox');
              }}
            >
              <IconTile icon="flash-outline" size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.slug}>/{item.slug}</Text>
                </View>
                <Muted style={{ marginTop: 4, lineHeight: 19 }} numberOfLines={3}>{item.body}</Muted>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexShrink: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  slug: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.primary, backgroundColor: colors.primaryWash, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
});
