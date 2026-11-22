import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, HeroCard, IconButton, IconTile, Muted, Num, PressableScale, Rise, Screen, SectionHeader, StatStrip, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { estimateMinutes, flattenWorkout, totalSets } from '@/src/features/fitness/flatten';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { useLoadHistory } from '@/src/features/fitness/useFitness';
import { partLabel, partLines, partMode, workoutChips } from '@/src/features/fitness/parts';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { openViewer } from '@/src/features/media/viewer';
import { clientDataMode } from '@/src/features/client/dataMode';
import { getAccessToken } from '@/src/shared/api/token-store';
import { API_URL } from '@/src/shared/config';
import type { FitnessWorkoutView } from '@/src/features/fitness/types';
import { loadDraft, type SessionDraft } from '@/src/features/fitness/sessionStore';
import { exerciseStatus } from '@/src/features/fitness/sessionStatus';
import { formatClock, formatKg, weekdayFull } from '@/src/shared/format';
import { useNow } from '@/src/shared/useNow';

export default function WorkoutSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <WorkoutGate id={id} title={i18n.t('fitness:sheet.title')}>
      {(workout) => <WorkoutSheet workout={workout} />}
    </WorkoutGate>
  );
}

function WorkoutSheet({ workout }: { workout: FitnessWorkoutView }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const now = useNow();
  const LOAD_HISTORY = useLoadHistory();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const rows = flattenWorkout(workout);
  // A ficha continua montada por baixo da sessão; recarrega o draft a cada vez que volta ao foco.
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadDraft(workout.id).then((d) => {
        if (active) setDraft(d);
      });
      return () => {
        active = false;
      };
    }, [workout.id]),
  );
  const hasStrength = rows.length > 0;
  const today = new Date().getDay();
  const isToday = workout.schedule.weekdays?.includes(today);
  const nextDay = workout.schedule.weekdays?.map((d) => (d - today + 7) % 7).filter((d) => d > 0).sort((a, b) => a - b)[0];
  const when = isToday ? t('sheet.today') : nextDay === 1 ? t('sheet.tomorrow') : nextDay != null ? t('sheet.next', { day: weekdayFull(new Date(now + nextDay * 86_400_000)) }) : '';
  const firstOther = workout.parts.findIndex((p) => partMode(p) !== 'sets');

  // Ficha em PDF do portal (com a sessão do aluno), aberta no visualizador do app.
  async function openPdf() {
    setPdfError(null);
    if (clientDataMode() !== 'live') {
      setPdfError(t('sheet.pdfDemo'));
      return;
    }
    setPdfBusy(true);
    try {
      const token = await getAccessToken('client');
      const target = `${cacheDirectory}ficha-${workout.id}.pdf`;
      const res = await downloadAsync(`${API_URL}/api/public/portal/fitness/workouts/${workout.id}/pdf`, target, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (res.status !== 200) throw new Error(String(res.status));
      openViewer({ kind: 'pdf', uri: res.uri, title: workout.title });
    } catch {
      setPdfError(t('sheet.pdfFail'));
    } finally {
      setPdfBusy(false);
    }
  }

  const start = (i: number) => {
    const mode = partMode(workout.parts[i]);
    if (mode === 'sets') router.push(`/cliente/treino/sessao/${workout.id}`);
    else if (mode === 'gps') router.push(`/cliente/treino/gravar/${workout.id}?parte=${i}`);
    else router.push(`/cliente/treino/registrar/${workout.id}?parte=${i}`);
  };
  const actionLabel = (i: number) => {
    const p = workout.parts[i];
    const mode = partMode(p);
    if (mode === 'gps') return p.type === 'endurance' && p.sport === 'bike' ? t('sheet.recordRide') : t('sheet.recordRun');
    if (mode === 'done') return t('sheet.markDone');
    return t('sheet.logResult');
  };

  return (
    <Screen>
      <TopBar safe title={t('sheet.title')} onBack={() => router.back()} right={<IconButton icon="document-text-outline" accessibilityLabel={t('sheet.pdfA11y')} onPress={() => void openPdf()} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        {pdfBusy ? <Muted style={styles.note}>{t('sheet.downloading')}</Muted> : pdfError ? <Muted style={styles.note}>{pdfError}</Muted> : null}

        <Rise style={{ marginTop: 4 }}>
          <HeroCard>
            {draft ? (
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('sheet.live')}</Text>
                <Text style={styles.liveTime}>{formatClock(draft.elapsed)}</Text>
              </View>
            ) : null}
            {when ? <Text style={styles.when}>{when}</Text> : null}
            <Text style={styles.title}>{workout.title}</Text>
            {hasStrength && workout.parts.length === 1 ? (
              <StatStrip
                style={styles.stats}
                items={[
                  { value: rows.length, label: t('sheet.exercisesUnit', { count: rows.length }) },
                  { value: totalSets(rows), label: t('sheet.setsUnit') },
                  { value: estimateMinutes(rows), label: t('sheet.minutesUnit') },
                ]}
              />
            ) : (
              <View style={styles.chips}>
                {workoutChips(workout).map((c, k) => (
                  <Badge key={k} label={c} tone="primary" />
                ))}
              </View>
            )}
          </HeroCard>
        </Rise>

        {workout.coach_note ? (
          <Rise index={1} style={{ marginTop: 12 }}>
            <Card style={styles.noteCard}>
              <IconTile icon="chatbox-ellipses-outline" size={38} tone="soft" />
              <View style={{ flex: 1 }}>
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12.5 }}>{t('sheet.coachNote')}</Muted>
                <Text style={styles.noteText}>{workout.coach_note}</Text>
              </View>
            </Card>
          </Rise>
        ) : null}

        {workout.parts.map((part, pi) => {
          if (part.type === 'strength') {
            const partRows = rows.filter((r) => r.partIndex === pi);
            return (
              <View key={pi}>
                <SectionHeader title={part.name || t('sheet.exercises')} />
                <View style={{ gap: 10 }}>
                  {partRows.map((r, i) => {
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
                            <Muted style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>{r.blockKind === 'dropset' ? `${r.prescription} · ${r.loadLabel}` : r.prescription}</Muted>
                            {r.tag ? <View style={{ marginTop: 8 }}><Badge label={r.tag} tone="primary" /></View> : null}
                          </View>
                          {last != null ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Muted style={{ fontSize: 11.5 }}>{t('sheet.last')}</Muted>
                              <Text style={styles.last}>{`${formatKg(last)} kg`}</Text>
                            </View>
                          ) : null}
                          {draft ? (
                            (() => {
                              const ri = rows.indexOf(r);
                              const done = draft.logs[ri] ?? [];
                              const status = exerciseStatus(r, done, ri === draft.idx);
                              if (status === 'done') return <Ionicons name="checkmark-circle" size={20} color={colors.success} />;
                              if (status === 'active') return <Text style={styles.exNow}>{t('sheet.exNow')}</Text>;
                              if (status === 'incomplete') return <Text style={styles.exIncomplete}>{t('sheet.exIncomplete', { done: done.length, total: r.sets.length })}</Text>;
                              return null;
                            })()
                          ) : null}
                        </PressableScale>
                      </Rise>
                    );
                  })}
                </View>
              </View>
            );
          }
          const lines = partLines(part, workout.exercise_snapshots);
          return (
            <View key={pi}>
              <SectionHeader title={part.name || partLabel(part)} />
              <Card style={{ padding: 18, gap: 10 }}>
                <Badge label={partLabel(part)} tone="primary" />
                {lines.map((l, k) => (
                  <View key={k} style={styles.line}>
                    <View style={styles.dot} />
                    <Text style={styles.lineText}>{l}</Text>
                  </View>
                ))}
                {workout.parts.length > 1 || hasStrength ? (
                  <Button label={actionLabel(pi)} variant="soft" icon={partMode(part) === 'gps' ? 'navigate-outline' : 'create-outline'} onPress={() => start(pi)} style={{ marginTop: 6 }} />
                ) : null}
              </Card>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {hasStrength ? (
          <Button label={draft ? t('sheet.continueWorkout') : t('sheet.start')} icon="play" onPress={() => router.push(`/cliente/treino/sessao/${workout.id}`)} />
        ) : firstOther >= 0 ? (
          <Button label={actionLabel(firstOther)} icon={partMode(workout.parts[firstOther]) === 'gps' ? 'navigate' : 'play'} onPress={() => start(firstOther)} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.primarySoft, color: colors.primaryDeep, lineHeight: 19 },
  when: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary },
  title: { marginTop: 8, ...text.display, color: colors.text },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  liveText: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, letterSpacing: 0.3, color: colors.primaryDeep },
  liveTime: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, color: colors.textMuted, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  exNow: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, color: colors.primary },
  exIncomplete: { fontFamily: typography.fontFamilySemiBold, fontSize: 11, color: colors.warnText },
  stats: { marginTop: 20 },
  noteCard: { flexDirection: 'row', gap: 12, padding: 16 },
  noteText: { marginTop: 4, fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, borderRadius: radii.xl - 2, backgroundColor: '#fff', ...shadows.card },
  num: { width: 56, height: 56, borderRadius: radii.lg - 4, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, lineHeight: 19, color: colors.text },
  last: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.primary },
  lineText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 21, color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, backgroundColor: 'rgba(244,247,252,0.94)' },
});
