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
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { colors, gradients, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { flattenWorkout, nextPrescription } from '@/src/features/fitness/flatten';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { useLoadHistory } from '@/src/features/fitness/useFitness';
import type { FitnessWorkoutView } from '@/src/features/fitness/types';
import { loadDraft, saveDraft, setFinishedSession, SetLog } from '@/src/features/fitness/sessionStore';
import { newIdempotencyKey } from '@/src/features/fitness/resultsQueue';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutGate id={id}>{(workout) => <WorkoutSession workout={workout} />}</WorkoutGate>;
}

function WorkoutSession({ workout }: { workout: FitnessWorkoutView }) {
  const insets = useSafeAreaInsets();
  const LOAD_HISTORY = useLoadHistory();
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
  const [listOpen, setListOpen] = useState(false);

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
        const p = nextPrescription(rows[d.idx], d.logs[d.idx]?.length ?? 0);
        setKg(p.kg);
        setReps(p.reps);
      }
      setReady(true);
    });
  }, [workout.id, rows]);

  useEffect(() => {
    if (ready) void saveDraft({ workoutId: workout.id, idx, logs, elapsed });
    // Salva ao mudar de exercício ou série; o cronômetro (elapsed) fica de fora para não gravar a cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idx, logs, workout.id]);

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
    const p = nextPrescription(rows[i], logs[i]?.length ?? 0);
    setKg(p.kg);
    setReps(p.reps);
    setRest(0);
  }

  function completeSet() {
    const next = logs.map((l, i) => (i === idx ? [...l, { kg, reps }] : l));
    setLogs(next);
    say(`${formatKg(kg)} quilos, ${reps} repetições`);
    const doneCount = next[idx].length;
    if (doneCount < row.sets.length) {
      // Próxima série já vem com a carga/repetições prescritas (drop set muda a cada estágio).
      const upcoming = row.sets[doneCount];
      setKg(upcoming.kg);
      setReps(upcoming.reps);
      const restAfter = row.sets[doneCount - 1]?.rest ?? row.restSeconds;
      if (restAfter > 0) {
        setRest(restAfter);
        setRestTotal(restAfter);
      }
    }
  }

  function finish() {
    // O rascunho só é apagado depois que o resultado for salvo (na tela de conclusão).
    setFinishedSession({ workoutId: workout.id, idx, logs, elapsed, finishedAt: new Date().toISOString(), resultKey: newIdempotencyKey() });
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

      <View style={styles.segments}>
        {rows.map((r, i) => {
          const frac = i < idx ? 1 : i === idx ? Math.min(1, done.length / r.sets.length) : (logs[i]?.length ?? 0) >= r.sets.length ? 1 : 0;
          return (
            <Pressable
              key={r.key}
              onPress={() => goTo(i)}
              hitSlop={{ top: 10, bottom: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Ir para o exercício ${i + 1}, ${r.name}`}
              accessibilityState={{ selected: i === idx }}
              style={styles.segmentHit}
            >
              <View style={[styles.segment, i === idx && styles.segmentNow]}>
                <View style={[styles.segmentFill, { width: `${frac * 100}%` }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.navRow}>
        <Text style={styles.navCount}>
          {'Exercício '}
          <Text style={styles.navCountStrong}>{idx + 1}</Text>
          {` de ${rows.length}`}
        </Text>
        <PressableScale onPress={() => setListOpen(true)} accessibilityRole="button" accessibilityLabel="Ver todos os exercícios do treino" style={styles.navList}>
          <Ionicons name="list" size={16} color={colors.primary} />
          <Text style={styles.navListText}>Ver treino</Text>
        </PressableScale>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
        <View style={styles.exHead}>
          <PressableScale
            onPress={() => router.push(`/cliente/exercicio/${row.exerciseId}?treino=${workout.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Ver como executar ${row.name}`}
          >
            <LinearGradient colors={gradients.media} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
              <View style={styles.thumbPlay}>
                <Ionicons name="play" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
              </View>
            </LinearGradient>
          </PressableScale>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.prescription} numberOfLines={2}>
              {[row.snapshot?.muscle_group, row.prescription, row.tag === 'Drop set' ? row.loadLabel : null].filter(Boolean).join(' · ')}
            </Text>
            <Pressable onPress={() => router.push(`/cliente/exercicio/${row.exerciseId}?treino=${workout.id}`)} hitSlop={8} accessibilityRole="link">
              <Text style={styles.howTo}>{row.snapshot?.media.length ? 'Vídeo do seu personal' : 'Como executar'}</Text>
            </Pressable>
          </View>
        </View>

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

        {!isLast ? (
          <Pressable
            onPress={() => goTo(idx + 1)}
            accessibilityRole="button"
            accessibilityLabel={`A seguir: ${rows[idx + 1].name}. Ir agora`}
            style={({ pressed }) => [styles.nextRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.nextLabel}>A seguir</Text>
            <Text style={styles.nextName} numberOfLines={1}>{rows[idx + 1].name}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
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

      <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} title={workout.title} contentStyle={{ gap: 0 }}>
        {rows.map((r, i) => {
          const count = logs[i]?.length ?? 0;
          const isDone = count >= r.sets.length;
          const on = i === idx;
          return (
            <Pressable
              key={r.key}
              onPress={() => {
                goTo(i);
                setListOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${i + 1}. ${r.name}${isDone ? ', feito' : on ? ', agora' : ''}`}
              style={({ pressed }) => [styles.listRow, i < rows.length - 1 && styles.listBorder, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.listIndex, isDone ? styles.listIndexDone : on ? styles.listIndexNow : null]}>
                {isDone ? <Ionicons name="checkmark" size={15} color="#fff" /> : <Text style={[styles.listIndexText, on && { color: '#fff' }]}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.listName, on && { color: colors.primary }]} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.listMeta} numberOfLines={1}>{count > 0 && !isDone ? `${count} de ${r.sets.length} séries · ${r.prescription}` : r.prescription}</Text>
              </View>
              {on ? <Text style={styles.listNow}>agora</Text> : null}
            </Pressable>
          );
        })}
      </BottomSheet>

      <Toast toast={toast} top={insets.top + 72} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  voice: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingTop: 6 },
  segmentHit: { flex: 1, paddingVertical: 4 },
  segment: { height: 5, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  segmentNow: { height: 5, backgroundColor: '#c9d6f2' },
  segmentFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  navCount: { ...text.callout, color: colors.textMuted },
  navCountStrong: { ...text.calloutStrong, color: colors.text },
  navList: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.primaryWash },
  navListText: { ...text.calloutStrong, color: colors.primary },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 76, height: 76, borderRadius: radii.lg - 2, alignItems: 'center', justifyContent: 'center' },
  thumbPlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { ...text.title, color: colors.text },
  prescription: { ...text.callout, marginTop: 3, color: colors.textMuted },
  howTo: { ...text.calloutStrong, marginTop: 6, color: colors.primary },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  nextLabel: { ...text.captionStrong, color: colors.textMuted },
  nextName: { ...text.calloutStrong, flex: 1, color: colors.text },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  listIndex: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  listIndexDone: { backgroundColor: colors.success, borderColor: colors.success },
  listIndexNow: { backgroundColor: colors.primary, borderColor: colors.primary },
  listIndexText: { ...text.captionStrong, color: colors.textMuted },
  listName: { ...text.bodyStrong, color: colors.text },
  listMeta: { ...text.caption, marginTop: 1, color: colors.textMuted },
  listNow: { ...text.captionStrong, color: colors.primary },
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
