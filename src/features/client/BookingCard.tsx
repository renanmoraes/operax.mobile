import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Muted } from '@/src/design-system/ui';
import { colors, numbers, radii, text, typography } from '@/src/design-system/tokens';
import i18n from '@/src/i18n';
import { formatHour } from '@/src/shared/format';
import type { ClientBooking } from './types';
import { useConfirmBooking } from './useClientData';

export const bookingKindLabel = (category: ClientBooking['category']): string => i18n.t(`client:booking.kind.${category}`);

export function bookingPill(b: ClientBooking): { label: string; tone: 'warn' | 'primary' | 'success' | 'neutral' | 'danger' } {
  switch (b.status) {
    case 'pending':
      return { label: i18n.t('client:booking.pill.pending'), tone: 'warn' };
    case 'offer':
      return { label: i18n.t('client:booking.pill.offer'), tone: 'primary' };
    case 'confirmed':
      return { label: i18n.t('client:booking.pill.confirmed'), tone: 'success' };
    case 'cancelled':
      return { label: i18n.t('client:booking.pill.cancelled'), tone: 'danger' };
    default:
      return { label: i18n.t('client:booking.pill.done'), tone: 'neutral' };
  }
}

export function bookingHref(b: ClientBooking) {
  return b.category === 'class' ? `/cliente/aula/${b.id}` : `/cliente/compromisso/${b.id}`;
}

export function BookingCard({ booking: b }: { booking: ClientBooking }) {
  const { t } = useTranslation(['client', 'common']);
  const confirm = useConfirmBooking();
  const pill = bookingPill(b);
  const strong = b.status === 'pending';
  const muted = b.status === 'done' || b.status === 'cancelled';
  return (
    <Card style={{ padding: 16 }}>
      <Pressable onPress={() => router.push(bookingHref(b) as never)} accessibilityRole="button" accessibilityLabel={`${b.service_name}, ${formatHour(b.starts_at)}`} style={styles.top}>
        <View style={[styles.time, strong ? { backgroundColor: colors.primary } : muted ? { backgroundColor: '#f0f2f5' } : { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.timeMain, { color: strong ? '#fff' : muted ? colors.textMuted : colors.primaryDeep }]}>{formatHour(b.starts_at)}</Text>
          <Text style={[styles.timeEnd, { color: strong ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}>{formatHour(b.ends_at)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12 }} numberOfLines={1}>{`${bookingKindLabel(b.category)} · ${b.tenant_name}`}</Muted>
          <Text style={[styles.title, muted && { color: colors.textMuted }]} numberOfLines={1}>{b.service_name}</Text>
          <Muted style={{ marginTop: 3 }} numberOfLines={1}>{t('booking.withProvider', { name: b.provider_name ?? '' })}</Muted>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 4 }} />
      </Pressable>
      <View style={styles.bottom}>
        <Badge label={pill.label} tone={pill.tone} />
        {b.status === 'pending' ? (
          <Button label={t('common:actions.confirm')} compact loading={confirm.isPending} onPress={() => confirm.mutate(b.id)} />
        ) : b.status === 'offer' ? (
          <Button label={t('booking.seeSlot')} compact onPress={() => router.push(bookingHref(b) as never)} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14 },
  time: { width: 58, borderRadius: radii.md + 4, paddingVertical: 10, alignItems: 'center' },
  timeMain: { ...numbers.sm },
  timeEnd: { marginTop: 1, fontFamily: typography.fontFamily, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  title: { marginTop: 3, ...text.section, color: colors.text },
  bottom: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
