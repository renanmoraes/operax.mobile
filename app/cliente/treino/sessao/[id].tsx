import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { ActionRow, IconButton, Muted, Num, PressableScale, ProgressRing, Screen } from '@/src/design-system/ui';
import { Toast, useToast } from '@/src/design-system/Toast';
import { colors, gradients, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { flattenWorkout } from '@/src/features/fitness/flatten';
import { LOAD_HISTORY, WORKOUTS } from '@/src/features/fitness/mockData';
import { clearDraft, loadDraft, saveDraft, setFinishedSession, SetLog } from '@/src/features/fitness/sessionStore';
import { formatClock, formatKg } from '@/src/shared/format';

function Stepper({ label, value, unit, onMinus, onPlus }: { label: string; value: string; unit?: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <PressableScale onPress={onMinus} accessibilityRole="button" accessibilityLabel={`Diminuir ${label.toLowerCase()}`} scaleTo={0.9} style={styles.stepBtn}>
          <Ionicons name="remove" size={22} color={colors.primary} />
        </PressableScale>
        <Num size="lg" accessibilityLiveRegion="polite">
          {value}
          {unit ? <Text style={{ fontSize: 13, color: colors.textMuted }}>{` ${unit}`}</Text> : null}
        </Num>
        <PressableScale onPress={onPlus} accessibilityRole="button" accessibilityLabel={`Aumentar ${label.toLowerCase()}`} scaleTo={0.9} style={styles.stepBtn}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </PressableScale>
      </View>
    </View>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [4 + (i * 112) / (values.length - 1), max === min ? 18 : 32 - ((v - min) / (max - min)) * 28]);
  const last = pts[pts.length - 1];
  return (
    <Svg width={120} height={36} accessibilityLabel="Evolução da carga nas últimas sessões">
      <Polyline points={pts.map((p) => p.join(',')).join(' ')} stroke={colors.primary} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.primary} />
    </Svg>
  );
}

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = WORKOUTS.find((w) => w.id === id) ?? WORKOUTS[0];
  const rows = useMemo(() => flattenWorkout(workout), [workout]);

  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(0);
  const [logs, setLogs] = useState<SetLog[][]>(() => rows.map(() => []));
  const [kg, setKg] = useState(rows[0]?.kg ?? 0);
  const [reps, setReps] = useState(rows[0]?.reps ?? 0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [rest, setRest] = useState(0);
  const [restTotal, setRestTotal] = useState(60);
  const [voice, setVoice] = useState(true);
  const { toast, show } = useToast(2600);

  const row = rows[idx];
  const done = logs[idx] ?? [];
  const exDone = done.length >= row.sets.length;
  const isLast = idx === rows.length - 1;
  const resting = rest > 0;
  const step = row.snapshot?.equipment?.toLowerCase().includes('halter') ? 2 : 2.5;

  useEffect(() => {
    void loadDraft(workout.id).then((d) => {
      if (d && d.logs.length === rows.length) {
        setIdx(d.idx);
        setLogs(d.logs);
        setElapsed(d.elapsed);
        setKg(rows[d.idx].kg);
        setReps(rows[d.idx].reps);
      }
      setReady(true);
    });
  }, [workout.id, rows]);

  useEffect(() => {
    if (ready) void saveDraft({ workoutId: workout.id, idx, logs, elapsed });
  }, [ready, idx, logs]);

  useEffect(() => {
    const t = setInterval(() => {
      if (paused) return;
      setElapsed((e) => e + 1);
      setRest((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => () => {
    void Speech.stop();
  }, []);

  function say(text: string) {
    show(text, 'info', 'volume-high-outline');
    if (voice) Speech.speak(text, { language: 'pt-BR' });
  }

  function goTo(i: number) {
    setIdx(i);
    setKg(rows[i].kg);
    setReps(rows[i].reps);
    setRest(0);
  }

  function completeSet() {
    const next = logs.map((l, i) => (i === idx ? [...l, { kg, reps }] : l));
    setLogs(next);
    say(`${formatKg(kg)} quilos, ${reps} repetições`);
    if (next[idx].length < row.sets.length) {
      setRest(row.restSeconds);
      setRestTotal(row.restSeconds);
    }
  }

  function finish() {
    setFinishedSession({ workoutId: workout.id, idx, logs, elapsed, finishedAt: new Date().toISOString() });
    void clearDraft(workout.id);
    Speech.stop();
    router.replace('/cliente/treino/concluido');
  }

  const primary = resting
    ? { label: 'Pular descanso', onPress: () => setRest(0) }
    : exDone
      ? isLast
        ? { label: 'Finalizar treino', onPress: finish }
        : { label: `Próximo: ${rows[idx + 1].name}`, onPress: () => goTo(idx + 1) }
      : { label: `Concluir série ${done.length + 1}`, onPress: completeSet };

  const volume = done.reduce((n, s) => n + s.kg * s.reps, 0);

  return (
    <Screen backdrop="default">
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <IconButton icon="close" accessibilityLabel="Sair do treino (seu progresso fica salvo)" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Muted style={{ fontSize: 12.5 }}>{workout.title}</Muted>
          <Num size="md" style={{ marginTop: 2 }} accessibilityLabel={`Tempo de treino ${formatClock(elapsed)}`}>{formatClock(elapsed)}</Num>
        </View>
        <PressableScale
          onPress={() => setVoice((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: voice }}
          accessibilityLabel="Narração por voz"
          scaleTo={0.9}
          style={[styles.voice, { backgroundColor: voice ? colors.primaryTint : '#fff' }]}
        >
          <Ionicons name={voice ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={voice ? colors.primary : colors.textMuted} />
        </PressableScale>
      </View>

      <View style={styles.segments} accessible accessibilityLabel={`Exercício ${idx + 1} de ${rows.length}`}>
        {rows.map((r, i) => {
          const frac = i < idx ? 1 : i === idx ? Math.min(1, done.length / r.sets.length) : 0;
          return (
            <View key={r.key} style={styles.segment}>
              <View style={[styles.segmentFill, { width: `${frac * 100}%` }]} />
            </View>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {rows.map((r, i) => {
          const isDone = (logs[i]?.length ?? 0) >= r.sets.length;
          const on = i === idx;
          return (
            <Pressable key={r.key} onPress={() => goTo(i)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on ? styles.chipOn : isDone ? styles.chipDone : styles.chipOff]}>
              <Text style={[styles.chipText, { color: on ? '#fff' : isDone ? colors.primaryDeep : colors.textMuted }]} numberOfLines={1}>
                {`${isDone && !on ? 'Feito · ' : `${i + 1}  `}${r.name.split(' ').slice(0, 2).join(' ')}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
        <PressableScale onPress={() => router.push(`/cliente/exercicio/${row.exerciseId}?treino=${workout.id}`)} accessibilityRole="button" accessibilityLabel={`Ver execução de ${row.name}`}>
          <LinearGradient colors={gradients.media} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.media}>
            <View style={styles.mediaBtn}>
              <View style={styles.mediaPlay}>
                <Ionicons name="play" size={12} color={colors.text} />
              </View>
              <Text style={styles.mediaText}>{row.snapshot?.media.length ? 'Vídeo do seu personal' : 'Como executar'}</Text>
            </View>
          </LinearGradient>
        </PressableScale>

        <Text style={styles.name}>{row.name}</Text>
        <Muted style={{ marginTop: 4, fontSize: 14 }}>{`${row.snapshot?.muscle_group ?? ''} · ${row.prescription}${row.tag === 'Drop set' ? ` · ${row.loadLabel}` : ''}`}</Muted>

        <View style={styles.pills}>
          {row.sets.map((_, i) => {
            const log = done[i];
            const current = i === done.length && !resting;
            return (
              <View key={i} style={[styles.pill, log ? styles.pillDone : current ? styles.pillNow : styles.pillNext]}>
                <Text style={[styles.pillTitle, { color: log ? colors.primaryDeep : colors.textMuted }]}>{`Série ${i + 1}`}</Text>
                <Text style={[styles.pillValue, { color: log ? colors.primaryDeep : current ? colors.text : colors.textMuted }]}>{log ? `${formatKg(log.kg)} × ${log.reps}` : current ? 'agora' : '—'}</Text>
              </View>
            );
          })}
        </View>

        {resting ? (
          <View style={styles.restCard}>
            <ProgressRing size={132} stroke={10} progress={rest / restTotal} accessibilityLabel={`Descanso: ${rest} segundos`}>
              <Num size="xl">{rest}</Num>
              <Muted style={{ fontSize: 12 }}>segundos</Muted>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={styles.restTitle}>Descanso</Text>
              <Muted style={{ marginTop: 4, lineHeight: 19 }}>{`A seguir: série ${done.length + 1} · ${formatKg(kg)} kg × ${reps}`}</Muted>
              <PressableScale onPress={() => { setRest((r) => r + 15); setRestTotal((t) => Math.max(t, rest + 15)); }} accessibilityRole="button" accessibilityLabel="Mais 15 segundos de descanso" style={styles.more}>
                <Text style={styles.moreText}>+15 s</Text>
              </PressableScale>
            </View>
          </View>
        ) : exDone ? (
          <LinearGradient colors={['rgba(79,216,255,0.18)', 'rgba(30,78,216,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneCard}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.restTitle}>Exercício concluído</Text>
              <Muted style={{ marginTop: 3, color: colors.textSoft }}>{`Volume de ${volume.toLocaleString('pt-BR')} kg`}</Muted>
            </View>
          </LinearGradient>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Stepper label="Carga" value={formatKg(kg)} unit="kg" onMinus={() => setKg((v) => Math.max(0, v - step))} onPlus={() => setKg((v) => v + step)} />
              <Stepper label="Repetições" value={String(reps)} onMinus={() => setReps((v) => Math.max(1, v - 1))} onPlus={() => setReps((v) => v + 1)} />
            </View>
            {LOAD_HISTORY[row.exerciseId] ? (
              <View style={styles.lastCard}>
                <View style={{ flex: 1 }}>
                  <Muted style={{ fontSize: 12 }}>Última vez</Muted>
                  <Text style={styles.lastValue}>{`${formatKg(LOAD_HISTORY[row.exerciseId].slice(-1)[0])} kg × ${row.reps}`}</Text>
                </View>
                <Spark values={LOAD_HISTORY[row.exerciseId]} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <PressableScale onPress={primary.onPress} accessibilityRole="button" accessibilityLabel={primary.label} style={styles.primary}>
          <Text style={styles.primaryText} numberOfLines={1}>{primary.label}</Text>
        </PressableScale>
        <ActionRow
          style={{ marginTop: 10 }}
          items={[
            {
              icon: paused ? 'play' : 'pause',
              label: paused ? 'Continuar' : 'Pausar',
              accessibilityLabel: paused ? 'Continuar treino' : 'Pausar treino',
              tone: 'primary',
              active: paused,
              onPress: () => setPaused((p) => !p),
            },
            {
              icon: 'play-skip-forward',
              label: 'Pular',
              accessibilityLabel: 'Pular para o próximo exercício',
              disabled: isLast,
              onPress: () => goTo(idx + 1),
            },
            { icon: 'flag', label: 'Encerrar', accessibilityLabel: 'Encerrar treino', tone: 'danger', onPress: finish },
          ]}
        />
      </View>

      <Toast toast={toast} top={insets.top + 72} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  voice: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingTop: 4 },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { height: 34, paddingHorizontal: 13, borderRadius: 999, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, ...shadows.button },
  chipDone: { backgroundColor: colors.primaryTint },
  chipOff: { backgroundColor: 'rgba(255,255,255,0.88)' },
  chipText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5 },
  media: { height: 132, borderRadius: radii.xl - 2, alignItems: 'center', justifyContent: 'center' },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingLeft: 6, paddingRight: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  mediaPlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  mediaText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 13.5 },
  name: { marginTop: 16, ...text.headline, color: colors.text },
  pills: { flexDirection: 'row', gap: 8, marginTop: 14 },
  pill: { flex: 1, minWidth: 0, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radii.md + 4 },
  pillDone: { backgroundColor: colors.primaryTint },
  pillNow: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primary },
  pillNext: { backgroundColor: 'rgba(255,255,255,0.7)' },
  pillTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5 },
  pillValue: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 13, fontVariant: ['tabular-nums'] },
  stepper: { flex: 1, padding: 12, borderRadius: radii.lg + 2, backgroundColor: 'rgba(255,255,255,0.88)', ...shadows.card },
  stepLabel: { textAlign: 'center', fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  lastCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.88)' },
  lastValue: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  restCard: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14, padding: 18, borderRadius: radii.xl, backgroundColor: 'rgba(255,255,255,0.88)', ...shadows.card },
  restTitle: { ...text.section, color: colors.text },
  more: { marginTop: 12, alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primaryWash, justifyContent: 'center' },
  moreText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.primary },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, padding: 18, borderRadius: radii.xl },
  doneIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.78)', borderTopLeftRadius: 28, borderTopRightRadius: 28, ...shadows.nav },
  primary: { height: 56, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, ...shadows.button },
  primaryText: { color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 16 },
});
