import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Button, Card, EmptyState, IconTile, Muted, Rise, Screen } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { DetailHero } from '@/src/features/client/DetailHero';
import { canUndoBookingAnswer, useBooking, useClassAction } from '@/src/features/client/useClientData';
import { formatClock, formatHour } from '@/src/shared/format';

const ROSTER = ['LS', 'JP', 'RC', 'TM', 'GA', 'BF', 'DN', 'KO', 'VE', 'HL', 'AM', 'PS'];
const SEATS_PER_ROW = 6;
const SEAT_GAP = 10;

export default function ClassDetailScreen() {
  const { t } = useTranslation(['client', 'common']);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: b } = useBooking(id);
  const action = useClassAction();
  const [now, setNow] = useState(() => Date.now());
  // Tamanho da vaga pela largura real do cartão: círculos iguais em qualquer celular.
  const [gridW, setGridW] = useState(0);
  const seatSize = gridW ? Math.floor((gridW - SEAT_GAP * (SEATS_PER_ROW - 1)) / SEATS_PER_ROW) : 0;
  const onGrid = (e: LayoutChangeEvent) => setGridW(Math.floor(e.nativeEvent.layout.width));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!b) return <Screen><EmptyState icon="people-outline" title={t('class.notFound')} actionLabel={t('common:actions.back')} onAction={() => router.back()} /></Screen>;

  const offer = b.status === 'offer';
  const accepted = b.status === 'confirmed';
  const declined = b.status === 'cancelled';
  const left = b.offer_expires_at ? Math.max(0, Math.round((new Date(b.offer_expires_at).getTime() - now) / 1000)) : 0;
  const capacity = b.class_capacity ?? 12;
  const enrolled = b.class_enrolled ?? 0;

  return (
    <Screen backdrop="none">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 180 }}>
        <DetailHero onBack={() => router.back()} right={<Badge label={t('booking.kind.class')} />} eyebrow={`${b.tenant_name} · ${b.location ?? ''}`} title={b.service_name ?? t('class.fallbackTitle')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <Avatar initials={(b.provider_name ?? '').split(' ').map((w) => w[0]).slice(0, 2).join('')} size={30} />
            <Muted style={{ fontSize: 14, color: colors.textSoft }}>{t('class.meta', { start: formatHour(b.starts_at), end: formatHour(b.ends_at), name: b.provider_name ?? '' })}</Muted>
          </View>
        </DetailHero>

        <View style={{ paddingHorizontal: 20 }}>
          <Rise index={2} style={{ marginTop: 16 }}>
            {offer ? (
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{t('booking.pill.offer')}</Text>
                  <Badge label={formatClock(left)} tone="primary" icon="time-outline" />
                </View>
                <Muted style={{ marginTop: 6, lineHeight: 19 }}>{t('class.waitlist', { n: b.waitlist_position ?? 1 })}</Muted>
              </Card>
            ) : accepted ? (
              <View style={[styles.banner, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
                <View>
                  <Text style={[styles.cardTitle, { color: colors.success }]}>{t('class.inClass')}</Text>
                  <Muted style={{ color: '#166534', marginTop: 2 }}>{t('class.seeYou', { name: b.provider_name?.split(' ')[0] ?? '', time: formatHour(b.starts_at) })}</Muted>
                </View>
              </View>
            ) : declined ? (
              <Card>
                <Text style={styles.cardTitle}>{t('class.passedOn')}</Text>
                <Muted style={{ marginTop: 4, lineHeight: 19 }}>{t('class.passedOnBody')}</Muted>
              </Card>
            ) : null}
          </Rise>

          <Rise index={3} style={{ marginTop: 12 }}>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{t('class.group')}</Text>
                <Muted>{t('class.enrolled', { enrolled, capacity })}</Muted>
              </View>
              <View style={styles.seats} onLayout={onGrid} accessible accessibilityLabel={t('class.enrolled', { enrolled, capacity })}>
                {Array.from({ length: capacity }, (_, i) => {
                  const mine = (offer && i === enrolled) || (accepted && i === enrolled - 1);
                  const filled = i < enrolled && !mine;
                  return (
                    <View key={i} style={[styles.seat, { width: seatSize, height: seatSize, borderRadius: seatSize / 2, opacity: seatSize ? 1 : 0 }, filled ? styles.seatFilled : mine ? styles.seatMine : styles.seatFree]}>
                      <Text style={[styles.seatText, { color: filled ? '#fff' : colors.primaryDeep }]} numberOfLines={1}>
                        {filled ? ROSTER[i] : mine ? (accepted ? t('class.seatMe') : t('class.seatYou')) : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.legend}>
                <Legend color={colors.primary} label={t('class.legendEnrolled')} />
                <Legend color={colors.primaryTint} border={colors.primary} label={t('class.legendYours')} />
                <Legend color="#f0f2f5" border="#c9d1de" dashed label={t('agenda.free')} />
              </View>
            </Card>
          </Rise>

          <Rise index={4} style={{ marginTop: 12 }}>
            <Card>
              <Text style={styles.cardTitle}>{t('class.bringTitle')}</Text>
              {[
                ['water-outline', t('class.bringWater')],
                ['albums-outline', t('class.bringTowel')],
                ['footsteps-outline', t('class.bringShoes')],
              ].map(([icon, label]) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <IconTile icon={icon as never} size={36} />
                  <Text style={styles.bring}>{label}</Text>
                </View>
              ))}
              {b.cancel_counts ? <Muted style={{ marginTop: 14, lineHeight: 18 }}>{t('class.cancelCounts')}</Muted> : null}
            </Card>
          </Rise>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {offer ? (
          <>
            <Button label={t('class.accept')} loading={action.isPending && action.variables?.action === 'accept'} onPress={() => action.mutate({ id: b.id, action: 'accept' })} />
            <Button label={t('class.pass')} variant="secondary" onPress={() => action.mutate({ id: b.id, action: 'decline' })} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {canUndoBookingAnswer() ? <Button label={t('home.undo')} variant="secondary" onPress={() => action.mutate({ id: b.id, action: 'reset' })} style={{ flex: 1 }} /> : null}
            {/* Vaga aceita e ainda cancelável: libera pela mesma tela de cancelar do compromisso (aula vai pela rota de aula). */}
            {accepted && b.can_cancel && new Date(b.starts_at).getTime() > now ? (
              <Button label={t('class.cancelSpot')} variant="secondary" onPress={() => router.push(`/cliente/cancelar/${b.id}`)} style={{ flex: 1 }} />
            ) : null}
            <Button label={t('cancel.backToAgenda')} onPress={() => router.back()} style={{ flex: 1 }} />
          </View>
        )}
      </View>
    </Screen>
  );
}

function Legend({ color, label, border, dashed }: { color: string; label: string; border?: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, borderWidth: border ? 1.5 : 0, borderColor: border, borderStyle: dashed ? 'dashed' : 'solid' }} />
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radii.xl },
  seats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SEAT_GAP, marginTop: 16 },
  seat: { alignItems: 'center', justifyContent: 'center' },
  seatFilled: { backgroundColor: colors.primary },
  seatMine: { backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: colors.primary },
  seatFree: { backgroundColor: '#f0f2f5', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#c9d1de' },
  seatText: { fontFamily: typography.fontFamilyBold, fontSize: 12, lineHeight: 15, textAlign: 'center', includeFontPadding: false },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 },
  bring: { fontFamily: typography.fontFamily, fontSize: 14, color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, gap: 10, backgroundColor: 'rgba(244,247,252,0.94)' },
});
