import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { QrCode } from '@/src/design-system/QrCode';
import { colors, text, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { useTickets } from '@/src/features/fitness/achievements';

/** Ingressos do aluno nos eventos: o QR que a equipe lê na entrada. Ele muda a cada 10 minutos e a tela se renova sozinha. */
export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('fitness');
  const { data, isLoading, isError, refetch } = useTickets();
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

  return (
    <Screen>
      <TopBar safe title={t('ach.ticketsTitle')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 14 }}>
        {isLoading ? null : isError ? (
          <EmptyState icon="cloud-offline-outline" title={t('ach.loadFail')} actionLabel={t('ach.retry')} onAction={() => void refetch()} />
        ) : !data?.length ? (
          <EmptyState icon="ticket-outline" title={t('ach.ticketsEmpty')} />
        ) : (
          data.map((tk, i) => (
            <Rise key={tk.registration_id} index={i}>
              <Card style={styles.card}>
                <Text style={styles.name}>{tk.event.name}</Text>
                {tk.event.starts_at ? <Muted style={{ marginTop: 2 }}>{when(tk.event.starts_at)}</Muted> : null}
                {tk.event.has_achievement ? (
                  <View style={styles.badge}><Ionicons name="trophy-outline" size={14} color={colors.primary} /><Text style={styles.badgeText}>{t('ach.ticketAchievement')}</Text></View>
                ) : null}
                {tk.checked_in_at ? (
                  <View style={styles.done}>
                    <Ionicons name="checkmark-circle" size={44} color={colors.success} />
                    <Text style={styles.doneText}>{t('ach.ticketChecked', { time: new Date(tk.checked_in_at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}</Text>
                  </View>
                ) : (
                  <View style={styles.qr}>
                    <QrCode value={tk.ticket.code} size={232} accessibilityLabel={t('ach.ticketA11y', { event: tk.event.name })} />
                    <Muted style={{ textAlign: 'center', fontSize: 12.5 }}>{t('ach.ticketHint')}</Muted>
                  </View>
                )}
              </Card>
            </Rise>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  name: { ...text.section, color: colors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.primaryWash },
  badgeText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.primaryDeep },
  qr: { alignItems: 'center', gap: 12, marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.borderSoft },
  done: { alignItems: 'center', gap: 8, marginTop: 18, paddingVertical: 24 },
  doneText: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.success },
});
