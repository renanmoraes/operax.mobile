import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, EmptyState, Muted, PressableScale, Rise, Card } from '@/src/design-system/ui';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/src/design-system/tokens';
import { PortalPage } from '@/src/features/portal/PortalPage';
import { orderAmount, orderStatus, shortDate } from '@/src/features/portal/format';
import { usePortalHome } from '@/src/features/portal/usePortal';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';

/** Os serviços (ordens de serviço) que estão no nome do cliente. */
export default function ServicesScreen() {
  const { t } = useTranslation('portal');
  const home = usePortalHome();
  useFocusRefetch(home.refetch);
  const orders = home.data?.service_orders ?? [];

  return (
    <PortalPage title={t('services.title')} lead={t('services.lead')} loading={home.isLoading} error={home.isError ? t('common.loadFail') : null} onRetry={() => void home.refetch()}>
      {!orders.length ? <EmptyState icon="construct-outline" title={t('services.empty')} /> : null}
      {orders.map((o, i) => {
        const status = orderStatus(o);
        const value = orderAmount(o);
        return (
          <Rise key={o.id} index={Math.min(i, 6)}>
            <PressableScale onPress={() => router.push(`/cliente/servico/${encodeURIComponent(o.id)}`)} accessibilityRole="button" accessibilityLabel={`${o.title}, ${status.label}`}>
              <Card style={styles.card}>
                <View style={styles.top}>
                  <Badge label={status.label} tone={status.tone} />
                  <Muted style={{ fontSize: 12 }}>{o.display_code}</Muted>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={2}>{o.title}</Text>
                    <Muted style={{ fontSize: 12.5, marginTop: 2 }}>{t('services.updatedOn', { date: shortDate(o.updated_at) })}</Muted>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
                {value ? <Text style={styles.value}>{value}</Text> : null}
              </Card>
            </PressableScale>
          </Rise>
        );
      })}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.text },
  value: { fontFamily: typography.fontFamilyBold, fontSize: 24, color: colors.text, fontVariant: ['tabular-nums'] },
});
