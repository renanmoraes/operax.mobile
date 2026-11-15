import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Button, EmptyState, HeroCard, Muted, Num, PressableScale, ProgressBar, ProgressRing, Rise, Screen, SectionHeader, Segmented, TopBar } from '@/src/design-system/ui';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { useActiveCompanyName } from '@/src/features/client/useClientData';
import { AchievementPin } from '@/src/features/fitness/AchievementPin';
import { levelView, useAchievements, useMarkAchievementsSeen, type AchievementView } from '@/src/features/fitness/achievements';

type Filter = 'all' | 'won' | 'toEarn';
const SECTIONS = ['tenant', 'dates', 'bible', 'general'] as const;

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const fmtDate = (iso: string) => day(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
const daysLeft = (iso: string) => Math.max(0, Math.round((day(iso).getTime() - day(new Date().toISOString()).getTime()) / 86_400_000));
const num = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 1 });

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const company = useActiveCompanyName();
  const { data, isLoading, isError, refetch } = useAchievements();
  const seen = useMarkAchievementsSeen();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<AchievementView | null>(null);
  const fresh = useMemo(() => (data?.items ?? []).filter((i) => i.new), [data]);
  // Comemora as ganhas e ainda não vistas uma vez; ao fechar, o backend marca como vistas.
  const [dismissed, setDismissed] = useState(false);
  const celebrate = fresh.length > 0 && !dismissed;

  const items = data?.items ?? [];
  const now = items.filter((i) => i.period.kind !== 'always' && i.period.active && !i.earned_at);
  const list = items.filter((i) => filter === 'all' || (filter === 'won' ? !!i.earned_at : !i.earned_at));
  const groups = SECTIONS.map((key) => ({ key, rows: list.filter((i) => (i.origin === 'tenant' ? 'tenant' : i.theme ?? 'general') === key) })).filter((g) => g.rows.length);
  const earned = items.filter((i) => i.earned_at).length;
  const level = data ? levelView(data.profile) : null;

  const periodLine = (i: AchievementView) => {
    if (i.period.kind === 'always') return null;
    if (i.period.active && i.period.ends_on) { const d = daysLeft(i.period.ends_on); return d === 0 ? t('ach.endsToday') : t('ach.endsIn', { count: d }); }
    if (!i.period.next_starts_on) return null;
    return i.period.kind === 'annual' ? t('ach.backEveryYear', { date: fmtDate(i.period.next_starts_on) }) : t('ach.backOn', { date: fmtDate(i.period.next_starts_on) });
  };
  const closeCelebration = () => { setDismissed(true); seen.mutate(fresh.map((f) => f.ref)); };

  if (isLoading || !data || !level) {
    return (
      <Screen>
        <TopBar safe title={t('ach.title')} onBack={() => router.back()} />
        {isError ? <EmptyState icon="cloud-offline-outline" title={t('ach.loadFail')} actionLabel={t('ach.retry')} onAction={() => void refetch()} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar safe title={t('ach.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Rise>
          <HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ProgressRing size={92} stroke={9} progress={level.current / level.next} accessibilityLabel={t('ach.xpToGo', { xp: num(level.next - level.current), level: level.level + 1 })}>
                <Text style={styles.levelLabel}>{t('ach.levelCaps')}</Text>
                <Num size="lg">{level.level}</Num>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <Text style={styles.levelName}>{level.label}</Text>
                <Muted style={{ marginTop: 4, fontSize: 13.5 }}>{t('ach.xpToGo', { xp: num(level.next - level.current), level: level.level + 1 })}</Muted>
                <Muted style={{ marginTop: 2, fontSize: 12, fontVariant: ['tabular-nums'] }}>{t('ach.xpTotal', { xp: num(level.xp) })}</Muted>
              </View>
            </View>
            <View style={{ marginTop: 16 }}>
              <ProgressBar progress={level.current / level.next} height={10} />
            </View>
            <View style={styles.rules}>
              {[['+10', t('ach.rule.workout')], ['+50–800', t('ach.rule.achievement')], ['↑', t('ach.rule.levels')]].map(([v, l]) => (
                <View key={l} style={styles.rule}>
                  <Num size="sm" style={{ color: colors.primary }}>{v}</Num>
                  <Muted style={{ fontSize: 11.5, marginTop: 2 }}>{l}</Muted>
                </View>
              ))}
            </View>
          </HeroCard>
        </Rise>

        <Rise index={1}>
          <View style={styles.actions}>
            <PressableScale onPress={() => router.push('/cliente/checkin')} accessibilityRole="button" accessibilityLabel={t('ach.checkin')} style={styles.action}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primaryWash }]}><Ionicons name="qr-code-outline" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{t('ach.checkin')}</Text>
                <Muted style={{ fontSize: 12 }}>{t('ach.checkinHint')}</Muted>
              </View>
            </PressableScale>
            <PressableScale onPress={() => router.push('/cliente/ingressos')} accessibilityRole="button" accessibilityLabel={t('ach.tickets')} style={styles.action}>
              <View style={[styles.actionIcon, { backgroundColor: '#fff4e5' }]}><Ionicons name="ticket-outline" size={20} color={colors.warn} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{t('ach.tickets')}</Text>
                <Muted style={{ fontSize: 12 }}>{t('ach.ticketsHint')}</Muted>
              </View>
            </PressableScale>
          </View>
        </Rise>

        {now.length ? (
          <>
            <SectionHeader title={t('ach.now')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingLeft: 20 }}>
              {now.map((i) => (
                <PressableScale key={i.ref} onPress={() => setOpen(i)} accessibilityRole="button" accessibilityLabel={`${i.name}, ${periodLine(i) ?? ''}`} style={[styles.nowCard, { borderColor: `${i.color}55` }]}>
                  <AchievementPin item={i} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nowName} numberOfLines={1}>{i.name}</Text>
                    <Muted style={{ fontSize: 12 }} numberOfLines={1}>{t('ach.progress', { current: num(i.progress.current), target: num(i.progress.target) })}</Muted>
                    <Text style={[styles.nowWhen, { color: i.color }]}>{periodLine(i)}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </>
        ) : null}

        <SectionHeader title={t('tab.achievements')} action={t('ach.count', { n: earned, total: items.length })} />
        <Segmented value={filter} onChange={(k) => setFilter(k as Filter)}
          options={[{ key: 'all', label: t('ach.filter.all') }, { key: 'won', label: t('ach.filter.won') }, { key: 'toEarn', label: t('ach.filter.toEarn') }]} />
        {!groups.length ? <Muted style={{ marginTop: 20, textAlign: 'center' }}>{t('ach.empty')}</Muted> : null}
        {groups.map((g) => (
          <View key={g.key} style={{ marginTop: 18 }}>
            <Text style={styles.groupTitle}>{t(`ach.section.${g.key}`)}</Text>
            <View style={styles.grid}>
              {g.rows.map((b, i) => (
                <Animated.View key={b.ref} style={styles.cellWrap} layout={LinearTransition.springify().damping(24).stiffness(140)}
                  entering={FadeInDown.duration(320).delay(Math.min(i, 8) * 30)} exiting={FadeOut.duration(160)}>
                  <PressableScale onPress={() => setOpen(b)} accessibilityRole="button"
                    accessibilityLabel={`${b.name}, ${b.earned_at ? t('ach.won') : t('ach.progress', { current: num(b.progress.current), target: num(b.progress.target) })}`} style={styles.cell}>
                    <AchievementPin item={b} size={62} />
                    <Text style={styles.cellName} numberOfLines={2}>{b.name}</Text>
                    <Muted style={{ fontSize: 11.5, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                      {b.earned_at ? (b.edition ? `${t('ach.won')} · ${b.edition}` : t('ach.won')) : periodLine(b) ?? t('ach.progress', { current: num(b.progress.current), target: num(b.progress.target) })}
                    </Muted>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomSheet visible={!!open} onClose={() => setOpen(null)} closeLabel={t('ach.closeDetail')} contentStyle={{ alignItems: 'center', gap: 0 }}>
        {open ? (
          <>
            <AchievementPin item={open} size={104} style={{ marginTop: 16 }} />
            <Text style={styles.sheetTitle}>{open.name}</Text>
            <Text style={[styles.sheetTier, { color: open.earned_at ? open.color : colors.textSoft }]}>{`${t(`ach.tier.${open.tier}`)} · ${t('ach.xp', { xp: num(open.xp) })}`}</Text>
            {open.description ? <Muted style={styles.sheetDesc}>{open.description}</Muted> : null}
            <View style={styles.howBox}>
              <Text style={styles.howTitle}>{t('ach.howToEarn')}</Text>
              <Text style={styles.howText}>{open.how_to_earn}</Text>
              {!open.earned_at ? (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <ProgressBar progress={open.progress.current / Math.max(1, open.progress.target)} />
                  <Muted style={{ fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{t('ach.progress', { current: num(open.progress.current), target: num(open.progress.target) })}</Muted>
                </View>
              ) : null}
            </View>
            {open.prize ? (
              <View style={styles.prizeBox}>
                <Ionicons name="gift-outline" size={18} color={colors.warn} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prizeText}>{t('ach.prize', { prize: open.prize })}</Text>
                  {open.prize_status !== 'none' ? <Muted style={{ fontSize: 12 }}>{open.prize_status === 'delivered' ? t('ach.prizeDelivered') : t('ach.prizePending')}</Muted> : null}
                </View>
              </View>
            ) : null}
            {open.requirements.length ? (
              <View style={styles.reqBox}>
                <Text style={styles.howTitle}>{t('ach.requirements')}</Text>
                {open.requirements.map((r) => {
                  const target = items.find((x) => x.ref === r.ref);
                  return (
                    <PressableScale key={r.ref} disabled={!target} onPress={() => target && setOpen(target)} accessibilityRole="button" accessibilityLabel={`${r.hidden || !r.name ? t('ach.secretRequirement') : r.name}, ${t('ach.reqProgress', { have: Math.min(r.have, r.times), times: r.times })}`} style={styles.reqRow}>
                      {target ? <AchievementPin item={target} size={34} /> : <Ionicons name="medal-outline" size={26} color={colors.textMuted} />}
                      <Text style={styles.reqName} numberOfLines={1}>{r.hidden || !r.name ? t('ach.secretRequirement') : r.name}</Text>
                      <Text style={[styles.reqCount, r.have >= r.times && { color: colors.success }]}>{t('ach.reqProgress', { have: Math.min(r.have, r.times), times: r.times })}</Text>
                      {target ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}
            {open.earned_at ? <Text style={styles.sheetSub}>{t('ach.wonOn', { date: fmtDate(open.earned_at) })}</Text> : periodLine(open) ? <Text style={styles.sheetSub}>{periodLine(open)}</Text> : null}
            {open.earned_editions.length ? <Muted style={{ marginTop: 4, fontSize: 12.5 }}>{t('ach.editions', { years: open.earned_editions.join(', ') })}</Muted> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' }}>
              <Button label={t('common:actions.close')} variant="secondary" onPress={() => setOpen(null)} style={{ flex: 1 }} />
              {open.earned_at ? <Button label={t('ach.share')} icon="share-outline" style={{ flex: 1 }} onPress={() => void Share.share({ message: t('ach.shareMessage', { name: open.name, company }) })} /> : null}
            </View>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={celebrate} onClose={closeCelebration} closeLabel={t('ach.newCta')} contentStyle={{ alignItems: 'center', gap: 0 }}>
        <Text style={[styles.sheetTitle, { marginTop: 8 }]}>{t('ach.newTitle', { count: fresh.length })}</Text>
        <View style={styles.freshRow}>
          {fresh.slice(0, 6).map((f) => (
            <View key={f.ref} style={{ alignItems: 'center', width: 96, gap: 6 }}>
              <AchievementPin item={f} size={72} />
              <Text style={styles.cellName} numberOfLines={2}>{f.name}</Text>
              <Text style={[styles.freshXp, { color: f.color }]}>{t('ach.xp', { xp: num(f.xp) })}</Text>
            </View>
          ))}
        </View>
        <Button label={t('ach.newCta')} onPress={closeCelebration} style={{ alignSelf: 'stretch', marginTop: 20 }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelLabel: { color: colors.textSoft, fontFamily: typography.fontFamilyBold, fontSize: 10, letterSpacing: 0.6 },
  levelName: { ...text.title, color: colors.text },
  rules: { flexDirection: 'row', gap: 8, marginTop: 16 },
  rule: { flex: 1, padding: 10, borderRadius: radii.md + 4, backgroundColor: '#ffffffd9', ...shadows.card },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radii.xl - 6, backgroundColor: '#fff', ...shadows.card },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.text },
  nowCard: { width: 248, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.xl - 4, borderWidth: 1.5, backgroundColor: '#fff', ...shadows.card },
  nowName: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text },
  nowWhen: { marginTop: 3, fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  groupTitle: { fontFamily: typography.fontFamilyBold, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -5 },
  cellWrap: { width: '33.33%', padding: 5 },
  cell: { alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6, borderRadius: radii.xl - 4, backgroundColor: '#fff', ...shadows.card },
  cellName: { fontFamily: typography.fontFamilyBold, fontSize: 12.5, lineHeight: 16, textAlign: 'center', color: colors.text },
  sheetTitle: { marginTop: 14, ...text.title, color: colors.text, textAlign: 'center' },
  sheetTier: { marginTop: 4, fontFamily: typography.fontFamilySemiBold, fontSize: 13 },
  sheetDesc: { marginTop: 8, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  howBox: { alignSelf: 'stretch', marginTop: 16, padding: 14, borderRadius: radii.lg, backgroundColor: colors.pageBg },
  howTitle: { fontFamily: typography.fontFamilyBold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textSoft },
  howText: { marginTop: 4, fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  sheetSub: { marginTop: 12, fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary },
  prizeBox: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: radii.lg, backgroundColor: '#fff4e5' },
  prizeText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  reqBox: { alignSelf: 'stretch', marginTop: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.pageBg, gap: 8 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  reqName: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  reqCount: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.textSoft, fontVariant: ['tabular-nums'] },
  freshRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 18 },
  freshXp: { fontFamily: typography.fontFamilyBold, fontSize: 12 },
});
