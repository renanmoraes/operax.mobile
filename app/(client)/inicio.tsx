import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
import { PortalAttention, PortalShortcutList } from '@/src/features/portal/PortalHome';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, gradients, radii, shadows, text, typography, glass } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { usePasswordPrompt } from '@/src/features/auth/usePasswordPrompt';
import { canUndoBookingAnswer, useBookings, useChats, useClientCapabilities, useCompanies, useConfirmBooking, useUnconfirmBooking } from '@/src/features/client/useClientData';
import { useFitnessSummary, useWeek } from '@/src/features/fitness/useFitness';
import { formatDuration, formatHour, greeting, longDate, minutesUntilLabel } from '@/src/shared/format';
import { useNow } from '@/src/shared/useNow';

/** Cor de cada atalho do Acesso rápido: o fundo do ícone, o traço e um véu bem leve no cartão. */
const QUICK_HUES = {
  blue: { tile: '#e6edff', ink: '#1e4ed8', wash: ['#ffffff', '#eef3ff'] },
  violet: { tile: '#efe8ff', ink: '#6d28d9', wash: ['#ffffff', '#f4efff'] },
  teal: { tile: '#ddf4f0', ink: '#0f8a7c', wash: ['#ffffff', '#ecf8f6'] },
  orange: { tile: '#ffefdf', ink: '#c2410c', wash: ['#ffffff', '#fff5eb'] },
} as const;

/** Cartão do Acesso rápido: ícone na cor do atalho, nome, uma frase do que tem lá e a seta. Dois por linha. */
function QuickCard({ icon: iconName, title, subtitle, hue, onPress }: { icon: IconName; title: string; subtitle: string; hue: keyof typeof QUICK_HUES; onPress: () => void }) {
  const c = QUICK_HUES[hue];
  // A seta só cabe em tela larga; no celular o ícone encolhe um pouco para o nome caber inteiro.
  const width = useWindowDimensions().width;
  const wide = width >= 440;
  const icon = width < 380 ? 38 : wide ? 48 : 44;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} style={styles.quick}>
      <LinearGradient colors={c.wash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radii.lg + 2 }]} />
      <View style={[styles.quickIcon, { backgroundColor: c.tile, width: icon, height: icon, borderRadius: Math.round(icon / 3) }]}>
        <Ionicons name={iconName} size={Math.round(icon * 0.48)} color={c.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.quickTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.quickSub} numberOfLines={2}>{subtitle}</Text>
      </View>
      {wide ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </PressableScale>
  );
}

export default function ClientHomeScreen() {
  const { t } = useTranslation('client');
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const { user, mode } = useAuth();
  // Primeiro login pelo código: convida a criar a senha (vale em todas as empresas da pessoa).
  usePasswordPrompt(user, mode === 'live');
  const { data: bookings } = useBookings();
  const { data: chats } = useChats();
  // Só mostra o que a empresa liberou no portal (sem treino liberado, nada de treino aqui).
  const caps = useClientCapabilities();
  const { data: week } = useWeek({ enabled: caps.training });
  const { data: summary } = useFitnessSummary({ enabled: caps.training });
  const { data: companies } = useCompanies();
  const confirm = useConfirmBooking();
  const unconfirm = useUnconfirmBooking();

  const client = user?.kind === 'client' ? user : null;
  const tenant = client?.memberships.find((m) => m.tenant_id === client.active_tenant_id);
  const firstName = client?.name?.split(' ')[0] ?? '';
  const next = bookings?.find((b) => new Date(b.ends_at).getTime() > now && (b.status === 'pending' || b.status === 'confirmed'));
  const today = week?.days.find((d) => d.date === week.today);
  const todayWorkout = today?.items?.[0];
  const todayDone = !!today?.done;
  const workoutParts = todayWorkout?.title.split('·').map((s) => s.trim()) ?? [];
  const workoutName = workoutParts[1] ?? workoutParts[0];
  const workoutLabel = workoutParts.length > 1 ? workoutParts[0] : null;
  const exerciseCount = todayWorkout?.parts[0]?.type === 'strength' ? todayWorkout.parts[0].items.length : 0;
  const chat = chats?.find((c) => c.unread > 0) ?? chats?.[0];
  const lastTeam = chat ? [...chat.messages].reverse().find((m) => m.from === 'team') : undefined;
  const textMsg = chat ? [...chat.messages].reverse().find((m) => m.from === 'team' && m.text) : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.push('/(auth)/client-tenant-select')} accessibilityRole="button" accessibilityLabel={t('home.companySwitch', { name: tenant?.tenant_name ?? '' })} style={styles.tenant}>
            <Avatar initials={companies?.find((c) => c.name === tenant?.tenant_name)?.initials ?? (tenant?.tenant_name ?? 'E').slice(0, 2).toUpperCase()} size={32} tone="brand" />
            <Text style={styles.tenantName}>{tenant?.tenant_name ?? t('home.company')}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </PressableScale>
          <PressableScale onPress={() => router.navigate('/(client)/perfil')} accessibilityRole="button" accessibilityLabel={t('home.myProfile')} scaleTo={0.92}>
            {/* Bolinha azul com aro branco: o tom suave sumia no fundo claro e sobrava só a letra. */}
            <View style={styles.me}>
              <Avatar initials={(client?.name ?? 'C').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} size={40} tone="brand" />
            </View>
          </PressableScale>
        </View>

        <Rise>
          <Muted style={{ marginTop: 22, fontSize: 14 }}>{longDate(new Date())}</Muted>
        </Rise>
        <Rise index={1}>
          <Display style={{ marginTop: 4 }}>{`${greeting()}, ${firstName}`}</Display>
        </Rise>

        <PortalAttention />

        {caps.scheduling && next ? (
          <Rise index={2} style={{ marginTop: 18 }}>
            <HeroCard>
              <View style={styles.rowBetween}>
                <Text style={styles.heroLabel}>{t('home.nextAppointment')}</Text>
                <Badge label={minutesUntilLabel(next.starts_at)} tone="primary" />
              </View>
              <Text style={styles.heroTitle}>{next.service_name}</Text>
              <View style={styles.heroWho}>
                <Avatar initials={(next.provider_name ?? '').split(' ').map((w) => w[0]).slice(0, 2).join('')} size={30} />
                <Text style={styles.heroWhoText}>{t('home.nextMeta', { time: formatHour(next.starts_at), duration: formatDuration((new Date(next.ends_at).getTime() - new Date(next.starts_at).getTime()) / 1000), name: next.provider_name ?? '' })}</Text>
              </View>
              {next.status === 'pending' && next.can_confirm === false ? (
                <Pressable onPress={() => router.push(`/cliente/compromisso/${next.id}`)} accessibilityRole="button" style={styles.confirmed}>
                  <Ionicons name="time-outline" size={20} color={colors.warnText} />
                  <Text style={[styles.confirmedText, { color: colors.warnText }]}>{t('home.waitingCompany')}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ) : next.status === 'pending' ? (
                <View style={styles.heroActions}>
                  <Button label={t('home.confirmPresence')} icon="checkmark" loading={confirm.isPending} onPress={() => confirm.mutate(next.id)} style={{ flex: 1, minHeight: 50 }} />
                  <IconButton icon="chevron-forward" size={50} accessibilityLabel={t('home.seeDetails')} onPress={() => router.push(`/cliente/compromisso/${next.id}`)} />
                </View>
              ) : (
                <View style={styles.confirmed}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                  <Text style={styles.confirmedText}>{t('booking.pill.confirmed')}</Text>
                  {canUndoBookingAnswer() ? <Button label={t('home.undo')} variant="ghost" compact onPress={() => unconfirm.mutate(next.id)} /> : null}
                </View>
              )}
            </HeroCard>
          </Rise>
        ) : null}

        {caps.training ? (
        <View style={styles.grid}>
          <Rise index={3} style={{ flex: 1 }}>
            <Card onPress={() => (todayWorkout ? router.push(`/cliente/treino/${todayWorkout.id}`) : router.navigate('/(client)/fitness'))} accessibilityLabel={t('home.todayWorkout')} style={styles.tile}>
              <View style={styles.rowBetween}>
                <IconTile icon="barbell-outline" size={38} />
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12 }}>{todayDone ? t('home.done') : t('home.today')}</Muted>
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {todayWorkout ? workoutName : t('home.restDay')}
              </Text>
              <Muted style={{ marginTop: 4 }} numberOfLines={1}>
                {!todayWorkout
                  ? t('home.lightStretch')
                  : workoutLabel
                    ? t('home.workoutMeta', { label: workoutLabel, count: exerciseCount })
                    : t('home.exerciseCount', { count: exerciseCount })}
              </Muted>
              {todayWorkout && !todayDone ? (
                <View style={styles.startWrap}>
                  <View style={styles.startPill}>
                    <Ionicons name="play" size={12} color="#fff" />
                    <Text style={styles.startPillText}>{t('home.start')}</Text>
                  </View>
                </View>
              ) : null}
            </Card>
          </Rise>
          <Rise index={4} style={{ flex: 1 }}>
            <Card onPress={() => router.push('/cliente/historico')} accessibilityLabel={t('home.streakA11y', { n: summary?.streak ?? 0 })} style={[styles.tile, { overflow: 'hidden' }]}>
              <LinearGradient colors={gradients.warm} style={StyleSheet.absoluteFill} />
              <View style={styles.rowBetween}>
                <IconTile icon="flame-outline" size={38} tone="warm" />
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12 }}>{t('home.streak')}</Muted>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 }}>
                <Num size="lg">{summary?.streak ?? '–'}</Num>
                <Muted style={{ fontSize: 15, marginBottom: 3 }}>{t('home.days')}</Muted>
              </View>
              <Muted style={{ marginTop: 6 }}>{t('home.record', { n: summary?.bestStreak ?? '–' })}</Muted>
              <View style={styles.dots} accessible accessibilityLabel={t('home.weekA11y', { done: week?.summary.done ?? 0, planned: week?.summary.planned ?? 0 })}>
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
        ) : null}

        {caps.chat && chat && lastTeam ? (
          <Rise index={5} style={{ marginTop: 12 }}>
            <Card onPress={() => router.push(`/cliente/chat/${chat.tenant_slug}`)} accessibilityLabel={t('home.teamMessageA11y', { name: chat.tenant_name })}>
              <View style={styles.rowBetween}>
                <Muted style={{ fontFamily: typography.fontFamilySemiBold }}>{t('home.teamMessage')}</Muted>
                {chat.unread ? <Badge label={String(chat.unread)} tone="solid" /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Avatar initials={(lastTeam.author_name || chat.tenant_name || 'E').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} size={42} />
                <View style={{ flex: 1 }}>
                  {/* O portal não diz quem da equipe escreveu: mostra a empresa. */}
                  <Text style={styles.msgAuthor}>{lastTeam.author_name || chat.tenant_name}</Text>
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

        {caps.chat || caps.training ? (
          <Rise index={6}>
            <Text style={styles.quickHeading}>{t('home.quickTitle')}</Text>
            <View style={styles.quickGrid}>
              {caps.chat ? <QuickCard hue="blue" icon="calendar-outline" title={t('home.requestSlot')} subtitle={t('home.requestSlotSub')} onPress={() => router.push(`/cliente/chat/${tenant?.tenant_slug ?? companies?.find((c) => c.name === tenant?.tenant_name)?.slug ?? 'empresa'}?pedido=1`)} /> : null}
              {caps.training ? (
                <>
                  <QuickCard hue="violet" icon="images-outline" title={t('home.progress')} subtitle={t('home.progressSub')} onPress={() => router.push('/cliente/evolucao')} />
                  <QuickCard hue="teal" icon="stats-chart-outline" title={t('home.history')} subtitle={t('home.historySub')} onPress={() => router.push('/cliente/historico')} />
                  <QuickCard hue="orange" icon="ribbon-outline" title={t('home.achievements')} subtitle={t('home.achievementsSub')} onPress={() => router.push('/cliente/conquistas')} />
                </>
              ) : null}
            </View>
          </Rise>
        ) : null}
        <PortalShortcutList />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickHeading: { ...text.title, color: colors.text, marginTop: 22, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quick: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingLeft: 12, paddingRight: 10, minHeight: 86, borderRadius: radii.lg + 2, backgroundColor: '#ffffff', ...shadows.card },
  quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, lineHeight: 19, letterSpacing: -0.3, color: colors.text },
  quickSub: { ...text.caption, color: colors.textMuted, marginTop: 2 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  me: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', ...shadows.card },
  tenant: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 999, backgroundColor: glass(0.75), ...shadows.card },
  tenantName: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  heroTitle: { marginTop: 14, ...text.headline, color: colors.text },
  heroWho: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  heroWhoText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 14, color: colors.textSoft },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, height: 50, paddingLeft: 16, paddingRight: 4, borderRadius: 999, backgroundColor: colors.successSoft },
  confirmedText: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.success },
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: { flex: 1, minHeight: 180, borderRadius: radii.xl },
  tileTitle: { marginTop: 14, ...text.section, color: colors.text },
  startWrap: { marginTop: 'auto', paddingTop: 14 },
  startPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primary },
  startPillText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 13 },
  dots: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotToday: { backgroundColor: '#fff', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary },
  msgAuthor: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
  msgText: { marginTop: 3, fontFamily: typography.fontFamily, fontSize: 13.5, lineHeight: 19, color: colors.textSoft },
  thumb: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  thumbTime: { position: 'absolute', right: 6, bottom: 4, color: '#fff', fontSize: 10, fontFamily: typography.fontFamilySemiBold },
});
