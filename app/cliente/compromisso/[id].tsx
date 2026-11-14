import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, IconName, IconTile, Muted, PressableScale, Rise, Screen } from '@/src/design-system/ui';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { DetailHero } from '@/src/features/client/DetailHero';
import { bookingKindLabel, bookingPill } from '@/src/features/client/BookingCard';
import { useBooking, useConfirmBooking, useUnconfirmBooking } from '@/src/features/client/useClientData';
import { useWeek } from '@/src/features/fitness/useFitness';
import { formatHour, minutesUntilLabel, sameDay, weekdayShort } from '@/src/shared/format';
import { useNow } from '@/src/shared/useNow';

function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.action}>
      <IconTile icon={icon} size={40} />
      <Text style={styles.actionLabel}>{label}</Text>
    </PressableScale>
  );
}

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: b, isLoading } = useBooking(id);
  const { data: week } = useWeek();
  const confirm = useConfirmBooking();
  const unconfirm = useUnconfirmBooking();

  if (!b) {
    return <Screen>{isLoading ? null : <EmptyState icon="calendar-outline" title="Compromisso não encontrado" actionLabel="Voltar à agenda" onAction={() => router.back()} />}</Screen>;
  }

  const start = new Date(b.starts_at);
  const isToday = sameDay(start, new Date());
  const upcoming = start.getTime() > now;
  const pill = bookingPill(b);
  const workout = b.category === 'session' && isToday ? week?.days.find((d) => d.date === week.today)?.items?.[0] : undefined;
  const hoursAway = (start.getTime() - now) / 3_600_000;

  return (
    <Screen backdrop="none">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <DetailHero
          onBack={() => router.back()}
          right={upcoming ? <Badge label={minutesUntilLabel(b.starts_at)} tone="primary" /> : undefined}
          eyebrow={`${bookingKindLabel[b.category]} · ${b.tenant_name}`}
          title={b.service_name ?? 'Compromisso'}
        >
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Muted style={{ fontSize: 12 }}>Quando</Muted>
              <Text style={styles.factValue}>{isToday ? `Hoje, ${weekdayShort(start).toLowerCase()} ${start.getDate()}` : `${weekdayShort(start)} ${start.getDate()}`}</Text>
            </View>
            <View style={styles.fact}>
              <Muted style={{ fontSize: 12 }}>Horário</Muted>
              <Text style={styles.factValue}>{`${formatHour(b.starts_at)} – ${formatHour(b.ends_at)}`}</Text>
            </View>
          </View>
        </DetailHero>

        <View style={{ paddingHorizontal: 20 }}>
          {b.status === 'pending' ? (
            <Rise index={2} style={{ marginTop: 16 }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.warnDot} />
                  <Text style={styles.statusTitle}>Falta confirmar sua presença</Text>
                </View>
                <Muted style={{ marginTop: 6, lineHeight: 19 }}>{`Confirmando, ${b.provider_name?.split(' ')[0]} já deixa tudo pronto para você.`}</Muted>
                <Button label="Confirmar presença" loading={confirm.isPending} onPress={() => confirm.mutate(b.id)} style={{ marginTop: 14 }} />
              </Card>
            </Rise>
          ) : (
            <Rise index={2} style={{ marginTop: 16 }}>
              <View style={[styles.statusRow, { backgroundColor: b.status === 'confirmed' ? colors.successSoft : '#f0f2f5' }]}>
                <Ionicons name={b.status === 'confirmed' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={22} color={b.status === 'confirmed' ? colors.success : colors.textSoft} />
                <Text style={[styles.statusTitle, { flex: 1, color: b.status === 'confirmed' ? colors.success : colors.textSoft }]}>{pill.label}</Text>
                {b.status === 'confirmed' && b.can_confirm === false && upcoming ? <Button label="Desfazer" variant="ghost" compact onPress={() => unconfirm.mutate(b.id)} /> : null}
              </View>
            </Rise>
          )}

          <Rise index={3} style={{ marginTop: 12 }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={[styles.info, styles.infoBorder]}>
                <Avatar initials={(b.provider_name ?? '').split(' ').map((w) => w[0]).slice(0, 2).join('')} size={44} />
                <View style={{ flex: 1 }}>
                  <Muted style={{ fontSize: 12 }}>Profissional</Muted>
                  <Text style={styles.infoValue}>{b.provider_name}</Text>
                </View>
                <IconButton icon="chatbubble-outline" tone="soft" accessibilityLabel={`Conversar com ${b.provider_name}`} onPress={() => router.push(`/cliente/chat/${b.tenant_slug}`)} />
              </View>
              {b.location ? (
                <Pressable
                  style={[styles.info, workout ? styles.infoBorder : null]}
                  accessibilityRole="link"
                  accessibilityLabel={`Ver rota para ${b.location}`}
                  onPress={() => void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${b.location}, ${b.tenant_name}`)}`)}
                >
                  <IconTile icon="location-outline" size={44} tone="neutral" />
                  <View style={{ flex: 1 }}>
                    <Muted style={{ fontSize: 12 }}>Local</Muted>
                    <Text style={styles.infoValue}>{b.location}</Text>
                  </View>
                  <Text style={styles.link}>Rota</Text>
                </Pressable>
              ) : null}
              {workout ? (
                <Pressable style={styles.info} accessibilityRole="button" onPress={() => router.push(`/cliente/treino/${workout.id}`)}>
                  <IconTile icon="barbell-outline" size={44} />
                  <View style={{ flex: 1 }}>
                    <Muted style={{ fontSize: 12 }}>Ficha desta sessão</Muted>
                    <Text style={styles.infoValue}>{workout.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </Card>
          </Rise>

          {upcoming && b.status !== 'cancelled' ? (
            <>
              <Rise index={4} style={styles.actions}>
                <ActionTile icon="calendar-outline" label="Guardar no calendário" onPress={() => router.push('/cliente/calendario')} />
                <ActionTile icon="swap-horizontal-outline" label="Pedir outro horário" onPress={() => router.push(`/cliente/chat/${b.tenant_slug}?remarcar=${b.id}`)} />
              </Rise>
              {b.can_cancel ? (
                <Rise index={5}>
                  <Button label="Cancelar compromisso" variant="secondary" onPress={() => router.push(`/cliente/cancelar/${b.id}`)} style={{ marginTop: 12 }} />
                  <Muted style={styles.policy}>
                    {hoursAway < 12 ? 'Cancelando agora, com menos de 12 h, conta como falta no seu plano.' : 'Cancelamento sem custo até 12 h antes.'}
                  </Muted>
                </Rise>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', gap: 8, marginTop: 18 },
  fact: { flex: 1, padding: 14, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.85)', ...shadows.card },
  factValue: { marginTop: 3, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  warnDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warn },
  statusTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 18, paddingRight: 8, borderRadius: radii.xl, minHeight: 56 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  infoValue: { marginTop: 2, fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
  link: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1, gap: 12, padding: 16, borderRadius: radii.xl, backgroundColor: '#fff', ...shadows.card },
  actionLabel: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text, lineHeight: 18 },
  policy: { marginTop: 10, textAlign: 'center', lineHeight: 18 },
});
