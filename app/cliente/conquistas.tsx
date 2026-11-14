import { router } from 'expo-router';
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
  const won = (ok: boolean, progress: string) => (ok ? 'conquistada' : progress);
  const all: Badge_[] = [
    { id: 'first', name: 'Primeiro treino', icon: 'flag-outline', unlocked: s.totalSessions >= 1, sub: won(s.totalSessions >= 1, '0/1'), desc: 'Você concluiu seu primeiro treino.' },
    { id: 'week', name: 'Semana perfeita', icon: 'star-outline', unlocked: perfectWeeks > 0, sub: perfectWeeks > 0 ? `${perfectWeeks} ${perfectWeeks === 1 ? 'vez' : 'vezes'}` : `meta de ${goal}/semana`, desc: 'Bateu a meta de treinos de uma semana.' },
    { id: 'ten', name: '10 treinos', icon: 'medal-outline', unlocked: s.totalSessions >= 10, sub: won(s.totalSessions >= 10, `${Math.min(s.totalSessions, 10)}/10`), desc: 'Dez treinos concluídos. O hábito começou.' },
    { id: 'record', name: 'Recorde pessoal', icon: 'flash-outline', unlocked: s.records > 0, sub: `${s.records} ${s.records === 1 ? 'recorde' : 'recordes'}`, desc: 'Bateu a sua melhor carga em um exercício.' },
    { id: 'early', name: 'Madrugador', icon: 'sunny-outline', unlocked: early >= 5, sub: won(early >= 5, `${Math.min(early, 5)}/5`), desc: 'Cinco treinos começados antes das 7h.' },
    { id: 'streak7', name: '7 dias seguidos', icon: 'flame-outline', unlocked: s.bestStreak >= 7, sub: won(s.bestStreak >= 7, `${Math.min(s.bestStreak, 7)}/7`), desc: 'Uma semana inteira cumprindo o plano, sem falhar.' },
    { id: 'photo', name: 'Primeira foto', icon: 'camera-outline', unlocked: hasPhoto, sub: won(hasPhoto, 'a conquistar'), desc: 'Registrou a primeira foto de evolução.' },
    { id: 'fifty', name: '50 treinos', icon: 'trophy-outline', unlocked: s.totalSessions >= 50, sub: won(s.totalSessions >= 50, `${Math.min(s.totalSessions, 50)}/50`), desc: 'Cinquenta treinos. Isso já é rotina.' },
    { id: 'watch', name: 'Relógio conectado', icon: 'watch-outline', unlocked: watch, sub: won(watch, 'a conquistar'), desc: 'Seus treinos chegam sozinhos pelo relógio.' },
    { id: 'streak30', name: '30 dias seguidos', icon: 'flame-outline', unlocked: s.streak >= 30, sub: won(s.streak >= 30, `${Math.min(s.streak, 30)}/30`), desc: 'Cumpra o plano por 30 dias seguidos.' },
    { id: 'hundred', name: '100 treinos', icon: 'trophy-outline', unlocked: s.totalSessions >= 100, sub: won(s.totalSessions >= 100, `${Math.min(s.totalSessions, 100)}/100`), desc: 'Chegue a cem treinos concluídos.' },
    { id: 'month', name: 'Mês com 20 treinos', icon: 'calendar-outline', unlocked: s.monthCount >= 20, sub: won(s.monthCount >= 20, `${Math.min(s.monthCount, 20)}/20`), desc: 'Vinte treinos no mesmo mês.' },
  ];
  const list = all.filter((b) => filter === 'todas' || (filter === 'abertas' ? b.unlocked : !b.unlocked));
  const unlocked = all.filter((b) => b.unlocked).length;

  return (
    <Screen>
      <TopBar safe title="Nível e conquistas" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Rise>
          <HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <LinearGradient colors={gradients.brand} style={styles.level}>
                <Text style={styles.levelLabel}>NÍVEL</Text>
                <Num size="lg" style={{ color: '#fff' }}>{s.level.level}</Num>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.levelName}>{s.level.label}</Text>
                <Muted style={{ marginTop: 4, fontSize: 13.5 }}>{`Faltam ${(s.level.next - s.level.current).toLocaleString('pt-BR')} XP para o nível ${s.level.level + 1}`}</Muted>
              </View>
            </View>
            <View style={{ marginTop: 18 }}>
              <ProgressBar progress={s.level.current / s.level.next} height={10} />
            </View>
            <View style={styles.rules}>
              {[
                ['+50', 'por treino'],
                ['+120', 'meta da semana'],
                ['+30', 'por recorde'],
              ].map(([v, l]) => (
                <View key={l} style={styles.rule}>
                  <Num size="sm" style={{ color: colors.primary }}>{v}</Num>
                  <Muted style={{ fontSize: 11.5, marginTop: 2 }}>{l}</Muted>
                </View>
              ))}
            </View>
          </HeroCard>
        </Rise>

        <SectionHeader title="Conquistas" action={`${unlocked} de ${all.length}`} />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'todas', label: 'Todas' },
            { key: 'abertas', label: 'Ganhas' },
            { key: 'fechadas', label: 'A conquistar' },
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
              <PressableScale onPress={() => setOpen(b)} accessibilityRole="button" accessibilityLabel={`${b.name}, ${b.unlocked ? 'desbloqueada' : 'a conquistar'}`} style={styles.cell}>
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

      <BottomSheet visible={!!open} onClose={() => setOpen(null)} closeLabel="Fechar detalhe" contentStyle={{ alignItems: 'center', gap: 0 }}>
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
              <Text style={styles.sheetSub}>{open.unlocked ? 'Desbloqueada' : `Progresso: ${open.sub}`}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' }}>
                <Button label="Fechar" variant="secondary" onPress={() => setOpen(null)} style={{ flex: 1 }} />
                {open.unlocked ? <Button label="Compartilhar" style={{ flex: 1 }} onPress={() => void Share.share({ message: `Desbloqueei "${open.name}" no Move Studio.` })} /> : null}
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
