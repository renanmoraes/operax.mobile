import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/src/i18n';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, EmptyState, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
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

  const data =
    mode === 'live'
      ? (query.data ?? []).map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          category: tpl.category || '—',
          language: tpl.language || 'pt_BR',
          preview: tpl.body || tpl.name,
          status: (tpl.status === 'approved' ? 'approved' : 'pending') as 'approved' | 'pending',
        }))
      : mockTemplates;

  return (
    <Screen>
      <ScreenHeader safe title={t('templates.title')} subtitle={t('templates.subtitle')} onBack={() => router.back()} />
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
          ListEmptyComponent={<EmptyState icon="document-text-outline" title={t('templates.emptyTitle')} subtitle={t('templates.emptySub')} />}
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
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  preview: { backgroundColor: colors.primaryWash, borderRadius: radii.md, borderBottomLeftRadius: 6, padding: 12 },
  previewText: { fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, color: colors.text },
});
