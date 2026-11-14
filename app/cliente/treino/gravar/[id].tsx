import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Muted, ProgressBar, Screen, TopBar } from '@/src/design-system/ui';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { partLabel, plannedMeters } from '@/src/features/fitness/parts';
import { enqueue, loadQueue, newIdempotencyKey, saveQueue } from '@/src/features/fitness/resultsQueue';
import { addPoint, averagePace, currentPace, decimateTrack, emptyRun, formatKm, formatPace, resumeAt, type RunState } from '@/src/features/fitness/runTracker';
import { useRecordResult } from '@/src/features/fitness/useFitness';
import type { FitnessWorkoutView } from '@/src/features/fitness/types';
import { formatClock, isoDate } from '@/src/shared/format';
import { reportError } from '@/src/shared/telemetry/errorReporter';

export default function GpsRecordScreen() {
  const { id, parte } = useLocalSearchParams<{ id: string; parte?: string }>();
  return <WorkoutGate id={id} title="Gravar com GPS">{(w) => <GpsRecord workout={w} partIndex={Number(parte ?? 0)} />}</WorkoutGate>;
}

type Phase = 'ready' | 'running' | 'paused' | 'saving' | 'saved' | 'queued';

function KeepAwake() {
  useKeepAwake();
  return null;
}

function GpsRecord({ workout, partIndex }: { workout: FitnessWorkoutView; partIndex: number }) {
  const insets = useSafeAreaInsets();
  const part = workout.parts[partIndex] ?? workout.parts[0];
  const sport = part.type === 'endurance' && part.sport === 'bike' ? 'bike' : 'run';
  const goal = plannedMeters(part);
  const record = useRecordResult();
  const key = useMemo(() => newIdempotencyKey(), []);
  const [phase, setPhase] = useState<Phase>('ready');
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [run, setRun] = useState<RunState>(emptyRun);
  const [elapsed, setElapsed] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const startedAt = useRef<number>(0);
  const runningSince = useRef<number | null>(null);
  const banked = useRef(0);
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((p) => setPerm(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'denied'));
    return () => sub.current?.remove();
  }, []);

  // Cronômetro: tempo de relógio menos as pausas.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(Math.round((banked.current + (Date.now() - (runningSince.current ?? Date.now()))) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  async function ask(): Promise<boolean> {
    const p = await Location.requestForegroundPermissionsAsync();
    setPerm(p.granted ? 'granted' : 'denied');
    return p.granted;
  }

  async function watch() {
    sub.current?.remove();
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
      (loc) => {
        setGpsAccuracy(loc.coords.accuracy ?? null);
        setRun((s) =>
          addPoint(s, { at: loc.timestamp, lat: loc.coords.latitude, lng: loc.coords.longitude, altitude: loc.coords.altitude ?? null, accuracy: loc.coords.accuracy ?? null, speed: loc.coords.speed ?? null }, startedAt.current, sport),
        );
      },
    );
  }

  async function start() {
    if (perm !== 'granted' && !(await ask())) return;
    try {
      startedAt.current = Date.now();
      runningSince.current = Date.now();
      banked.current = 0;
      setRun(emptyRun());
      setElapsed(0);
      await watch();
      setPhase('running');
    } catch (e) {
      void reportError(e, { context: 'gps iniciar' });
      setPerm('denied');
    }
  }

  function pause() {
    sub.current?.remove();
    sub.current = null;
    banked.current += Date.now() - (runningSince.current ?? Date.now());
    runningSince.current = null;
    setPhase('paused');
  }

  async function resume() {
    runningSince.current = Date.now();
    setRun((s) => resumeAt(s));
    await watch();
    setPhase('running');
  }

  async function finish() {
    sub.current?.remove();
    sub.current = null;
    if (phase === 'running') banked.current += Date.now() - (runningSince.current ?? Date.now());
    const seconds = Math.max(1, Math.round(banked.current / 1000));
    setPhase('saving');
    const track = decimateTrack(run.track);
    const body = {
      workout_id: workout.id,
      part_index: partIndex,
      executed_on: isoDate(new Date(startedAt.current)),
      data: { kind: 'endurance' as const, seconds, ...(run.distanceM >= 10 ? { distance_m: Math.round(run.distanceM) } : {}) },
      idempotency_key: key,
      recording: { started_at: new Date(startedAt.current).toISOString(), ...(track ? { track } : {}) },
    };
    try {
      await record.mutateAsync(body);
      setPhase('saved');
    } catch {
      await saveQueue(enqueue(await loadQueue(), body));
      setPhase('queued');
    }
  }

  const pace = currentPace(run);
  const avg = averagePace(run, elapsed);
  const kmh = elapsed > 0 ? (run.distanceM / elapsed) * 3.6 : 0;
  const weakGps = gpsAccuracy != null && gpsAccuracy > 25;

  if (phase === 'saved' || phase === 'queued') {
    return (
      <Screen>
        <TopBar safe title={partLabel(part)} onBack={() => router.replace('/(client)/fitness')} />
        <View style={[styles.done, { paddingBottom: insets.bottom + 24 }]}>
          <Ionicons name={phase === 'saved' ? 'trophy-outline' : 'cloud-offline-outline'} size={44} color={colors.primary} />
          <Text style={styles.doneTitle}>{phase === 'saved' ? `${formatKm(run.distanceM)} km em ${formatClock(elapsed)}` : 'Guardado no celular'}</Text>
          <Muted style={{ textAlign: 'center', lineHeight: 20 }}>{phase === 'saved' ? 'Salvo no seu histórico, com a trilha da gravação.' : 'Sem conexão agora. Vai sozinho quando a internet voltar.'}</Muted>
          <Button label="Voltar ao treino" onPress={() => router.replace('/(client)/fitness')} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {phase === 'running' ? <KeepAwake /> : null}
      <TopBar safe title={partLabel(part)} onBack={() => (phase === 'ready' ? router.back() : undefined)} />
      <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.workout} numberOfLines={1}>{workout.title}</Text>

        <View style={styles.hero}>
          <Text style={styles.big}>{formatKm(run.distanceM)}</Text>
          <Muted style={styles.unit}>quilômetros</Muted>
          {goal ? (
            <View style={{ alignSelf: 'stretch', marginTop: 14, gap: 6 }}>
              <ProgressBar progress={Math.min(1, run.distanceM / goal)} />
              <Muted style={{ textAlign: 'center' }}>{`Meta: ${formatKm(goal)} km`}</Muted>
            </View>
          ) : null}
        </View>

        <View style={styles.grid}>
          <Metric label="Tempo" value={formatClock(elapsed)} />
          {sport === 'run' ? <Metric label="Ritmo atual" value={formatPace(pace)} suffix="/km" /> : <Metric label="Velocidade" value={kmh.toFixed(1).replace('.', ',')} suffix="km/h" />}
          {sport === 'run' ? <Metric label="Ritmo médio" value={formatPace(avg)} suffix="/km" /> : <Metric label="Vel. máxima" value={(run.maxSpeedMs * 3.6).toFixed(1).replace('.', ',')} suffix="km/h" />}
          <Metric label="Altitude" value={run.altitudeM != null ? String(Math.round(run.altitudeM)) : '–'} suffix="m" />
          <Metric label="Subida" value={String(Math.round(run.elevationGainM))} suffix="m" />
          <Metric label="GPS" value={gpsAccuracy != null ? `±${Math.round(gpsAccuracy)}` : '–'} suffix="m" warn={weakGps} />
        </View>

        {perm === 'denied' ? (
          <View style={styles.perm}>
            <Body style={{ flex: 1, fontSize: 13.5 }}>Para gravar a distância, o Operax precisa da sua localização durante o treino.</Body>
            <Button label="Ajustes" variant="soft" compact onPress={() => void Linking.openSettings()} />
          </View>
        ) : weakGps && phase === 'running' ? (
          <Muted style={styles.hint}>Sinal de GPS fraco. Em lugar aberto a distância fica mais certa.</Muted>
        ) : null}

        <View style={{ marginTop: 'auto', gap: 10 }}>
          {phase === 'ready' ? <Button label={sport === 'bike' ? 'Começar a pedalar' : 'Começar a correr'} icon="play" onPress={() => void start()} /> : null}
          {phase === 'running' ? <Button label="Pausar" icon="pause" variant="secondary" onPress={pause} /> : null}
          {phase === 'paused' ? <Button label="Continuar" icon="play" onPress={() => void resume()} /> : null}
          {phase === 'running' || phase === 'paused' || phase === 'saving' ? (
            <Button label="Terminar e salvar" icon="stop" variant="danger" loading={phase === 'saving'} onPress={() => void finish()} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function Metric({ label, value, suffix, warn }: { label: string; value: string; suffix?: string; warn?: boolean }) {
  return (
    <View style={styles.metric}>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
      <Text style={[styles.metricValue, warn && { color: colors.warn }]}>
        {value}
        {suffix ? <Text style={styles.suffix}>{` ${suffix}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  workout: { ...text.section, color: colors.textSoft, textAlign: 'center' },
  hero: { alignItems: 'center', marginTop: 18, padding: 22, borderRadius: radii.xl, backgroundColor: '#fff', ...shadows.card },
  big: { fontFamily: typography.fontFamilyBold, fontSize: 64, lineHeight: 70, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { marginTop: -2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metric: { width: '31.5%', flexGrow: 1, padding: 12, borderRadius: radii.lg, backgroundColor: '#fff', ...shadows.card },
  metricValue: { marginTop: 4, ...numbers.sm, color: colors.text, fontVariant: ['tabular-nums'] },
  suffix: { fontSize: 12, color: colors.textMuted },
  perm: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderRadius: radii.md, backgroundColor: colors.warnSoft },
  hint: { marginTop: 12, textAlign: 'center' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  doneTitle: { ...text.title, color: colors.text, textAlign: 'center' },
});
