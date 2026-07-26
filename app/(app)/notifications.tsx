import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Badge, Body, ListRow, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
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
        title="Avisos"
        right={
          <Pressable onPress={() => router.push('/notification-prefs')} hitSlop={8}>
            <Body style={{ color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13 }}>
              Preferências
            </Body>
          </Pressable>
        }
      />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          mode === 'live' ? (
            <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
          ) : undefined
        }
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
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
                <Body style={styles.title}>{item.title}</Body>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: 6,
  },
  unread: { borderColor: colors.primary, backgroundColor: '#f5f8ff' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontFamily: typography.fontFamilySemiBold },
});
