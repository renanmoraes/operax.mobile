import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Display,
  HeroCard,
  IconButton,
  IconName,
  IconTile,
  Muted,
  Num,
  PressableScale,
  Rise,
  Screen,
} from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, gradients, radii, shadows, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useBookings, useChats, useCompanies, useConfirmBooking, useUnconfirmBooking } from '@/src/features/client/useClientData';
import { useFitnessSummary, useWeek } from '@/src/features/fitness/useFitness';
import { formatDuration, formatHour, greeting, longDate, minutesUntilLabel } from '@/src/shared/format';

function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.shortcut}>
      <IconTile icon={icon} size={40} />
      <Text style={styles.shortcutLabel}>{label}</Text>
    </PressableScale>
  );
}

export default function ClientHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: bookings } = useBookings();
  const { data: chats } = useChats();
  const { data: week } = useWeek();
  const { data: summary } = useFitnessSummary();
  const { data: companies } = useCompanies();
  const confirm = useConfirmBooking();
  const unconfirm = useUnconfirmBooking();

  const client = user?.kind === 'client' ? user : null;
  const tenant = client?.memberships.find((m) => m.tenant_id === client.active_tenant_id);
  const firstName = client?.name?.split(' ')[0] ?? '';
  const now = Date.now();
  const next = bookings?.find((b) => new Date(b.ends_at).getTime() > now && (b.status === 'pending' || b.status === 'confirmed'));
  const today = week?.days.find((d) => d.date === week.today);
  const todayWorkout = today?.items?.[0];
  const todayDone = !!today?.done;
  const chat = chats?.find((c) => c.unread > 0) ?? chats?.[0];
  const lastTeam = chat ? [...chat.messages].reverse().find((m) => m.from === 'team') : undefined;
  const textMsg = chat ? [...chat.messages].reverse().find((m) => m.from === 'team' && m.text) : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.push('/(auth)/client-tenant-select')} accessibilityRole="button" accessibilityLabel={`Empresa: ${tenant?.tenant_name ?? ''}. Trocar`} style={styles.tenant}>
            <Avatar initials={companies?.find((c) => c.name === tenant?.tenant_name)?.initials ?? (tenant?.tenant_name ?? 'E').slice(0, 2).toUpperCase()} size={32} tone="brand" />
            <Text style={styles.tenantName}>{tenant?.tenant_name ?? 'Empresa'}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </PressableScale>
          <PressableScale onPress={() => router.navigate('/(client)/perfil')} accessibilityRole="button" accessibilityLabel="Meu perfil" scaleTo={0.92}>
            <Avatar initials={(client?.name ?? 'C').split(' ').map((w) => w[0]).slice(0, 2).join('')} size={44} />
          </PressableScale>
        </View>

        <Rise>
          <Muted style={{ marginTop: 22, fontSize: 14 }}>{longDate(new Date())}</Muted>
        </Rise>
        <Rise index={1}>
          <Display style={{ marginTop: 4 }}>{`${greeting()}, ${firstName}`}</Display>
        </Rise>

        {next ? (
          <Rise index={2} style={{ marginTop: 18 }}>
            <HeroCard>
              <View style={styles.rowBetween}>
                <Text style={styles.heroLabel}>Próximo compromisso</Text>
                <Badge label={minutesUntilLabel(next.starts_at)} tone="primary" />
              </View>
              <Text style={styles.heroTitle}>{next.service_name}</Text>
              <View style={styles.heroWho}>
                <Avatar initials={(next.provider_name ?? '').split(' ').map((w) => w[0]).slice(0, 2).join('')} size={30} />
                <Text style={styles.heroWhoText}>{`${formatHour(next.starts_at)} · ${formatDuration((new Date(next.ends_at).getTime() - new Date(next.starts_at).getTime()) / 1000)} · com ${next.provider_name}`}</Text>
              </View>
              {next.status === 'pending' ? (
                <View style={styles.heroActions}>
                  <Button label="Confirmar presença" icon="checkmark" loading={confirm.isPending} onPress={() => confirm.mutate(next.id)} style={{ flex: 1, minHeight: 50 }} />
                  <IconButton icon="chevron-forward" size={50} accessibilityLabel="Ver detalhes do compromisso" onPress={() => router.push(`/cliente/compromisso/${next.id}`)} />
                </View>
              ) : (
                <View style={styles.confirmed}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                  <Text style={styles.confirmedText}>Presença confirmada</Text>
                  <Button label="Desfazer" variant="ghost" compact onPress={() => unconfirm.mutate(next.id)} />
                </View>
              )}
            </HeroCard>
          </Rise>
        ) : null}

        <View style={styles.grid}>
          <Rise index={3} style={{ flex: 1 }}>
            <Card onPress={() => (todayWorkout ? router.push(`/cliente/treino/${todayWorkout.id}`) : router.navigate('/(client)/fitness'))} accessibilityLabel="Treino de hoje" style={styles.tile}>
              <View style={styles.rowBetween}>
                <IconTile icon="barbell-outline" size={38} />
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12 }}>{todayDone ? 'Feito' : 'Hoje'}</Muted>
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {todayWorkout ? todayWorkout.title.split('·')[1]?.trim() ?? todayWorkout.title : 'Dia de descanso'}
              </Text>
              <Muted style={{ marginTop: 4 }}>{todayWorkout ? `${todayWorkout.title.split('·')[0].trim()} · ${todayWorkout.parts[0]?.type === 'strength' ? todayWorkout.parts[0].items.length : 0} exercícios` : 'Alongamento leve se quiser'}</Muted>
              {todayWorkout && !todayDone ? (
                <View style={styles.startPill}>
                  <Ionicons name="play" size={12} color="#fff" />
                  <Text style={styles.startPillText}>Iniciar</Text>
                </View>
              ) : null}
            </Card>
          </Rise>
          <Rise index={4} style={{ flex: 1 }}>
            <Card onPress={() => router.push('/cliente/historico')} accessibilityLabel={`Sequência de ${summary?.streak ?? 0} dias`} style={[styles.tile, { overflow: 'hidden' }]}>
              <LinearGradient colors={gradients.warm} style={StyleSheet.absoluteFill} />
              <View style={styles.rowBetween}>
                <IconTile icon="flame-outline" size={38} tone="warm" />
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12 }}>Sequência</Muted>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 }}>
                <Num style={{ fontSize: 30, lineHeight: 32 }}>{summary?.streak ?? '–'}</Num>
                <Muted style={{ fontSize: 15, marginBottom: 3 }}>dias</Muted>
              </View>
              <Muted style={{ marginTop: 6 }}>{`Recorde: ${summary?.bestStreak ?? '–'} dias`}</Muted>
              <View style={styles.dots} accessible accessibilityLabel={`${week?.summary.done ?? 0} de ${week?.summary.planned ?? 0} treinos nesta semana`}>
                {week?.days.map((d) => (
                  <View
                    key={d.date}
                    style={[
                      styles.dot,
                      d.done ? { backgroundColor: colors.primary } : d.date === week.today && d.planned ? styles.dotToday : { backgroundColor: '#e6ebf3' },
                    ]}
                  />
                ))}
              </View>
            </Card>
          </Rise>
        </View>

        {chat && lastTeam ? (
          <Rise index={5} style={{ marginTop: 12 }}>
            <Card onPress={() => router.push(`/cliente/chat/${chat.tenant_slug}`)} accessibilityLabel={`Mensagem da equipe ${chat.tenant_name}`}>
              <View style={styles.rowBetween}>
                <Muted style={{ fontFamily: typography.fontFamilySemiBold }}>Mensagem da equipe</Muted>
                {chat.unread ? <Badge label={String(chat.unread)} tone="solid" /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Avatar initials={(lastTeam.author_name ?? 'E').split(' ').map((w) => w[0]).slice(0, 2).join('')} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.msgAuthor}>{lastTeam.author_name}</Text>
                  <Text style={styles.msgText} numberOfLines={2}>
                    {textMsg?.text}
                  </Text>
                </View>
                {lastTeam.attachment?.kind === 'video' ? (
                  <LinearGradient colors={gradients.media} style={styles.thumb}>
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={styles.thumbTime}>{`0:${String(lastTeam.attachment.duration_s).padStart(2, '0')}`}</Text>
                  </LinearGradient>
                ) : null}
              </View>
            </Card>
          </Rise>
        ) : null}

        <Rise index={6} style={styles.shortcuts}>
          <Shortcut icon="calendar-outline" label="Pedir horário" onPress={() => router.push('/cliente/chat/move-studio?pedido=1')} />
          <Shortcut icon="images-outline" label="Evolução" onPress={() => router.push('/cliente/evolucao')} />
          <Shortcut icon="stats-chart-outline" label="Histórico" onPress={() => router.push('/cliente/historico')} />
          <Shortcut icon="ribbon-outline" label="Conquistas" onPress={() => router.push('/cliente/conquistas')} />
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenant: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.75)', ...shadows.card },
  tenantName: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  heroTitle: { marginTop: 14, fontFamily: typography.fontFamilyHeavy, fontSize: 24, letterSpacing: -0.6, color: colors.text },
  heroWho: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  heroWhoText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 14, color: colors.textSoft },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, height: 50, paddingLeft: 16, paddingRight: 4, borderRadius: 999, backgroundColor: colors.successSoft },
  confirmedText: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.success },
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: { minHeight: 180, borderRadius: radii.xl },
  tileTitle: { marginTop: 14, fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text, letterSpacing: -0.2 },
  startPill: { marginTop: 'auto', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primary },
  startPillText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 13 },
  dots: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotToday: { backgroundColor: '#fff', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary },
  msgAuthor: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
  msgText: { marginTop: 3, fontFamily: typography.fontFamily, fontSize: 13.5, lineHeight: 19, color: colors.textSoft },
  thumb: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  thumbTime: { position: 'absolute', right: 6, bottom: 4, color: '#fff', fontSize: 10, fontFamily: typography.fontFamilySemiBold },
  shortcuts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shortcut: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4, borderRadius: radii.lg + 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  shortcutLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.text, textAlign: 'center' },
});
