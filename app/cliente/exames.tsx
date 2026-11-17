import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/design-system/tokens';
import { Badge, Card, EmptyState, Muted, PressableScale, Rise } from '@/src/design-system/ui';
import { PortalPage } from '@/src/features/portal/PortalPage';
import { shortDate } from '@/src/features/portal/format';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalExams } from '@/src/features/portal/usePortal';

export default function ExamsScreen() {
  const { t } = useTranslation('portal');
  const q = usePortalExams();
  useFocusRefetch(q.refetch);
  const items = q.data ?? [];
  return (
    <PortalPage title={t('exams.title')} lead={t('exams.lead')} loading={q.isLoading} error={q.isError ? t('common.loadFail') : null} onRetry={() => void q.refetch()}>
      {!items.length ? <EmptyState icon="flask-outline" title={t('exams.empty')} /> : null}
      {items.map((e, i) => (
        <Rise key={e.id} index={Math.min(i, 6)}>
          <PressableScale onPress={() => router.push(`/cliente/exame/${encodeURIComponent(e.id)}`)} accessibilityRole="button" accessibilityLabel={e.exam_name}>
            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{e.exam_name}</Text>
                  <Muted style={{ fontSize: 12.5, marginTop: 2 }}>
                    {e.collected_at ? `${t('exams.collectedOn', { date: shortDate(e.collected_at) })} · ` : ''}
                    {t('exams.releasedOn', { date: shortDate(e.released_at) })}
                  </Muted>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.badges}>
                <Badge label={e.status === 'rectified' ? t('exams.rectified') : t('exams.ready')} tone="success" />
                {e.outside_range ? <Badge label={t('exams.outside', { count: e.outside_range })} tone="warn" /> : null}
              </View>
            </Card>
          </PressableScale>
        </Rise>
      ))}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
