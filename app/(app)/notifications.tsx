import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { locale } from '@/src/i18n';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Body, Button, EmptyState, IconButton, Muted, Screen, ScreenHeader, Segmented } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { Toast, useToast } from '@/src/design-system/Toast';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { notifications as mockNotifications } from '@/src/mocks/data';
import { categoryForType, PUSH_CATEGORIES } from '@/src/features/notifications/catalog';
import { useAuth } from '@/src/features/auth/AuthContext';
import { type ApiNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from '@/src/shared/api/notifications.api';
import { SkeletonList } from '@/src/design-system/Skeleton';

/** Hoje só a hora; de outro dia, a data com a hora (o histórico mistura dias). */
function formatWhen(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' })} ${time}`;
}

type Row = { id: string; type: string; title: string; body: string; at: string; read: boolean; conversationId?: string; href?: string };

export default function NotificationsScreen() {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { mode } = useAuth();
  const { toast, show } = useToast(2600);
  const [tab, setTab] = useState<'new' | 'history'>('new');
  // Demonstração: não há servidor, então o que foi visto fica só aqui.
  const [seenInDemo, setSeenInDemo] = useState<Set<string>>(new Set());
  const key = ['notifications', mode] as const;

  const query = useQuery({
    queryKey: key,
    enabled: mode === 'live',
    refetchInterval: 60_000,
    queryFn: async () => (await listNotifications(1, 40)).data ?? [],
  });

  const all: Row[] =
    mode === 'mock'
      ? mockNotifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          at: n.at,
          read: n.read || seenInDemo.has(n.id),
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
            at: formatWhen(n.created_at),
            read: !!n.is_read,
            conversationId,
            href: n.link?.startsWith('/agenda') ? '/(app)/agenda' : undefined,
          };
        });

  const fresh = all.filter((n) => !n.read);
  const seen = all.filter((n) => n.read);
  const shown = tab === 'new' ? fresh : seen;

  /** O aviso visto sai da lista de novos na hora, sem esperar o servidor. */
  const markSeenLocally = (ids: string[] | 'all') => {
    if (mode === 'mock') {
      setSeenInDemo((prev) => new Set([...prev, ...(ids === 'all' ? all.map((n) => n.id) : ids)]));
      return;
    }
    qc.setQueryData<ApiNotification[]>(key, (old) => old?.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, is_read: true } : n)));
  };

  const markAll = useMutation({
    mutationFn: async () => {
      if (mode === 'live') await markAllNotificationsRead();
    },
    onMutate: () => {
      const before = qc.getQueryData<ApiNotification[]>(key);
      markSeenLocally('all');
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (mode === 'live') qc.setQueryData(key, ctx?.before);
      else setSeenInDemo(new Set());
      show(t('notifications.markFailed'), 'error');
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const openRow = async (item: Row) => {
    if (!item.read) {
      markSeenLocally([item.id]);
      if (mode === 'live') {
        try {
          await markNotificationRead(item.id);
        } catch {
          /* o próximo refresh devolve o aviso como novo, sem perder nada */
        }
      }
    }
    if (item.conversationId) router.push(`/conversation/${item.conversationId}`);
    else if (item.href) router.push(item.href as never);
  };

  return (
    <Screen>
      <ScreenHeader
        safe
        title={t('notifications.title')}
        right={<IconButton icon="options-outline" accessibilityLabel={t('notifications.prefs')} onPress={() => router.push('/notification-prefs')} />}
      />
      <View style={styles.tools}>
        <Segmented
          value={tab}
          onChange={(k) => setTab(k as 'new' | 'history')}
          options={[
            { key: 'new', label: fresh.length ? `${t('notifications.tabNew')} ${fresh.length}` : t('notifications.tabNew') },
            { key: 'history', label: t('notifications.tabHistory') },
          ]}
        />
        {tab === 'new' && fresh.length > 0 ? (
          <Button label={t('notifications.markAll')} icon="checkmark-done-outline" variant="soft" compact loading={markAll.isPending} onPress={() => markAll.mutate()} style={styles.markAll} />
        ) : null}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        refreshControl={
          mode === 'live' ? (
            <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
          ) : undefined
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom, gap: 10 }}
        ListEmptyComponent={
          query.isLoading ? (
            <SkeletonList variant="conversation" count={5} />
          ) : tab === 'new' ? (
            <View style={{ gap: 12 }}>
              <EmptyState icon="checkmark-done-outline" title={t('notifications.caughtUp')} subtitle={t('notifications.caughtUpHint')} />
              {seen.length > 0 ? <Button label={t('notifications.seeHistory')} variant="soft" onPress={() => setTab('history')} /> : null}
            </View>
          ) : (
            <Muted style={{ textAlign: 'center', marginTop: 40 }}>{t('notifications.historyEmpty')}</Muted>
          )
        }
        renderItem={({ item }) => {
          const catId = categoryForType(item.type);
          const cat = PUSH_CATEGORIES.find((c) => c.id === catId);
          return (
            <Pressable style={[styles.row, !item.read && styles.unread]} onPress={() => void openRow(item)}>
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
      <Toast toast={toast} top={insets.top + 64} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tools: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  markAll: { alignSelf: 'flex-end', marginTop: 12 },
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
