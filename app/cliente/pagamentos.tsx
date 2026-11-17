import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { Badge, Button, Card, EmptyState, Muted, SectionHeader } from '@/src/design-system/ui';
import { PortalPage } from '@/src/features/portal/PortalPage';
import { centsToMoney, shortDate } from '@/src/features/portal/format';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalPayments } from '@/src/features/portal/usePortal';
import type { PortalPayment } from '@/src/shared/api/portal.api';

export default function PaymentsScreen() {
  const { t } = useTranslation('portal');
  const q = usePortalPayments();
  useFocusRefetch(q.refetch);
  const open = q.data?.open ?? [];
  const paid = q.data?.paid ?? [];

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    await showDialog({ title: t('payments.pixCopiedTitle'), message: t('payments.pixCopiedBody'), tone: 'success' });
  };

  const card = (p: PortalPayment) => (
    <Card key={p.id} style={{ gap: 10 }}>
      <View style={styles.between}>
        <Badge label={p.status === 'pending' ? t('payments.pending') : p.status === 'paid' ? t('payments.statusPaid') : t('payments.refunded')} tone={p.status === 'pending' ? 'warn' : p.status === 'paid' ? 'success' : 'neutral'} />
        <Muted style={{ fontSize: 12 }}>{shortDate(p.paid_at ?? p.created_at)}</Muted>
      </View>
      <View>
        <Text style={styles.desc}>{p.description ?? t('payments.charge')}</Text>
        <Text style={styles.amount}>{centsToMoney(p.amount_cents)}</Text>
      </View>
      {p.status === 'pending' && p.pix_copy_paste ? (
        <>
          <Text style={styles.pix} numberOfLines={3} selectable>{p.pix_copy_paste}</Text>
          <Button label={t('payments.copyPix')} icon="copy-outline" onPress={() => void copy(p.pix_copy_paste!)} />
        </>
      ) : null}
      {p.status === 'pending' && p.payment_link ? (
        <Button label={t('payments.payLink')} icon={p.method === 'card' ? 'card-outline' : 'open-outline'} variant={p.pix_copy_paste ? 'ghost' : 'primary'} onPress={() => void Linking.openURL(p.payment_link!)} />
      ) : null}
    </Card>
  );

  return (
    <PortalPage title={t('payments.title')} lead={t('payments.lead')} loading={q.isLoading} error={q.isError ? t('common.loadFail') : null} onRetry={() => void q.refetch()}>
      <SectionHeader title={t('payments.toPay')} />
      {open.length ? open.map(card) : <EmptyState icon="wallet-outline" title={t('payments.noneOpen')} />}
      {paid.length ? (
        <>
          <SectionHeader title={t('payments.paid')} />
          {paid.map(card)}
        </>
      ) : null}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desc: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  amount: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 28, color: colors.text, fontVariant: ['tabular-nums'] },
  pix: { padding: 12, borderRadius: radii.md, backgroundColor: colors.pageBg, color: colors.textSoft, fontSize: 12, fontFamily: 'monospace' },
});
