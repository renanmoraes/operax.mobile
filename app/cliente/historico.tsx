import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Muted, ProgressBar, Rise, Screen, SectionHeader, StatTile, TopBar } from '@/src/design-system/ui';
import { colors, numbers, radii, typography } from '@/src/design-system/tokens';
import { workoutForWeekday } from '@/src/features/fitness/mockData';
import { useFitnessSummary, useHistory } from '@/src/features/fitness/useFitness';
import { formatDuration, isoDate, monthFull, weekdayShort } from '@/src/shared/format';
import { useNow } from '@/src/shared/useNow';

const GROUPS: Record<string, [string, number][]> = {
  'w-a': [['Peito', 13], ['Braços', 9]],
  'w-b': [['Costas', 14], ['Braços', 5]],
  'w-c': [['Pernas e glúteos', 24]],
};

export default function FitnessHistoryScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { data: history } = useHistory();
  const { data: summary } = useFitnessSummary();
  const today = new Date();
  const doneDates = new Set(history?.map((e) => e.date));
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const groupTotals = new Map<string, number>();
  const cutoff = isoDate(new Date(now - 30 * 86_400_000));
  history
    ?.filter((e) => e.date >= cutoff)
    .forEach((e) => {
      const wid = e.title.startsWith('Treino A') ? 'w-a' : e.title.startsWith('Treino B') ? 'w-b' : 'w-c';
      GROUPS[wid].forEach(([g, n]) => groupTotals.set(g, (groupTotals.get(g) ?? 0) + n));
    });
  const groups = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]);
  const maxGroup = Math.max(1, ...groups.map((g) => g[1]));

  return (
    <Screen>
      <TopBar safe title="Histórico" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Rise style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile value={String(summary?.streak ?? '–')} label="dias seguidos" accent />
          <StatTile value={String(summary?.monthCount ?? '–')} label="este mês" />
          <StatTile value={String(summary?.totalSessions ?? '–')} label="no total" />
        </Rise>

        <Rise index={1} style={{ marginTop: 12 }}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{`${monthFull(today)[0].toUpperCase()}${monthFull(today).slice(1)}`}</Text>
              <Muted>{`consistência de ${summary?.consistency ?? '–'}%`}</Muted>
            </View>
            <View style={styles.grid}>
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((l, i) => (
                <Text key={i} style={styles.wd}>{l}</Text>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <View key={`e${i}`} style={styles.cell} />
              ))}
              {Array.from({ length: daysIn }, (_, i) => {
                const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
                const iso = isoDate(d);
                const isToday = iso === isoDate(today);
                const past = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const planned = !!workoutForWeekday(d.getDay());
                const state = doneDates.has(iso) ? 'done' : isToday ? 'today' : past && planned ? 'missed' : past ? 'rest' : 'future';
                return (
                  <View key={iso} style={styles.cell}>
                    <View style={[styles.day, styles[state]]}>
                      <Text style={[styles.dayText, state === 'done' && { color: '#fff' }, state === 'missed' && { color: colors.warn }, state === 'today' && { color: colors.primary }, state === 'rest' && { color: colors.primaryDeep }, state === 'future' && { color: colors.textMuted }]}>{i + 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <Legend color={colors.primary} label="Treinou" />
              <Legend color={colors.primarySoft} label="Descanso do plano" />
              <Legend color="#fff" border={colors.warn} label="Faltou" />
            </View>
            <Muted style={{ marginTop: 10, lineHeight: 18 }}>A sequência conta os dias em que você cumpriu o plano. Descanso programado também conta.</Muted>
          </Card>
        </Rise>

        <Rise index={2} style={{ marginTop: 12 }}>
          <Card>
            <Text style={styles.cardTitle}>Onde foi o seu esforço</Text>
            <Muted style={{ marginTop: 3 }}>Séries por grupo muscular nos últimos 30 dias</Muted>
            <View style={{ gap: 12, marginTop: 14 }}>
              {groups.map(([g, n]) => (
                <View key={g}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.groupName}>{g}</Text>
                    <Muted>{`${n} séries`}</Muted>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar progress={n / maxGroup} height={10} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </Rise>

        <SectionHeader title="Todos os treinos" />
        <View style={{ gap: 8 }}>
          {history?.slice(0, 12).map((e) => {
            const d = new Date(`${e.date}T12:00:00`);
            const watch = e.sources.find((s) => s.origin !== 'portal');
            return (
              <Card key={e.id} style={styles.entry}>
                <View style={{ width: 46, alignItems: 'center' }}>
                  <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 11.5 }}>{weekdayShort(d)}</Muted>
                  <Text style={styles.entryDay}>{d.getDate()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.entryTitle} numberOfLines={1}>{e.title}</Text>
                  <Muted style={{ marginTop: 3 }} numberOfLines={1}>
                    {[formatDuration(e.duration_seconds), e.sets_done ? `${e.sets_done} séries` : null, e.volume_kg ? `${e.volume_kg.toLocaleString('pt-BR')} kg` : null, watch ? watch.label : null].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
                {e.record ? <Badge label="Recorde" tone="solid" /> : e.effort ? <Badge label={`Esforço ${e.effort}`} tone="primary" /> : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: color, borderWidth: border ? 1.5 : 0, borderColor: border }} />
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted, marginBottom: 8 },
  cell: { width: `${100 / 7}%`, padding: 3 },
  day: { height: 36, borderRadius: radii.md - 2, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.primary },
  missed: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.warn },
  today: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.primary },
  rest: { backgroundColor: colors.primarySoft },
  future: { backgroundColor: 'transparent' },
  dayText: { fontFamily: typography.fontFamilyBold, fontSize: 13, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  groupName: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.text },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  entryDay: { ...numbers.md, color: colors.text },
  entryTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
});
