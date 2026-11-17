import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, typography } from '@/src/design-system/tokens';
import { Badge, Body, Button, Card, Muted } from '@/src/design-system/ui';
import { openRemotePdf } from '@/src/features/portal/openRemote';
import { PortalPage, errorText } from '@/src/features/portal/PortalPage';
import { shortDate } from '@/src/features/portal/format';
import { usePortalExam } from '@/src/features/portal/usePortal';
import { portalExamPdf } from '@/src/shared/api/portal.api';

/** Um resultado de exame, do jeito que o laboratório mandou. O app não interpreta nada. */
export default function ExamDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('portal');
  const q = usePortalExam(id);
  const [busy, setBusy] = useState(false);
  const e = q.data;

  const openPdf = async () => {
    setBusy(true);
    try {
      const { url } = await portalExamPdf(id);
      await openRemotePdf(url, e?.exam_name ?? 'laudo');
    } catch (err) {
      await showDialog({ title: errorText(err, t('documents.openFail')), tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalPage title={t('exams.title')} loading={q.isLoading} error={q.isError || (!q.isLoading && !e) ? errorText(q.error, t('exams.notFound')) : null} onRetry={() => void q.refetch()}>
      {e ? (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row' }}><Badge label={e.status === 'rectified' ? t('exams.rectified') : t('exams.ready')} tone="success" /></View>
            <Text style={styles.title}>{e.exam_name}</Text>
            <Muted>{`${e.collected_at ? `${t('exams.collectedOn', { date: shortDate(e.collected_at) })}. ` : ''}${t('exams.releasedOn', { date: shortDate(e.released_at) })}.`}</Muted>
          </View>
          {e.analytes.length ? (
            <Card style={{ gap: 0 }}>
              {e.analytes.map((a, i) => (
                <View key={i} style={[styles.row, i > 0 && styles.border]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.analyte}>{a.name}</Text>
                    {a.reference ? <Muted style={{ fontSize: 12.5 }}>{t('exams.reference', { ref: a.reference })}</Muted> : null}
                    {a.abnormal ? <View style={{ flexDirection: 'row' }}><Badge label={t('exams.abnormal')} tone="warn" /></View> : null}
                  </View>
                  <Text style={styles.value}>
                    {a.value}
                    {a.unit ? <Text style={styles.unit}>{` ${a.unit}`}</Text> : null}
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card><Body>{t('exams.onlyPdf')}</Body></Card>
          )}
          {e.has_pdf ? <Button label={t('exams.openPdf')} icon="document-text-outline" variant="soft" loading={busy} onPress={() => void openPdf()} /> : null}
          <Muted style={{ fontSize: 12.5, lineHeight: 18 }}>{t('exams.disclaimer')}</Muted>
        </>
      ) : null}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: typography.fontFamilyBold, fontSize: 24, lineHeight: 29, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
  analyte: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  value: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  unit: { fontFamily: typography.fontFamilyMedium, color: colors.textMuted },
});
