import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Rise, Screen, ScreenHeader, Segmented } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { ChannelRow } from '@/src/features/team-chat/parts';
import { useTeamChat } from '@/src/features/team-chat/TeamChatContext';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission } from '@/src/features/auth/useCan';

type Filter = 'all' | 'unread' | 'group' | 'dm';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Chat interno: grupos e conversas diretas com a equipe, como no Operax web. */
export default function TeamChatListScreenGuarded() {
  const { t } = useTranslation('team');
  return (
    <RequirePermission need="teamChat" title={t('list.title')}>
      <TeamChatListScreen />
    </RequirePermission>
  );
}

function TeamChatListScreen() {
  const { t } = useTranslation('team');
  const insets = useSafeAreaInsets();
  const { channels, unread, loading, refresh } = useTeamChat();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(
    () => ({
      unread: channels.filter((c) => c.unread > 0).length,
      group: channels.filter((c) => c.kind === 'group').length,
      dm: channels.filter((c) => c.kind === 'dm').length,
    }),
    [channels],
  );

  const shown = useMemo(() => {
    const term = fold(search.trim());
    return channels.filter((c) => {
      if (filter === 'unread' && c.unread <= 0) return false;
      if (filter === 'group' && c.kind !== 'group') return false;
      if (filter === 'dm' && c.kind !== 'dm') return false;
      return !term || fold(c.title).includes(term) || fold(c.preview ?? '').includes(term);
    });
  }, [channels, filter, search]);

  const pinned = shown.filter((c) => c.pinned);
  const rest = shown.filter((c) => !c.pinned);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} />}
        stickyHeaderIndices={[1]}
      >
        <ScreenHeader
          safe
          title={t('list.title')}
          subtitle={unread > 0 ? t('list.newMessages', { count: unread }) : t('list.allRead')}
          onBack={() => router.back()}
        />
        <View style={styles.tools}>
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('list.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('list.searchPlaceholder')}
              autoCorrect={false}
              style={styles.searchInput}
            />
            {search ? (
              <Ionicons name="close-circle" size={17} color={colors.textMuted} onPress={() => setSearch('')} accessibilityLabel={t('list.clearSearch')} />
            ) : null}
          </View>
          <Segmented
            value={filter}
            onChange={(k) => setFilter(k as Filter)}
            options={[
              { key: 'all', label: t('list.filterAll') },
              { key: 'unread', label: counts.unread ? t('list.filterNewCount', { count: counts.unread }) : t('list.filterNew') },
              { key: 'group', label: t('list.filterGroups') },
              { key: 'dm', label: t('list.filterDirect') },
            ]}
          />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {loading ? (
            <SkeletonList variant="channel" count={6} style={{ marginTop: 6 }} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={filter === 'unread' ? 'checkmark-done-outline' : 'chatbubbles-outline'}
              title={filter === 'unread' ? t('list.nothingNew') : search ? t('list.noOne') : t('list.noChats')}
              subtitle={filter === 'unread' ? t('list.nothingNewHint') : search ? t('list.checkName') : t('list.createOnWeb')}
            />
          ) : (
            <>
              {pinned.length ? (
                <Rise>
                  <Text style={styles.label}>{t('list.pinned')}</Text>
                  <View style={styles.card}>
                    {pinned.map((c, i) => (
                      <ChannelRow key={c.id} channel={c} last={i === pinned.length - 1} onPress={() => router.push(`/equipe/${c.id}`)} />
                    ))}
                  </View>
                </Rise>
              ) : null}
              {rest.length ? (
                <Rise index={1}>
                  {pinned.length ? <Text style={styles.label}>{t('list.chats')}</Text> : null}
                  <View style={[styles.card, !pinned.length && { marginTop: 6 }]}>
                    {rest.map((c, i) => (
                      <ChannelRow key={c.id} channel={c} last={i === rest.length - 1} onPress={() => router.push(`/equipe/${c.id}`)} />
                    ))}
                  </View>
                </Rise>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tools: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4, gap: 18, backgroundColor: colors.pageBg },
  search: {
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: typography.fontFamily, fontSize: 15, color: colors.text, padding: 0 },
  label: { ...text.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: colors.cardBg, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
});
