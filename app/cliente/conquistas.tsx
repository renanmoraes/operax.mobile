import { router } from 'expo-router';
import { useActiveCompanySlug, useCompanies } from '@/src/features/client/useClientData';
import { locale } from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Button, HeroCard, IconName, Muted, Num, PressableScale, ProgressBar, Rise, Screen, SectionHeader, Segmented, TopBar } from '@/src/design-system/ui';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { colors, gradients, radii, shadows, text, typography, glass } from '@/src/design-system/tokens';
import { useCheckins, useEvolution, useFitnessSummary, useHistory } from '@/src/features/fitness/useFitness';
import { useProviders } from '@/src/features/fitness/connections';

type Badge_ = { id: string; name: string; icon: IconName; unlocked: boolean; sub: string; desc: string };

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  // Nome da empresa no texto de compartilhar (antes era um nome de demonstração fixo).
  const slug = useActiveCompanySlug();
  const { data: companies } = useCompanies();
  const companyName = companies?.find((c) => c.slug === slug)?.name ?? 'Operax';
  const { data: s } = useFitnessSummary();
  const { data: history } = useHistory();
  const { data: evolution } = useEvolution();
  const { data: checkins } = useCheckins();
  const { data: providers } = useProviders();
  const [filter, setFilter] = useState('todas');
  const [open, setOpen] = useState<Badge_ | null>(null);

  if (!s) return <Screen>{null}</Screen>;

  // Tudo calculado dos dados reais (no demo, dos dados de exemplo): nada marcado como ganho de graça.
  const goal = evolution?.weekly_goal ?? 5;
  const perfectWeeks = (evolution?.weekly ?? []).filter((w) => w.sessions >= goal).length;
  const early = (history ?? []).filter((e) => e.started_at && new Date(e.started_at).getHours() < 7).length;
  const hasPhoto = (checkins ?? []).some((c) => !!c.photo_uri);
  const watch = (providers ?? []).some((p) => p.connected);
  const won = (ok: boolean, progress: string) => (ok ? t('ach.won') : progress);
  const badge = (id: string, icon: IconName, unlocked: boolean, sub: string): Badge_ => ({ id, icon, unlocked, sub, name: t(`ach.${id}.name` as 'ach.first.name'), desc: t(`ach.${id}.desc` as 'ach.first.desc') });
  const all: Badge_[] = [
    badge('first', 'flag-outline', s.totalSessions >= 1, won(s.totalSessions >= 1, '0/1')),
    badge('week', 'star-outline', perfectWeeks > 0, perfectWeeks > 0 ? t('ach.times', { count: perfectWeeks }) : t('ach.weekGoal', { goal })),
    badge('ten', 'medal-outline', s.totalSessions >= 10, won(s.totalSessions >= 10, `${Math.min(s.totalSessions, 10)}/10`)),
    badge('record', 'flash-outline', s.records > 0, t('ach.recordsCount', { count: s.records })),
    badge('early', 'sunny-outline', early >= 5, won(early >= 5, `${Math.min(early, 5)}/5`)),
    badge('streak7', 'flame-outline', s.bestStreak >= 7, won(s.bestStreak >= 7, `${Math.min(s.bestStreak, 7)}/7`)),
    badge('photo', 'camera-outline', hasPhoto, won(hasPhoto, t('ach.toEarn'))),
    badge('fifty', 'trophy-outline', s.totalSessions >= 50, won(s.totalSessions >= 50, `${Math.min(s.totalSessions, 50)}/50`)),
    badge('watch', 'watch-outline', watch, won(watch, t('ach.toEarn'))),
    badge('streak30', 'flame-outline', s.streak >= 30, won(s.streak >= 30, `${Math.min(s.streak, 30)}/30`)),
    badge('hundred', 'trophy-outline', s.totalSessions >= 100, won(s.totalSessions >= 100, `${Math.min(s.totalSessions, 100)}/100`)),
    badge('month', 'calendar-outline', s.monthCount >= 20, won(s.monthCount >= 20, `${Math.min(s.monthCount, 20)}/20`)),
  ];
  const list = all.filter((b) => filter === 'todas' || (filter === 'abertas' ? b.unlocked : !b.unlocked));
  const unlocked = all.filter((b) => b.unlocked).length;

  return (
    <Screen>
      <TopBar safe title={t('ach.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Rise>
          <HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <LinearGradient colors={gradients.brand} style={styles.level}>
                <Text style={styles.levelLabel}>{t('ach.levelCaps')}</Text>
                <Num size="lg" style={{ color: '#fff' }}>{s.level.level}</Num>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.levelName}>{s.level.label}</Text>
                <Muted style={{ marginTop: 4, fontSize: 13.5 }}>{t('ach.xpToGo', { xp: (s.level.next - s.level.current).toLocaleString(locale()), level: s.level.level + 1 })}</Muted>
              </View>
            </View>
            <View style={{ marginTop: 18 }}>
              <ProgressBar progress={s.level.current / s.level.next} height={10} />
            </View>
            <View style={styles.rules}>
              {[
                ['+50', t('ach.rule.workout')],
                ['+120', t('ach.rule.week')],
                ['+30', t('ach.rule.record')],
              ].map(([v, l]) => (
                <View key={l} style={styles.rule}>
                  <Num size="sm" style={{ color: colors.primary }}>{v}</Num>
                  <Muted style={{ fontSize: 11.5, marginTop: 2 }}>{l}</Muted>
                </View>
              ))}
            </View>
          </HeroCard>
        </Rise>

        <SectionHeader title={t('tab.achievements')} action={t('tab.nOf', { n: unlocked, total: all.length })} />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'todas', label: t('ach.filter.all') },
            { key: 'abertas', label: t('ach.filter.won') },
            { key: 'fechadas', label: t('ach.filter.toEarn') },
          ]}
        />
        <View style={styles.grid}>
          {list.map((b, i) => (
            <Animated.View
              key={b.id}
              style={styles.cellWrap}
              // ao filtrar, as medalhas que ficam deslizam até o novo lugar e as outras somem suaves
              layout={LinearTransition.springify().damping(24).stiffness(140)}
              entering={FadeInDown.duration(320).delay(Math.min(i, 8) * 30)}
              exiting={FadeOut.duration(160)}
            >
              <PressableScale onPress={() => setOpen(b)} accessibilityRole="button" accessibilityLabel={`${b.name}, ${b.unlocked ? t('ach.unlockedLower') : t('ach.toEarn')}`} style={styles.cell}>
                {b.unlocked ? (
                  <LinearGradient colors={gradients.brand} style={styles.medal}>
                    <Ionicons name={b.icon} size={26} color="#fff" />
                  </LinearGradient>
                ) : (
                  <View style={[styles.medal, { backgroundColor: '#f0f2f5' }]}>
                    <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <Text style={styles.cellName} numberOfLines={2}>{b.name}</Text>
                <Muted style={{ fontSize: 11.5 }}>{b.sub}</Muted>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <BottomSheet visible={!!open} onClose={() => setOpen(null)} closeLabel={t('ach.closeDetail')} contentStyle={{ alignItems: 'center', gap: 0 }}>
        {open ? (
          <>
              {open.unlocked ? (
                <LinearGradient colors={gradients.brand} style={styles.bigMedal}>
                  <Ionicons name={open.icon} size={40} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={[styles.bigMedal, { backgroundColor: '#f0f2f5' }]}>
                  <Ionicons name="lock-closed-outline" size={36} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.sheetTitle}>{open.name}</Text>
              <Muted style={styles.sheetDesc}>{open.desc}</Muted>
              <Text style={styles.sheetSub}>{open.unlocked ? t('ach.unlocked') : t('ach.progress', { value: open.sub })}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' }}>
                <Button label={t('common:actions.close')} variant="secondary" onPress={() => setOpen(null)} style={{ flex: 1 }} />
                {open.unlocked ? <Button label={t('done.share')} style={{ flex: 1 }} onPress={() => void Share.share({ message: t('ach.shareMessage', { name: open.name, company: companyName }) })} /> : null}
              </View>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  level: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  levelLabel: { color: 'rgba(255,255,255,0.85)', fontFamily: typography.fontFamilyBold, fontSize: 11 },
  levelName: { ...text.title, color: colors.text },
  rules: { flexDirection: 'row', gap: 8, marginTop: 16 },
  rule: { flex: 1, padding: 10, borderRadius: radii.md + 4, backgroundColor: glass(0.85), ...shadows.card },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginHorizontal: -5 },
  cellWrap: { width: '33.33%', padding: 5 },
  cell: { alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 8, borderRadius: radii.xl - 4, backgroundColor: '#fff', ...shadows.card },
  medal: { width: 58, height: 58, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cellName: { fontFamily: typography.fontFamilyBold, fontSize: 12.5, lineHeight: 16, textAlign: 'center', color: colors.text },
  bigMedal: { marginTop: 20, width: 96, height: 96, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { marginTop: 16, ...text.title, color: colors.text, textAlign: 'center' },
  sheetDesc: { marginTop: 6, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  sheetSub: { marginTop: 10, fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary },
});
