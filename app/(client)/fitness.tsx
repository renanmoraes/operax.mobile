import { router } from 'expo-router';
import { locale } from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Button,
  Card,
  Display,
  Glow,
  HeroCard,
  IconTile,
  Muted,
  Num,
  PressableScale,
  ProgressBar,
  ProgressRing,
  Rise,
  Screen,
  SectionHeader,
} from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useProviders } from '@/src/features/fitness/connections';
import { ProviderMark, providerDisplayName } from '@/src/features/fitness/brands';
import { useCheckins, useEvolution, useFitnessSummary, useWeek } from '@/src/features/fitness/useFitness';
import { useAchievementLevel } from '@/src/features/fitness/achievements';
import { formatKg, weekdayShort } from '@/src/shared/format';
import { useActiveCompanySlug , useClientCapabilities, useCompanies } from '@/src/features/client/useClientData';
import { workoutChips } from '@/src/features/fitness/parts';

export default function ClientFitnessScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const slug = useActiveCompanySlug();
  const { data: week } = useWeek();
  const { data: summary } = useFitnessSummary();
  // Nível e XP vêm das conquistas (curva do backend); sem acesso a elas, o resumo calculado no app.
  const lvl = useAchievementLevel() ?? summary?.level ?? null;
  const { data: providers } = useProviders();
  const { data: checkins } = useCheckins();
  const [picked, setPicked] = useState<string | null>(null);

  const selectedDate = picked ?? week?.today;
  const day = week?.days.find((d) => d.date === selectedDate);
  // Um dia pode ter vários treinos (ficha individual + aulas coletivas): mostra todos.
  const items = day?.items ?? [];
  const isToday = selectedDate === week?.today;
  const isPast = !!selectedDate && !!week && selectedDate < week.today;
  const { data: evolution } = useEvolution();
  // Meta da semana definida pela academia; sem meta cadastrada, 5 treinos.
  const goal = evolution?.weekly_goal ?? 5;
  const caps = useClientCapabilities();
  const { data: companies } = useCompanies();
  const companyName = companies?.find((c) => c.slug === slug)?.name ?? t('tab.team');
  const done = week?.summary.done ?? 0;
  const connected = providers?.filter((p) => p.connected) ?? [];
  const firstCheck = checkins?.[0];
  const lastCheck = checkins?.[checkins.length - 1];
  const lost = firstCheck && lastCheck ? firstCheck.weight_kg - lastCheck.weight_kg : 0;

  const status = !day?.planned ? 'rest' : day.done ? 'done' : isToday ? 'today' : isPast ? 'missed' : 'next';
  const badge = { rest: [t('tab.badge.rest'), 'neutral'], done: [t('tab.badge.done'), 'success'], today: [t('tab.badge.today'), 'solid'], missed: [t('tab.badge.missed'), 'warn'], next: [t('tab.badge.next'), 'neutral'] } as const;

  return (
    <Screen backdrop="mirror">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Display>{t('tab.title')}</Display>
          <PressableScale onPress={() => router.push('/cliente/historico')} accessibilityRole="button" accessibilityLabel={t('tab.streakA11y', { count: summary?.streak ?? 0 })} style={styles.streak}>
            <Ionicons name="flame-outline" size={17} color={colors.warn} />
            <Text style={styles.streakText}>{summary?.streak != null ? t('tab.days', { count: summary.streak }) : '–'}</Text>
          </PressableScale>
        </View>

        <Rise style={{ marginTop: 16 }}>
          <HeroCard style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <ProgressRing progress={done / goal} accessibilityLabel={t('tab.goalA11y', { done, goal })}>
                <Num size="lg">
                  {done}
                  <Text style={[numbers.sm, { color: colors.textMuted }]}>{`/${goal}`}</Text>
                </Num>
                <Muted style={{ fontSize: 11.5, marginTop: 2 }}>{t('tab.workoutsUnit')}</Muted>
              </ProgressRing>
              <View style={{ flex: 1, gap: 14 }}>
                <View>
                  <Muted style={{ fontSize: 12.5 }}>{t('tab.weekGoal')}</Muted>
                  <Text style={styles.heroLine}>{done >= goal ? t('tab.goalHit') : t('tab.toGo', { count: goal - done })}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View>
                    <Muted style={{ fontSize: 12 }}>{t('tab.level')}</Muted>
                    <Num size="sm" style={{ marginTop: 2 }}>{lvl?.level ?? '–'}</Num>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.track }} />
                  <View>
                    <Muted style={{ fontSize: 12 }}>{t('tab.consistency')}</Muted>
                    <Num size="sm" style={{ marginTop: 2, color: colors.primary }}>{`${summary?.consistency ?? '–'}%`}</Num>
                  </View>
                </View>
              </View>
            </View>
            {lvl ? (
              <Pressable onPress={() => router.push('/cliente/conquistas')} accessibilityRole="button" accessibilityLabel={t('tab.seeLevel')} style={{ marginTop: 16, gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Muted style={{ fontSize: 12 }}>{t('tab.levelLine', { label: lvl.label, level: lvl.level })}</Muted>
                  <Muted style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}>{`${lvl.current.toLocaleString(locale())} / ${lvl.next.toLocaleString(locale())} XP`}</Muted>
                </View>
                <ProgressBar progress={lvl.current / lvl.next} />
              </Pressable>
            ) : null}
          </HeroCard>
        </Rise>

        {caps.training ? (
          <Rise index={1} style={{ marginTop: 12 }}>
            <PressableScale onPress={() => router.push('/cliente/treinar')} accessibilityRole="button" accessibilityLabel={t('tab.trainNowA11y')} style={styles.cta}>
              <LinearGradient colors={['#1e4ed8', '#163db0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Glow size={240} opacity={0.5} style={{ right: -70, top: -110 }} />
              <View style={styles.ctaPlay}>
                <Ionicons name="play" size={22} color={colors.primary} style={{ marginLeft: 3 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>{t('tab.trainNow')}</Text>
                <Text style={styles.ctaSub}>{t('tab.trainNowSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
            </PressableScale>
          </Rise>
        ) : null}

        {summary ? (
          <Rise index={1} style={{ marginTop: 12 }}>
            <Card style={styles.memory}>
              <IconTile icon="sparkles-outline" size={36} />
              <Text style={styles.memoryText}>
                <Text style={{ fontFamily: typography.fontFamilyBold }}>{t('tab.monthCount', { count: summary.monthCount })}</Text>
                <Text style={{ color: colors.textMuted }}> {t('tab.keepGoing')}</Text>
              </Text>
            </Card>
          </Rise>
        ) : null}

        <SectionHeader title={t('tab.yourWeek')} />
        <View style={styles.days}>
          {week?.days.map((d) => {
            const date = new Date(`${d.date}T12:00:00`);
            const on = d.date === selectedDate;
            const markColor = d.done ? (on ? '#fff' : colors.primary) : d.date === week.today && d.planned ? (on ? '#bfe9ff' : '#0094c6') : 'transparent';
            return (
              <Pressable
                key={d.date}
                onPress={() => setPicked(d.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${weekdayShort(date)} ${date.getDate()}${d.done ? t('tab.dayDone') : d.planned ? '' : t('tab.dayRest')}`}
                style={[styles.day, on ? styles.dayOn : styles.dayOff]}
              >
                <Text style={[styles.dayWd, on && { color: 'rgba(255,255,255,0.8)' }]}>{weekdayShort(date)}</Text>
                <Text style={[styles.dayNum, on && { color: '#fff' }]}>{date.getDate()}</Text>
                <View style={[styles.dayMark, { backgroundColor: markColor }]} />
              </Pressable>
            );
          })}
        </View>

        {items.length === 0 ? (
          <Rise index={2} style={{ marginTop: 12 }}>
            <Card style={{ padding: 20 }}>
              <Badge label={badge[status][0]} tone={badge[status][1]} />
              <Text style={styles.dayTitle}>Descanso</Text>
              <Muted style={styles.daySub}>{t('tab.restDay')}</Muted>
            </Card>
          </Rise>
        ) : (
          items.map((it, i) => (
            <Rise key={it.id} index={2 + i} style={{ marginTop: 12 }}>
              <Card style={{ padding: 20 }} onPress={() => router.push(`/cliente/treino/${it.id}`)} accessibilityLabel={t('tab.seeSheet', { title: it.title })}>
                <View style={styles.rowBetween}>
                  <Badge label={badge[status][0]} tone={badge[status][1]} />
                  {items.length > 1 ? <Muted>{t('tab.nOf', { n: i + 1, total: items.length })}</Muted> : null}
                </View>
                <Text style={styles.dayTitle}>{it.title}</Text>
                <View style={styles.chips}>
                  {workoutChips(it).map((c, k) => (
                    <Badge key={k} label={c} tone="neutral" />
                  ))}
                </View>
                {status === 'today' ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <Button label={t('tab.startWorkout')} icon="play" onPress={() => router.push(`/cliente/treino/${it.id}`)} style={{ flex: 1 }} />
                  </View>
                ) : status === 'done' ? (
                  <Button label={t('tab.seeWhatYouDid')} variant="soft" onPress={() => router.push('/cliente/historico')} style={{ marginTop: 16 }} />
                ) : null}
              </Card>
            </Rise>
          ))
        )}

        {caps.chat ? (
          <Rise index={3} style={{ marginTop: 12 }}>
            <Card style={styles.coach} onPress={() => router.push(`/cliente/chat/${slug}`)} accessibilityLabel={t('tab.talkTo', { name: companyName })}>
              <IconTile icon="chatbubbles-outline" size={46} tone="soft" />
              <View style={{ flex: 1 }}>
                <Muted style={{ fontSize: 12.5 }}>{t('tab.question')}</Muted>
                <Text style={styles.coachName}>{t('tab.talkTo', { name: companyName })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </Rise>
        ) : null}

        <View style={styles.grid}>
          <Rise index={4} style={{ flex: 1 }}>
            <PressableScale onPress={() => router.push('/cliente/evolucao')} accessibilityRole="button" accessibilityLabel={t('tab.bodyProgress')} style={[styles.tile, { overflow: 'hidden' }]}>
              <LinearGradient colors={['#eaf0ff', '#ddf3ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Glow size={160} opacity={0.45} style={{ right: -60, top: -70 }} />
              <Ionicons name="images-outline" size={22} color={colors.primary} />
              <Text style={[styles.tileTitle, { marginTop: 'auto' }]}>{t('tab.bodyProgress')}</Text>
              <Muted style={{ marginTop: 2, color: colors.primaryDeep }}>{lost > 0 ? t('tab.lost', { kg: formatKg(lost) }) : t('tab.firstPhoto')}</Muted>
            </PressableScale>
          </Rise>
          <Rise index={5} style={{ flex: 1 }}>
            <PressableScale onPress={() => router.push('/cliente/conquistas')} accessibilityRole="button" accessibilityLabel={t('tab.achievements')} style={[styles.tile, { backgroundColor: '#fff' }]}>
              <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
              <Text style={[styles.tileTitle, { marginTop: 'auto' }]}>{t('tab.achievements')}</Text>
              <Muted style={{ marginTop: 2 }}>{t('tab.records', { count: summary?.records ?? 0 })}</Muted>
            </PressableScale>
          </Rise>
        </View>

        <Rise index={6} style={{ marginTop: 12 }}>
          <Card onPress={() => router.push('/cliente/relogios')} accessibilityLabel={t('tab.watches')} style={styles.coach}>
            {connected[0] ? <ProviderMark id={connected[0].id} label={connected[0].label} size={46} /> : <IconTile icon="watch-outline" size={46} tone="soft" />}
            <View style={{ flex: 1 }}>
              <Text style={styles.coachName}>{t('tab.watches')}</Text>
              <Muted style={{ marginTop: 2 }}>{connected.length ? t('tab.connected', { names: connected.map((p) => providerDisplayName(p.id, p.label)).join(', ') }) : t('tab.connect')}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.warnSoft },
  streakText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.warn },
  heroLine: { marginTop: 3, ...text.section, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.xl, overflow: 'hidden', ...shadows.hero },
  ctaPlay: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { ...text.section, color: '#fff' },
  ctaSub: { marginTop: 2, fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg },
  memoryText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  days: { flexDirection: 'row', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  day: { flex: 1, height: 72, borderRadius: radii.lg - 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayOn: { backgroundColor: colors.primary, ...shadows.button },
  dayOff: { backgroundColor: 'rgba(255,255,255,0.88)' },
  dayWd: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted },
  dayNum: { ...numbers.sm, color: colors.text },
  dayMark: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dayTitle: { marginTop: 14, ...text.title, color: colors.text },
  daySub: { marginTop: 6, fontSize: 13.5, lineHeight: 20 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  coachName: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: { minHeight: 132, padding: 18, borderRadius: radii.xl, ...shadows.card },
  tileTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
});
