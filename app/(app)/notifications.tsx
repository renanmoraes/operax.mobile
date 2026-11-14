import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Body, IconButton, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, radii, shadows, spacing, typography } from '@/src/design-system/tokens';
import { notifications as mockNotifications } from '@/src/mocks/data';
import { categoryForType, PUSH_CATEGORIES } from '@/src/features/notifications/catalog';
import { useAuth } from '@/src/features/auth/AuthContext';
import { listNotifications, markNotificationRead } from '@/src/shared/api/notifications.api';

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const query = useQuery({
    queryKey: ['notifications', mode],
    enabled: mode === 'live',
    queryFn: async () => {
      const page = await listNotifications(1, 40);
      return page.data ?? [];
    },
  });

  const data =
    mode === 'mock'
      ? mockNotifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          at: n.at,
          read: n.read,
          conversationId: n.conversationId,
          href: n.href,
        }))
      : (query.data ?? []).map((n) => {
          const meta = n.metadata ?? {};
          const conversationId =
            (meta.conversation_id as string | undefined) ||
            (typeof n.link === 'string' && n.link.includes('/inbox/')
              ? n.link.split('/inbox/')[1]?.split(/[?#]/)[0]
              : undefined);
          return {
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body ?? '',
            at: formatTime(n.created_at),
            read: !!n.is_read,
            conversationId,
            href: n.link?.startsWith('/agenda') ? '/(app)/agenda' : undefined,
          };
        });

  return (
    <Screen>
      <ScreenHeader
        safe
        title="Avisos"
        right={<IconButton icon="options-outline" accessibilityLabel="Preferências de notificação" onPress={() => router.push('/notification-prefs')} />}
      />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          mode === 'live' ? (
            <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
          ) : undefined
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom, gap: 10 }}
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: 40 }}>
            {query.isLoading ? 'Carregando…' : 'Nenhum aviso.'}
          </Muted>
        }
        renderItem={({ item }) => {
          const catId = categoryForType(item.type);
          const cat = PUSH_CATEGORIES.find((c) => c.id === catId);
          return (
            <Pressable
              style={[styles.row, !item.read && styles.unread]}
              onPress={async () => {
                if (mode === 'live') {
                  try {
                    await markNotificationRead(item.id);
                  } catch {
                    /* ignore */
                  }
                }
                if (item.conversationId) router.push(`/conversation/${item.conversationId}`);
                else if (item.href) router.push(item.href as never);
              }}
            >
              <View style={styles.rowTop}>
                {!item.read ? <View style={styles.dot} /> : null}
                <Body style={styles.title} numberOfLines={2}>{item.title}</Body>
                <Muted>{item.at}</Muted>
              </View>
              <Muted>{item.body}</Muted>
              {cat ? <Badge label={cat.label} tone="primary" /> : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg + 2,
    padding: 16,
    gap: 8,
    ...shadows.card,
  },
  unread: { backgroundColor: '#f7f9ff', borderWidth: 1.5, borderColor: 'rgba(30,78,216,0.25)' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  title: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 14.5 },
});
