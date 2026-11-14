import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, HeroCard, IconButton, Muted, Num, PressableScale, Rise, Screen, SectionHeader, Segmented, StatStrip, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { estimateMinutes, flattenWorkout, totalSets } from '@/src/features/fitness/flatten';
import { LOAD_HISTORY, WORKOUTS } from '@/src/features/fitness/mockData';
import { formatKg, weekdayFull } from '@/src/shared/format';

export default function WorkoutSheetScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [current, setCurrent] = useState(id);
  const [pdfNote, setPdfNote] = useState(false);
  const workout = WORKOUTS.find((w) => w.id === current) ?? WORKOUTS[0];
  const rows = flattenWorkout(workout);
  const today = new Date().getDay();
  const isToday = workout.schedule.weekdays?.includes(today);
  const nextDay = workout.schedule.weekdays?.map((d) => (d - today + 7) % 7).filter((d) => d > 0).sort((a, b) => a - b)[0];
  const when = isToday ? 'Hoje' : nextDay === 1 ? 'Amanhã' : nextDay != null ? `Próxima ${weekdayFull(new Date(Date.now() + nextDay * 86_400_000))}` : '';

  return (
    <Screen>
      <TopBar safe title="Ficha do treino" onBack={() => router.back()} right={<IconButton icon="download-outline" accessibilityLabel="Baixar ficha em PDF" onPress={() => setPdfNote((v) => !v)} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        {pdfNote ? <Muted style={styles.note}>O PDF da ficha (GET /workouts/:id/pdf) chega quando o treino estiver ligado à sua conta.</Muted> : null}
        <Segmented
          value={workout.id}
          onChange={setCurrent}
          options={WORKOUTS.map((w) => ({ key: w.id, label: w.title.split('·')[0].trim() }))}
        />

        <Rise style={{ marginTop: 12 }}>
          <HeroCard>
            <Text style={styles.when}>{when}</Text>
            <Text style={styles.title}>{workout.title.split('·')[1]?.trim() ?? workout.title}</Text>
            <StatStrip
              style={styles.stats}
              items={[
                { value: rows.length, label: 'exercícios' },
                { value: totalSets(rows), label: 'séries' },
                { value: estimateMinutes(rows), label: 'minutos' },
              ]}
            />
          </HeroCard>
        </Rise>

        {workout.coach_note ? (
          <Rise index={1} style={{ marginTop: 12 }}>
            <Card style={styles.noteCard}>
              <Avatar initials="CM" size={38} />
              <View style={{ flex: 1 }}>
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12.5 }}>{`Observação de ${workout.contact_name?.split(' ')[0] ?? 'seu personal'}`}</Muted>
                <Text style={styles.noteText}>{workout.coach_note}</Text>
              </View>
            </Card>
          </Rise>
        ) : null}

        <SectionHeader title="Exercícios" />
        <View style={{ gap: 10 }}>
          {rows.map((r, i) => {
            const hist = LOAD_HISTORY[r.exerciseId];
            const last = hist?.[hist.length - 1];
            return (
              <Rise key={r.key} index={i + 2}>
                <PressableScale onPress={() => router.push(`/cliente/exercicio/${r.exerciseId}?treino=${workout.id}`)} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.prescription}`} style={styles.row}>
                  <View style={styles.num}>
                    <Num size="sm" style={{ color: colors.primary }}>{i + 1}</Num>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle}>{r.name}</Text>
                    <Muted style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>{r.tag === 'Drop set' ? `${r.prescription} · ${r.loadLabel}` : r.prescription}</Muted>
                    {r.tag ? <View style={{ marginTop: 8 }}><Badge label={r.tag} tone="primary" /></View> : null}
                  </View>
                  {last != null ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Muted style={{ fontSize: 11.5 }}>última</Muted>
                      <Text style={styles.last}>{`${formatKg(last)} kg`}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </Rise>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Button label="Começar treino" icon="play" onPress={() => router.push(`/cliente/treino/sessao/${workout.id}`)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.primarySoft, color: colors.primaryDeep, lineHeight: 19 },
  when: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary },
  title: { marginTop: 8, ...text.display, color: colors.text },
  stats: { marginTop: 20 },
  noteCard: { flexDirection: 'row', gap: 12, padding: 16 },
  noteText: { marginTop: 4, fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, borderRadius: radii.xl - 2, backgroundColor: '#fff', ...shadows.card },
  num: { width: 56, height: 56, borderRadius: radii.lg - 4, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, lineHeight: 19, color: colors.text },
  last: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, backgroundColor: 'rgba(244,247,252,0.94)' },
});
