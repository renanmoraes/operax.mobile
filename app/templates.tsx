import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/src/i18n';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Chip, EmptyState, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { listTemplates, sendTemplateMessage } from '@/src/shared/api/templates.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { templates as mockTemplates } from '@/src/mocks/data';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission } from '@/src/features/auth/useCan';

/** Nome traduzido de categoria/idioma da Meta (MARKETING, pt_BR…); o que não conhecemos aparece como veio. */
function metaLabel(kind: 'category' | 'language', value: string): string {
  const key = `inbox:templates.${kind}.${kind === 'category' ? value.toUpperCase() : value}`;
  return i18n.exists(key) ? i18n.t(key as never) : value;
}

export default function TemplatesScreenGuarded() {
  const { t } = useTranslation('inbox');
  return (
    <RequirePermission need="templates" title={t('templates.guardTitle')}>
      <TemplatesScreen />
    </RequirePermission>
  );
}

function TemplatesScreen() {
  const { t } = useTranslation('inbox');
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const query = useQuery({
    queryKey: ['templates'],
    enabled: mode === 'live',
    queryFn: () => listTemplates(),
  });
  const sendMut = useMutation({
    mutationFn: (templateId: string) =>
      sendTemplateMessage(conversationId!, { template_id: templateId }),
    onSuccess: () => {
      setToast({ text: t('templates.queued'), tone: 'success' });
      setTimeout(() => router.back(), 800);
    },
    onError: () => setToast({ text: t('templates.sendFailed'), tone: 'danger' }),
  });

  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState<'all' | 'company' | 'operax'>('all');
  const [status, setStatus] = useState<'all' | 'approved' | 'pending'>('all');

  const all =
    mode === 'live'
      ? (query.data ?? []).map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          category: tpl.category || '—',
          language: tpl.language || 'pt_BR',
          preview: tpl.body || tpl.name,
          status: (tpl.status === 'approved' ? 'approved' : 'pending') as 'approved' | 'pending',
          operax: tpl.operax_system === true,
        }))
      : mockTemplates.map((m) => ({ ...m, operax: false }));

  // Só leitura: o filtro esconde o que não interessa, nunca muda um template.
  const term = search.trim().toLowerCase();
  const data = useMemo(
    () =>
      all.filter((tpl) => {
        if (origin === 'company' && tpl.operax) return false;
        if (origin === 'operax' && !tpl.operax) return false;
        if (status !== 'all' && tpl.status !== status) return false;
        if (!term) return true;
        return `${tpl.name} ${tpl.preview}`.toLowerCase().includes(term);
      }),
    [all, origin, status, term],
  );
  const filtered = origin !== 'all' || status !== 'all' || !!term;

  return (
    <Screen>
      <ScreenHeader safe title={t('templates.title')} subtitle={t('templates.subtitle')} onBack={() => router.back()} />
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('templates.filters.search')} placeholderTextColor="#6b7486" autoCorrect={false} autoCapitalize="none" accessibilityLabel={t('templates.filters.search')} style={styles.searchInput} />
          {search ? <Ionicons name="close-circle" size={17} color={colors.textMuted} onPress={() => setSearch('')} accessibilityLabel={t('templates.filters.clear')} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('templates.filters.all')} selected={origin === 'all'} onPress={() => setOrigin('all')} />
          <Chip label={t('templates.filters.company')} selected={origin === 'company'} onPress={() => setOrigin('company')} />
          <Chip label={t('templates.filters.operax')} selected={origin === 'operax'} onPress={() => setOrigin('operax')} />
          <View style={styles.sep} />
          <Chip label={t('templates.filters.approvedOnly')} selected={status === 'approved'} onPress={() => setStatus(status === 'approved' ? 'all' : 'approved')} />
          <Chip label={t('templates.filters.reviewOnly')} selected={status === 'pending'} onPress={() => setStatus(status === 'pending' ? 'all' : 'pending')} />
        </ScrollView>
        {mode === 'live' && !query.isLoading ? <Muted style={{ fontSize: 12.5 }}>{t('templates.filters.count', { count: data.length })}</Muted> : null}
      </View>
      {toast ? (
        <View style={{ alignSelf: 'center', marginBottom: 8 }}>
          <Badge label={toast.text} tone={toast.tone} />
        </View>
      ) : null}
      {mode === 'live' && query.isLoading ? (
        <SkeletonList variant="contact" count={5} style={{ marginHorizontal: 20, marginTop: 8 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 10 }}
          ListEmptyComponent={filtered ? <EmptyState icon="funnel-outline" title={t('templates.filters.noneFound')} subtitle={t('templates.filters.noneFoundHint')} /> : <EmptyState icon="document-text-outline" title={t('templates.emptyTitle')} subtitle={t('templates.emptySub')} />}
          renderItem={({ item }) => {
            const approved = item.status === 'approved';
            return (
              <Card
                style={[{ gap: 8 }, !approved && { opacity: 0.6 }]}
                onPress={
                  approved
                    ? () => {
                        if (mode === 'live' && conversationId) {
                          sendMut.mutate(item.id);
                          return;
                        }
                        if (conversationId) router.back();
                        else router.replace('/(app)/inbox');
                      }
                    : undefined
                }
              >
                <View style={styles.rowTop}>
                  <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                  {item.operax ? <Badge label={t('templates.filters.operaxBadge')} tone="primary" /> : null}
                  <Badge label={approved ? t('templates.approved') : t('templates.inReview')} tone={approved ? 'success' : 'warn'} />
                </View>
                <Muted style={{ fontSize: 12.5 }}>
                  {metaLabel('category', item.category)} · {metaLabel('language', item.language)}
                </Muted>
                <View style={styles.preview}>
                  <Text style={styles.previewText} numberOfLines={4}>{item.preview}</Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  search: { height: 44, borderRadius: radii.pill, backgroundColor: colors.cardBg, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, ...shadows.card },
  searchInput: { flex: 1, minWidth: 0, fontFamily: typography.fontFamily, fontSize: 15, color: colors.text, padding: 0 },
  chips: { gap: 8, alignItems: 'center', paddingRight: 8 },
  sep: { width: 1, height: 22, backgroundColor: colors.track, marginHorizontal: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  preview: { backgroundColor: colors.primaryWash, borderRadius: radii.md, borderBottomLeftRadius: 6, padding: 12 },
  previewText: { fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, color: colors.text },
});
