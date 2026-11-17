import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, typography } from '@/src/design-system/tokens';
import { Badge, Button, Card, EmptyState, IconTile, Muted, PressableScale } from '@/src/design-system/ui';
import { locale } from '@/src/i18n';
import { PortalPage, errorText } from '@/src/features/portal/PortalPage';
import { shortDate } from '@/src/features/portal/format';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalReminders, usePortalScope, useRefreshPortalHome } from '@/src/features/portal/usePortal';
import { portalDismissReminder, type PortalReminder } from '@/src/shared/api/portal.api';

const when = (iso: string) => new Date(iso).toLocaleString(locale(), { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Os avisos que a empresa marcou para o cliente. Ele pode dizer que não quer mais um deles. */
export default function RemindersScreen() {
  const { t } = useTranslation('portal');
  const qc = useQueryClient();
  const { tenant } = usePortalScope();
  const refreshHome = useRefreshPortalHome();
  const q = usePortalReminders();
  useFocusRefetch(q.refetch);
  const [asking, setAsking] = useState<PortalReminder | null>(null);

  const stop = useMutation({
    mutationFn: (id: string) => portalDismissReminder(id),
    onSuccess: async () => {
      setAsking(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['portal', tenant, 'reminders'] }), refreshHome()]);
      await showDialog({ title: t('reminders.stopped'), tone: 'success' });
    },
    onError: (e) => {
      setAsking(null);
      void showDialog({ title: errorText(e, t('common.loadFail')), tone: 'warn' });
    },
  });
  const items = q.data ?? [];

  return (
    <PortalPage title={t('reminders.title')} lead={t('reminders.lead')} loading={q.isLoading} error={q.isError ? t('common.loadFail') : null} onRetry={() => void q.refetch()}>
      {!items.length ? <EmptyState icon="notifications-outline" title={t('reminders.empty')} /> : null}
      {items.map((r) => (
        <Card key={r.id} style={{ gap: 10 }}>
          <View style={styles.row}>
            <IconTile icon="notifications-outline" size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.title}</Text>
              <Muted style={{ fontSize: 12.5, marginTop: 2 }}>
                {r.next_at ? t('reminders.next', { when: when(r.next_at) }) : r.last_sent_at ? t('reminders.last', { date: shortDate(r.last_sent_at) }) : ''}
              </Muted>
            </View>
          </View>
          {r.dismissed ? (
            <View style={{ flexDirection: 'row' }}><Badge label={t('reminders.dismissed')} /></View>
          ) : (
            <PressableScale onPress={() => setAsking(r)} accessibilityRole="button">
              <Text style={styles.stop}>{t('reminders.stop')}</Text>
            </PressableScale>
          )}
        </Card>
      ))}

      <BottomSheet visible={!!asking} onClose={() => setAsking(null)} title={t('reminders.stopTitle')}>
        <Muted style={{ marginBottom: 8 }}>{t('reminders.stopBody', { title: asking?.title ?? '' })}</Muted>
        <View style={{ gap: 10, paddingBottom: 14, paddingHorizontal: 2 }}>
          <Button label={t('reminders.stopYes')} loading={stop.isPending} onPress={() => asking && stop.mutate(asking.id)} />
          <Button label={t('common.back')} variant="secondary" onPress={() => setAsking(null)} />
        </View>
      </BottomSheet>
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
  stop: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textMuted },
});
