import { router, useLocalSearchParams } from 'expo-router';
import i18n, { locale } from '@/src/i18n';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { ActionRow, EmptyState, IconButton, Muted, Num, PressableScale, ProgressRing, Screen, TopBar } from '@/src/design-system/ui';
import { Toast, useToast } from '@/src/design-system/Toast';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { colors, gradients, radii, shadows, text, typography, glass } from '@/src/design-system/tokens';
import { flattenWorkout, nextPrescription, stepLoad, type ExerciseRow } from '@/src/features/fitness/flatten';
import { exerciseStatus, nextOpenIndex, transitionRest, type ExerciseStatus } from '@/src/features/fitness/sessionStatus';
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
        <PressableScale onPress={onMinus} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:session.decrease', { what: label.toLowerCase() })} scaleTo={0.9} style={styles.stepBtn}>
          <Ionicons name="remove" size={22} color={colors.primary} />
        </PressableScale>
        <Num size="lg" fit accessibilityLiveRegion="polite" style={styles.stepValue}>
          {value}
          {unit ? <Text style={{ fontSize: 13, color: colors.textMuted }}>{` ${unit}`}</Text> : null}
        </Num>
        <PressableScale onPress={onPlus} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:session.increase', { what: label.toLowerCase() })} scaleTo={0.9} style={styles.stepBtn}>
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
    <Svg width={120} height={36} accessibilityLabel={i18n.t('fitness:session.sparkA11y')}>
      <Polyline points={pts.map((p) => p.join(',')).join(' ')} stroke={colors.primary} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.primary} />
    </Svg>
  );
}

function PreviewPanel({ row, status, doneCount, onFinish, onBack }: { row: ExerciseRow; status: ExerciseStatus; doneCount: number; onFinish: () => void; onBack: () => void }) {
  const statusLabel =
    status === 'done' ? i18n.t('fitness:session.previewStatusDone') : status === 'incomplete' ? i18n.t('fitness:session.previewStatusIncomplete', { done: doneCount, total: row.sets.length }) : i18n.t('fitness:session.previewStatusPending');
  return (
    <View>
      <View style={styles.exHead} accessible accessibilityLabel={i18n.t('fitness:session.previewA11y', { name: row.name })}>
        <LinearGradient colors={gradients.media} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.prescription}>{row.prescription}</Text>
          <Text style={styles.howTo}>{statusLabel}</Text>
        </View>
      </View>
      {status !== 'done' ? (
        <PressableScale onPress={onFinish} accessibilityRole="button" style={[styles.primary, { marginTop: 18 }]}>
          <Text style={styles.primaryText}>{i18n.t('fitness:session.previewFinish')}</Text>
        </PressableScale>
      ) : null}
      <Pressable onPress={onBack} accessibilityRole="button" style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={styles.howTo}>{i18n.t('fitness:session.previewBack')}</Text>
      </Pressable>
    </View>
  );
}

/** Hora atual em ms (fora do componente: os cronômetros só leem o relógio em eventos e no tique). */
const wallClock = () => Date.now();

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutGate id={id}>{(workout) => (flattenWorkout(workout).length ? <WorkoutSession workout={workout} /> : <NoSetsSession workout={workout} />)}</WorkoutGate>;
}

/** Treino sem exercício de força (só WOD, texto, corrida…): a sessão de séries não serve; cada parte se registra na ficha. */
function NoSetsSession({ workout }: { workout: FitnessWorkoutView }) {
  return (
    <Screen>
      <TopBar safe title={workout.title} onBack={() => router.back()} />
      <EmptyState
        icon="list-outline"
        title={i18n.t('fitness:session.noSets')}
        subtitle={i18n.t('fitness:session.noSetsSub')}
        actionLabel={i18n.t('fitness:session.openSheet')}
        onAction={() => router.replace(`/cliente/treino/${workout.id}`)}
      />
    </Screen>
  );
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
  // Cronômetros pelo relógio (não por contagem de segundos): com a tela bloqueada o iPhone para os timers
  // do app, e ao voltar o tempo do treino e o descanso precisam estar certos.
  const [now, setNow] = useState(wallClock);
  const [paused, setPaused] = useState(false);
  /** Tempo de treino: o acumulado até a última pausa + o trecho correndo desde `since`. */
  const [clock, setClock] = useState<{ base: number; since: number | null }>(() => ({ base: 0, since: wallClock() }));
  /** Descanso correndo: termina em `restUntil`. Pausado: os segundos que faltavam ficam em `restFrozen`. */
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [restFrozen, setRestFrozen] = useState(0);
  const [restTotal, setRestTotal] = useState(60);
  const [started, setStarted] = useState<boolean[]>(() => rows.map(() => false));
  const [activeSeconds, setActiveSeconds] = useState<number[]>(() => rows.map(() => 0));
  const [restSecondsArr, setRestSecondsArr] = useState<number[]>(() => rows.map(() => 0));
  /** Qual acumulador está ligado agora — exatamente um por vez. */
  const [bucket, setBucket] = useState<{ idx: number; kind: 'active' | 'rest' }>(() => ({ idx: 0, kind: 'rest' }));
  const [bucketSince, setBucketSince] = useState<number | null>(wallClock());
  /** Nome/volume do exercício que acabou de fechar + tipo de descanso — só preenchido durante a transição (estado 3/4). `null` fora dela. */
  const [justFinished, setJustFinished] = useState<{ name: string; volume: number; restKind: 'ring' | 'stopwatch' } | null>(null);
  /** Só importa durante uma transição com cronômetro crescente, ou quando o anel já zerou e o aluno tocou "Pular descanso" antes do fim. */
  const [explicitGateOpen, setExplicitGateOpen] = useState(false);
  const elapsedAt = (t: number) => Math.floor(clock.base + (clock.since != null ? Math.max(0, t - clock.since) / 1000 : 0));
  const elapsed = elapsedAt(now);
  const rest = paused ? restFrozen : restUntil != null ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const [voice, setVoice] = useState(true);
  const { toast, show } = useToast(2600);
  const [listOpen, setListOpen] = useState(false);
  /** Exercício aberto em modo só leitura (toque no segmento/lista/"A seguir"); `null` = sem prévia. */
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const row = rows[idx];
  const done = logs[idx] ?? [];
  const exDone = done.length >= row.sets.length;
  const resting = rest > 0;
  /** true enquanto o exercício ativo ainda não foi "Iniciado" — mostra transição (3) ou o gate (4). */
  const isGated = !started[idx];
  /**
   * Transição com anel: só sai do anel quando ele zera ou o aluno pula. Sem anel (cronômetro crescente ou
   * primeiro exercício do treino, `justFinished` nulo), não tem o que esperar — cai direto no gate (estado 4),
   * mostrando o cronômetro como informação dentro da própria tela "Pronto pra começar".
   */
  const inExTransition = isGated && justFinished?.restKind === 'ring' && !explicitGateOpen && rest > 0;
  const inGate = isGated && !inExTransition;
  /** Segundos de descanso/transição acumulados pro exercício atual, já somando o trecho em andamento (não reinicia numa pausa, ao contrário de `now - bucketSince` sozinho). */
  const bucketElapsed = Math.floor(liveSeconds(restSecondsArr, 'rest', idx, now));
  // Superset/circuito: o exercício da vez é o do estágio atual, não o primeiro do bloco.
  const stage = row.sets[Math.min(done.length, row.sets.length - 1)];
  const exId = stage?.exerciseId ?? row.exerciseId;
  const exName = stage?.name ?? row.name;
  const exSnap = stage?.snapshot ?? row.snapshot;
  const step = exSnap?.equipment?.toLowerCase().includes('halter') ? 2 : 2.5;

  useEffect(() => {
    void loadDraft(workout.id).then((d) => {
      if (d && d.logs.length === rows.length) {
        setIdx(d.idx);
        setLogs(d.logs);
        setClock({ base: d.elapsed, since: wallClock() });
        setStarted(d.started);
        setActiveSeconds(d.activeSeconds);
        setRestSecondsArr(d.restSeconds);
        const p = nextPrescription(rows[d.idx], d.logs[d.idx]?.length ?? 0);
        setKg(p.kg);
        setReps(p.reps);
        if (d.started[d.idx]) {
          setBucket({ idx: d.idx, kind: 'active' });
        } else {
          // Reabriu sem ter tocado "Iniciar" nesse exercício: continua travado no "Pronto pra começar".
          setBucket({ idx: d.idx, kind: 'rest' });
          setJustFinished(null);
          setExplicitGateOpen(false);
        }
        setBucketSince(wallClock());
      }
      setReady(true);
    });
  }, [workout.id, rows]);

  useEffect(() => {
    if (ready) {
      const t = wallClock();
      void saveDraft({ workoutId: workout.id, idx, logs, elapsed: elapsedAt(t), started, activeSeconds: currentActiveSeconds(t), restSeconds: currentRestSeconds(t) });
    }
    // Salva ao mudar de exercício ou série; o cronômetro (elapsed) fica de fora para não gravar a cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idx, logs, started, activeSeconds, restSecondsArr, bucket, workout.id]);

  useEffect(() => {
    const tick = () => setNow(wallClock());
    const t = setInterval(tick, 1000);
    // Voltou para o app: acerta na hora (o tempo que passou bloqueado conta, o descanso pode ter acabado).
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') tick();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);

  /** Soma o tempo desde que o bucket ligou no array certo, sem mudar o que está ligado agora. */
  function flushBucket(t: number) {
    if (bucketSince == null) return;
    const delta = Math.max(0, t - bucketSince) / 1000;
    if (bucket.kind === 'active') setActiveSeconds((arr) => arr.map((v, i) => (i === bucket.idx ? v + delta : v)));
    else setRestSecondsArr((arr) => arr.map((v, i) => (i === bucket.idx ? v + delta : v)));
  }

  /** Fecha o acumulador atual e liga outro (ex.: ao trocar de exercício, ou ao tocar "Iniciar"). */
  function switchBucket(next: { idx: number; kind: 'active' | 'rest' }) {
    const t = wallClock();
    flushBucket(t);
    setBucket(next);
    setBucketSince(paused ? null : t);
  }

  /** `kind`/`i` com o trecho do bucket atual já somado, sem esperar o próximo render. */
  function liveSeconds(base: number[], kind: 'active' | 'rest', i: number, t: number): number {
    const live = bucket.kind === kind && bucket.idx === i && bucketSince != null ? Math.max(0, t - bucketSince) / 1000 : 0;
    return base[i] + live;
  }
  function currentActiveSeconds(t = wallClock()) {
    return activeSeconds.map((_, i) => liveSeconds(activeSeconds, 'active', i, t));
  }
  function currentRestSeconds(t = wallClock()) {
    return restSecondsArr.map((_, i) => liveSeconds(restSecondsArr, 'rest', i, t));
  }

  function startRest(seconds: number) {
    if (paused) setRestFrozen(seconds);
    else setRestUntil(wallClock() + seconds * 1000);
  }

  function skipRest() {
    setRestUntil(null);
    setRestFrozen(0);
  }

  function togglePause() {
    const t = wallClock();
    if (!paused) {
      setClock((c) => ({ base: c.base + (c.since != null ? Math.max(0, t - c.since) / 1000 : 0), since: null }));
      setRestFrozen(restUntil != null ? Math.max(0, Math.ceil((restUntil - t) / 1000)) : 0);
      setRestUntil(null);
      flushBucket(t);
      setBucketSince(null);
    } else {
      setClock((c) => ({ base: c.base, since: t }));
      if (restFrozen > 0) setRestUntil(t + restFrozen * 1000);
      setRestFrozen(0);
      setBucketSince(t);
    }
    setNow(t);
    setPaused(!paused);
  }

  useEffect(() => {
    if (!resting && started[idx] && bucket.kind === 'rest' && bucket.idx === idx) {
      // Sincroniza o bucket com o fim do descanso entre séries (relógio fora do React); não dá pra derivar no render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      switchBucket({ idx, kind: 'active' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting, idx, started]);

  useEffect(() => () => {
    void Speech.stop();
  }, []);

  function say(text: string) {
    show(text, 'info', 'volume-high-outline');
    if (voice) Speech.speak(text, { language: locale() });
  }

  function completeSet() {
    const next = logs.map((l, i) => (i === idx ? [...l, { kg, reps }] : l));
    setLogs(next);
    say(i18n.t('fitness:session.saySet', { kg: formatKg(kg), reps }));
    const doneCount = next[idx].length;
    if (doneCount < row.sets.length) {
      // Próxima série já vem com a carga/repetições prescritas (drop set muda a cada estágio).
      const upcoming = row.sets[doneCount];
      setKg(upcoming.kg);
      setReps(upcoming.reps);
      const restAfter = row.sets[doneCount - 1]?.rest ?? row.restSeconds;
      if (restAfter > 0) {
        startRest(restAfter);
        setRestTotal(restAfter);
        switchBucket({ idx, kind: 'rest' }); // descanso entre séries conta como restSeconds[idx], não activeSeconds[idx]
      }
      return;
    }
    // Exercício fechado: acha o próximo não concluído (pode já não ser idx + 1 — ver nextOpenIndex).
    const nextIdx = nextOpenIndex(rows, next, idx);
    if (nextIdx === -1) return; // último: fica com exDone=true pro idx atual, tela de resumo cuida do resto (Task 5)
    const volume = next[idx].reduce((n, s) => n + s.kg * s.reps, 0);
    const tr = transitionRest(row);
    setJustFinished({ name: row.name, volume, restKind: tr.kind });
    setExplicitGateOpen(false);
    setIdx(nextIdx);
    setStarted((arr) => arr.map((v, i) => (i === nextIdx ? false : v)));
    switchBucket({ idx: nextIdx, kind: 'rest' });
    if (tr.kind === 'ring') {
      startRest(tr.seconds);
      setRestTotal(tr.seconds);
    } else {
      skipRest();
    }
    const p = nextPrescription(rows[nextIdx], next[nextIdx]?.length ?? 0);
    setKg(p.kg);
    setReps(p.reps);
  }

  function tapStartExercise() {
    setStarted((arr) => arr.map((v, i) => (i === idx ? true : v)));
    setJustFinished(null);
    setExplicitGateOpen(false);
    switchBucket({ idx, kind: 'active' });
    skipRest();
  }

  function finishAndGoTo(targetIdx: number) {
    setPreviewIdx(null);
    if (targetIdx === idx) return;
    setJustFinished(null);
    setExplicitGateOpen(false);
    setIdx(targetIdx);
    setStarted((arr) => arr.map((v, i) => (i === targetIdx ? false : v)));
    switchBucket({ idx: targetIdx, kind: 'rest' });
    skipRest();
    const p = nextPrescription(rows[targetIdx], logs[targetIdx]?.length ?? 0);
    setKg(p.kg);
    setReps(p.reps);
  }

  function finish() {
    const t = wallClock();
    // O rascunho só é apagado depois que o resultado for salvo (na tela de conclusão).
    setFinishedSession({
      workoutId: workout.id,
      idx,
      logs,
      elapsed: elapsedAt(t),
      started,
      activeSeconds: currentActiveSeconds(t),
      restSeconds: currentRestSeconds(t),
      finishedAt: new Date().toISOString(),
      resultKey: newIdempotencyKey(),
    });
    Speech.stop();
    router.replace('/cliente/treino/concluido');
  }

  const nextIdx = nextOpenIndex(rows, logs, idx);
  const hasNext = nextIdx !== -1;
  const primary = isGated
    ? { label: i18n.t('fitness:session.startEx'), onPress: tapStartExercise }
    : resting
      ? { label: i18n.t('fitness:rest.skipA11y'), onPress: skipRest }
      : exDone
        ? { label: i18n.t('fitness:session.finish'), onPress: finish }
        : { label: i18n.t('fitness:session.completeSet', { n: done.length + 1 }), onPress: completeSet };

  const volume = done.reduce((n, s) => n + s.kg * s.reps, 0);

  return (
    <Screen backdrop="default">
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <IconButton icon="close" accessibilityLabel={i18n.t('fitness:session.exitA11y')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Muted style={{ fontSize: 12.5 }}>{workout.title}</Muted>
          <Num size="md" style={{ marginTop: 2 }} accessibilityLabel={i18n.t('fitness:session.timeA11y', { time: formatClock(elapsed) })}>{formatClock(elapsed)}</Num>
        </View>
        <PressableScale
          onPress={() => setVoice((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: voice }}
          accessibilityLabel={i18n.t('fitness:session.voice')}
          scaleTo={0.9}
          style={[styles.voice, { backgroundColor: voice ? colors.primaryTint : '#fff' }]}
        >
          <Ionicons name={voice ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={voice ? colors.primary : colors.textMuted} />
        </PressableScale>
      </View>
      <View style={[styles.stateBadge, inGate ? styles.stateBadgeReady : inExTransition ? styles.stateBadgeResting : exDone ? styles.stateBadgeDone : resting ? styles.stateBadgeResting : styles.stateBadgeTraining]}>
        <Text style={[styles.stateBadgeText, !inGate && !inExTransition && exDone && { color: '#fff' }]}>
          {inGate ? i18n.t('fitness:session.badgeReady') : inExTransition ? i18n.t('fitness:session.badgeChanging') : exDone ? i18n.t('fitness:session.exDone') : resting ? i18n.t('fitness:session.badgeResting') : i18n.t('fitness:session.badgeTraining')}
        </Text>
      </View>

      <View style={styles.segments}>
        {rows.map((r, i) => {
          const frac = i < idx ? 1 : i === idx ? Math.min(1, done.length / r.sets.length) : (logs[i]?.length ?? 0) >= r.sets.length ? 1 : 0;
          return (
            <Pressable
              key={r.key}
              onPress={() => (i === idx ? undefined : setPreviewIdx(i))}
              hitSlop={{ top: 10, bottom: 10 }}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('fitness:session.goToEx', { n: i + 1, name: r.name })}
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
          {i18n.t('fitness:session.exercise') + ' '}
          <Text style={styles.navCountStrong}>{idx + 1}</Text>
          {i18n.t('fitness:session.ofTotal', { total: rows.length })}
        </Text>
        <PressableScale onPress={() => setListOpen(true)} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:session.seeAllA11y')} style={styles.navList}>
          <Ionicons name="list" size={16} color={colors.primary} />
          <Text style={styles.navListText}>{i18n.t('fitness:session.seeWorkout')}</Text>
        </PressableScale>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
        {previewIdx != null ? (
          <PreviewPanel
            row={rows[previewIdx]}
            status={exerciseStatus(rows[previewIdx], logs[previewIdx] ?? [], false)}
            doneCount={logs[previewIdx]?.length ?? 0}
            onFinish={() => finishAndGoTo(previewIdx)}
            onBack={() => setPreviewIdx(null)}
          />
        ) : (
          <>
        <View style={styles.exHead}>
          <PressableScale
            onPress={() => router.push(`/cliente/exercicio/${exId}?treino=${workout.id}`)}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('fitness:session.howToA11y', { name: exName })}
          >
            <LinearGradient colors={gradients.media} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
              <View style={styles.thumbPlay}>
                <Ionicons name="play" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
              </View>
            </LinearGradient>
          </PressableScale>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{exName}</Text>
            <Text style={styles.prescription} numberOfLines={2}>
              {[exName !== row.name && row.tag ? `${row.tag}: ${row.name}` : null, exSnap?.muscle_group, row.prescription, row.blockKind === 'dropset' ? row.loadLabel : null].filter(Boolean).join(' · ')}
            </Text>
            <Pressable onPress={() => router.push(`/cliente/exercicio/${exId}?treino=${workout.id}`)} hitSlop={8} accessibilityRole="link">
              <Text style={styles.howTo}>{exSnap?.media.length ? i18n.t('fitness:session.coachVideo') : i18n.t('fitness:session.howTo')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.pills}>
          {row.sets.map((_, i) => {
            const log = done[i];
            const current = i === done.length && !resting;
            return (
              <View key={i} style={[styles.pill, log ? styles.pillDone : current ? styles.pillNow : styles.pillNext]}>
                <Text style={[styles.pillTitle, { color: log ? colors.primaryDeep : colors.textMuted }]}>{i18n.t('fitness:session.setN', { n: i + 1 })}</Text>
                <Text style={[styles.pillValue, { color: log ? colors.primaryDeep : current ? colors.text : colors.textMuted }]}>{log ? `${formatKg(log.kg)} × ${log.reps}` : current ? i18n.t('fitness:session.now') : '—'}</Text>
              </View>
            );
          })}
        </View>

        {inGate ? (
          <View style={styles.restCard}>
            {justFinished?.restKind === 'stopwatch' ? (
              <View style={styles.stopwatch}>
                <Num size="xl">{bucketElapsed}</Num>
                <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.seconds')}</Muted>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              {justFinished ? <Text style={styles.prevDone}>{i18n.t('fitness:session.prevDone', { name: justFinished.name })}</Text> : null}
              <Text style={styles.restTitle}>{i18n.t('fitness:session.badgeReady')}</Text>
              <Muted style={{ marginTop: 4, lineHeight: 19 }}>{i18n.t('fitness:session.readyHint')}</Muted>
            </View>
          </View>
        ) : inExTransition ? (
          <View style={styles.restCard}>
            <ProgressRing size={132} stroke={10} progress={rest / restTotal} accessibilityLabel={i18n.t('fitness:session.restA11y', { count: rest })}>
              <Num size="xl">{rest}</Num>
              <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.seconds')}</Muted>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={styles.prevDone}>{i18n.t('fitness:session.prevDone', { name: justFinished?.name })}</Text>
              <Muted style={{ marginTop: 4, lineHeight: 19 }}>{i18n.t('fitness:session.nextEx', { name: row.name })}</Muted>
              <PressableScale onPress={() => { setExplicitGateOpen(true); skipRest(); }} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:rest.skipA11y')} style={styles.more}>
                <Text style={styles.moreText}>{i18n.t('fitness:rest.skip')}</Text>
              </PressableScale>
            </View>
          </View>
        ) : exDone ? (
          <LinearGradient colors={['rgba(79,216,255,0.18)', 'rgba(30,78,216,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneCard}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.restTitle}>{i18n.t('fitness:session.exDone')}</Text>
              <Muted style={{ marginTop: 3, color: colors.textSoft }}>{i18n.t('fitness:session.volume', { kg: volume.toLocaleString(locale()) })}</Muted>
            </View>
          </LinearGradient>
        ) : resting ? (
          <View style={styles.restCard}>
            <ProgressRing size={132} stroke={10} progress={rest / restTotal} accessibilityLabel={i18n.t('fitness:session.restA11y', { count: rest })}>
              <Num size="xl">{rest}</Num>
              <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.seconds')}</Muted>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={styles.restTitle}>{i18n.t('fitness:rest.title')}</Text>
              <Muted style={{ marginTop: 4, lineHeight: 19 }}>{i18n.t('fitness:session.upNext', { n: done.length + 1, kg: formatKg(kg), reps })}</Muted>
              <PressableScale onPress={() => { startRest(rest + 15); setRestTotal((t) => Math.max(t, rest + 15)); }} accessibilityRole="button" accessibilityLabel={i18n.t('fitness:rest.plus15A11y')} style={styles.more}>
                <Text style={styles.moreText}>+15 s</Text>
              </PressableScale>
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Stepper label={i18n.t('fitness:session.load')} value={formatKg(kg)} unit="kg" onMinus={() => setKg((v) => stepLoad(v, step, -1))} onPlus={() => setKg((v) => stepLoad(v, step, 1))} />
              <Stepper label={i18n.t('fitness:log.reps')} value={String(reps)} onMinus={() => setReps((v) => Math.max(1, v - 1))} onPlus={() => setReps((v) => v + 1)} />
            </View>
            {LOAD_HISTORY[exId] ? (
              <View style={styles.lastCard}>
                <View style={{ flex: 1 }}>
                  <Muted style={{ fontSize: 12 }}>{i18n.t('fitness:session.lastTime')}</Muted>
                  <Text style={styles.lastValue}>{`${formatKg(LOAD_HISTORY[exId].slice(-1)[0])} kg × ${row.reps}`}</Text>
                </View>
                <Spark values={LOAD_HISTORY[exId]} />
              </View>
            ) : null}
          </>
        )}

        {hasNext ? (
          <Pressable
            onPress={() => setPreviewIdx(nextIdx)}
            accessibilityRole="button"
            accessibilityLabel={`A seguir: ${rows[nextIdx].name}. Ir agora`}
            style={({ pressed }) => [styles.nextRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.nextLabel}>A seguir</Text>
            <Text style={styles.nextName} numberOfLines={1}>{rows[nextIdx].name}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        {previewIdx == null ? (
          <PressableScale onPress={primary.onPress} accessibilityRole="button" accessibilityLabel={primary.label} style={styles.primary}>
            <Text style={styles.primaryText} numberOfLines={1}>{primary.label}</Text>
          </PressableScale>
        ) : null}
        <ActionRow
          style={{ marginTop: previewIdx == null ? 10 : 0 }}
          items={[
            {
              icon: paused ? 'play' : 'pause',
              label: paused ? i18n.t('fitness:rec.continue') : i18n.t('fitness:rec.pause'),
              accessibilityLabel: paused ? i18n.t('fitness:session.resumeA11y') : i18n.t('fitness:session.pauseA11y'),
              tone: 'primary',
              active: paused,
              onPress: togglePause,
            },
            {
              icon: 'play-skip-forward',
              label: i18n.t('fitness:rest.skip'),
              accessibilityLabel: i18n.t('fitness:session.skipA11y'),
              disabled: !hasNext,
              onPress: () => finishAndGoTo(nextIdx),
            },
            { icon: 'flag', label: i18n.t('fitness:session.end'), accessibilityLabel: i18n.t('fitness:session.endA11y'), tone: 'danger', onPress: finish },
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
                if (i !== idx) setPreviewIdx(i);
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
                <Text style={styles.listMeta} numberOfLines={1}>{count > 0 && !isDone ? i18n.t('fitness:session.listMeta', { count, total: r.sets.length, rx: r.prescription }) : r.prescription}</Text>
              </View>
              {on ? <Text style={styles.listNow}>{i18n.t('fitness:session.now')}</Text> : null}
            </Pressable>
          );
        })}
      </BottomSheet>

      <Toast toast={toast} top={insets.top + 72} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateBadge: { marginHorizontal: 16, marginTop: 4, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  stateBadgeTraining: { backgroundColor: colors.primaryWash },
  stateBadgeResting: { backgroundColor: '#fff2e3' },
  stateBadgeDone: { backgroundColor: colors.success },
  stateBadgeReady: { backgroundColor: '#f0f1f4' },
  stateBadgeText: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, letterSpacing: 0.3, color: colors.text },
  stopwatch: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadows.card },
  prevDone: { ...text.captionStrong, color: colors.textMuted },
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
  stepper: { flex: 1, padding: 12, borderRadius: radii.lg + 2, backgroundColor: glass(0.88), ...shadows.card },
  stepLabel: { textAlign: 'center', fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stepValue: { flex: 1, textAlign: 'center', marginHorizontal: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  lastCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.88)' },
  lastValue: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  restCard: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14, padding: 18, borderRadius: radii.xl, backgroundColor: glass(0.88), ...shadows.card },
  restTitle: { ...text.section, color: colors.text },
  more: { marginTop: 12, alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primaryWash, justifyContent: 'center' },
  moreText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.primary },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, padding: 18, borderRadius: radii.xl },
  doneIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: glass(0.78), borderTopLeftRadius: 28, borderTopRightRadius: 28, ...shadows.nav },
  primary: { height: 56, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, ...shadows.button },
  primaryText: { color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 16 },
});
