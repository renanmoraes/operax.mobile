import { Stack } from 'expo-router';
import { isRejected } from './resultsQueue';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import i18n, { locale } from '@/src/i18n';
import { Button, Field, Muted, PressableScale, ProgressBar, Screen, TopBar } from '@/src/design-system/ui';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { formatClock } from '@/src/shared/format';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { reportError, trackAction } from '@/src/shared/telemetry/errorReporter';
import { RouteMap } from './RouteMap';
import { addPoint, averagePace, currentPace, decimateTrack, defaultTitle, emptyRun, formatKm, formatPace, haversine, kmSplits, resumeAt, type RunState, type Track } from './runTracker';
import { kmCue, stepCue, stepProgress, type GuideStep } from './coach';
import { StepGuideCard } from './recorder/StepGuideCard';
import { RestTimer } from './recorder/RestTimer';
import { ownedKey } from './owner';
import { FEELINGS, SPORTS, WORKOUT_TAGS, effortWord, type SportInfo } from './sports';
import type { FitnessFeeling, FreeSport } from './types';

/** O que a gravação entrega para salvar: os números, a trilha e o "como foi". */
export type RecorderSave = {
  startedAt: number;
  seconds: number;
  distanceM: number;
  elevationGainM: number;
  track?: Track;
  title?: string;
  feeling?: FitnessFeeling;
  effort?: number;
  notes?: string;
  /** Tipo do treino (regenerativo, longão, força…), para o professor. */
  tag?: string;
  /** Musculação: séries marcadas no descanso. */
  sets?: number;
};

type Phase = 'ready' | 'running' | 'paused' | 'review' | 'saving' | 'saved' | 'queued';
type Prefs = { keepAwake: boolean; showMap: boolean; speed: boolean; voice: boolean; autoPause: boolean };
/** Parado por mais que isto com pausa automática ligada: pausa sozinho (semáforo, água). */
const AUTO_PAUSE_MS = 12_000;
const PREFS_KEY = 'fitness_recorder_prefs';

/**
 * Rascunho da gravação no banco do aparelho: se o Android fechar o app no meio do treino (pouca memória,
 * bateria) ou o app travar, a pessoa reabre e retoma de onde parou, em vez de perder a corrida.
 */
const DRAFT_BASE = 'fitness_recording_draft';
/** Por conta (ver owner.ts): o rascunho de um aluno não aparece para outro no mesmo celular. */
const draftStoreKey = () => ownedKey(DRAFT_BASE);
const DRAFT_MAX_AGE_MS = 6 * 3600_000;
/** `guide`: etapa do treino do professor e de onde ela começou; `sets`: séries marcadas na musculação. */
type Draft = { key: string; startedAt: number; banked: number; savedAt: number; run: Omit<RunState, 'last' | 'recent'>; guide?: { i: number; s0: number; m0: number }; sets?: number };

const run0 = () => emptyRun();
/** Número com 1 casa no formato do idioma ("12,5" / "12.5"). */
const num1 = (n: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * Gravação do treino no padrão dos apps de corrida: mapa com o caminho e a posição, cronômetro grande,
 * ritmo, distância e parciais por quilômetro; pausa com Continuar ou Fim; no fim, a tela de salvar
 * pergunta como foi. Serve ao treino da ficha e ao treino livre: quem chama decide para onde vai.
 */
export function Recorder({
  sport,
  heading,
  subtitle,
  goalMeters,
  askTitle,
  onSave,
  onClose,
  onHistory,
  draftKey,
  guide,
  onPickSport,
  askTag,
}: {
  sport: SportInfo;
  /** Etapas do treino do professor (ficha): a gravação conduz uma a uma e avisa a troca. */
  guide?: GuideStep[];
  /** Treino livre: trocar o esporte na tela de largada. */
  onPickSport?: (id: FreeSport) => void;
  /** Pergunta o tipo do treino ao salvar (treino livre). */
  askTag?: boolean;
  /** Identifica o treino do rascunho (ex.: `livre:run`, `ficha:<id>:<parte>`): só retoma o rascunho do mesmo treino. */
  draftKey: string;
  heading: string;
  subtitle?: string;
  goalMeters?: number | null;
  /** Treino livre pede um título; o da ficha já tem nome. */
  askTitle: boolean;
  onSave: (r: RecorderSave) => Promise<'saved' | 'queued'>;
  onClose: () => void;
  onHistory: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const go = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>(sport.gps ? 'unknown' : 'granted');
  const [run, setRun] = useState<RunState>(emptyRun);
  const [elapsed, setElapsed] = useState(0);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  // Pausa automática começa ligada na bike (semáforo); na corrida, desligada (parar para respirar também é treino).
  const [prefs, setPrefs] = useState<Prefs>({ keepAwake: true, showMap: true, speed: sport.rate === 'speed', voice: true, autoPause: sport.id === 'bike' });
  const prefsRef = useRef(prefs);
  const [view, setView] = useState<'map' | 'numbers'>('map');
  const [autoPaused, setAutoPaused] = useState(false);
  const autoPausedRef = useRef(false);
  const lastMoveAt = useRef(0);
  const prevLoc = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const runRef = useRef(run0());
  const [guideAt, setGuideAt] = useState({ i: 0, s0: 0, m0: 0 });
  const guideRef = useRef(guideAt);
  const [tag, setTag] = useState<string | undefined>();
  const [sets, setSets] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pauseRef = useRef<(auto?: boolean) => void>(() => undefined);
  const resumeRef = useRef<(auto?: boolean) => void>(() => undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [title, setTitle] = useState('');
  const [feeling, setFeeling] = useState<FitnessFeeling | undefined>();
  const [effort, setEffort] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const startedAt = useRef(0);
  const [startMs, setStartMs] = useState(0);
  const runningSince = useRef<number | null>(null);
  const banked = useRef(0);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const lastDraftAt = useRef(0);

  useEffect(() => {
    const k = draftStoreKey();
    if (!k) return;
    void kvGet<Draft>(k).then((d) => {
      if (d && d.key === draftKey && Date.now() - d.savedAt < DRAFT_MAX_AGE_MS && d.banked >= 5000) setDraft(d);
    });
  }, [draftKey]);

  const dropDraft = () => {
    const k = draftStoreKey();
    if (k) void kvSet(k, null);
  };
  const clearDraft = () => {
    setDraft(null);
    dropDraft();
  };

  // Grava o rascunho a cada ~10 s gravando (pelo cronômetro: musculação não tem GPS mudando nada) e sempre que muda de fase.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused' && phase !== 'review') return;
    const now = Date.now();
    if (phase === 'running' && now - lastDraftAt.current < 10_000) return;
    const k = draftStoreKey();
    if (!k) return;
    lastDraftAt.current = now;
    const bankedNow = banked.current + (runningSince.current ? now - runningSince.current : 0);
    const { last: _l, recent: _r, ...keep } = run;
    void kvSet(k, { key: draftKey, startedAt: startedAt.current, banked: bankedNow, savedAt: now, run: keep, guide: guideRef.current, sets } satisfies Draft);
  }, [run, phase, draftKey, elapsed, sets]);

  function restore(d: Draft) {
    startedAt.current = d.startedAt;
    setStartMs(d.startedAt);
    banked.current = d.banked;
    runningSince.current = null;
    setElapsed(Math.round(d.banked / 1000));
    setRun({ ...emptyRun(), ...d.run, last: null, recent: [] });
    // Retoma na etapa em que estava (senão a primeira etapa seria medida contra o treino inteiro e repetiria as etapas feitas).
    const g = d.guide ?? { i: 0, s0: 0, m0: 0 };
    guideRef.current = g;
    setGuideAt(g);
    setSets(d.sets ?? 0);
    setDraft(null);
    trackAction('treino retomado do rascunho', { sport: sport.id });
    go('paused');
  }

  useEffect(() => {
    void kvGet<Partial<Prefs>>(PREFS_KEY).then((p) => {
      if (!p) return;
      setPrefs((cur) => ({ ...cur, ...p }));
      if (p.showMap === false) setView('numbers');
    });
  }, []);
  const changePref = (k: keyof Prefs, v: boolean) =>
    setPrefs((cur) => {
      const next = { ...cur, [k]: v };
      void kvSet(PREFS_KEY, next);
      return next;
    });

  useEffect(() => {
    prefsRef.current = prefs;
    runRef.current = run;
    guideRef.current = guideAt;
  });

  /** Avisos de voz (km, etapa, pausa): dá para treinar sem olhar o celular. */
  const say = useCallback((t: string) => {
    if (!prefsRef.current.voice) return;
    try {
      Speech.speak(t, { language: locale(), rate: 1.02 });
    } catch {
      // sem voz no aparelho
    }
  }, []);

  // GPS ligado desde a tela de largada: o sinal já está pronto quando a pessoa toca em Iniciar.
  const watch = useCallback(async () => {
    if (sub.current) return;
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 }, (loc) => {
      setAccuracy(loc.coords.accuracy ?? null);
      setHere({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      // Velocidade pelo deslocamento entre leituras: o GPS do celular nem sempre informa.
      const prev = prevLoc.current;
      const cur = { lat: loc.coords.latitude, lng: loc.coords.longitude, at: loc.timestamp };
      prevLoc.current = cur;
      const ms = prev && cur.at > prev.at ? haversine(prev, cur) / ((cur.at - prev.at) / 1000) : 0;
      if (ms > 0.9 && (loc.coords.accuracy ?? 0) <= 25) lastMoveAt.current = Date.now();
      if (phaseRef.current === 'paused' && autoPausedRef.current && ms > 1.4) resumeRef.current(true);
      if (phaseRef.current !== 'running') return;
      setRun((s) =>
        addPoint(s, { at: loc.timestamp, lat: loc.coords.latitude, lng: loc.coords.longitude, altitude: loc.coords.altitude ?? null, accuracy: loc.coords.accuracy ?? null, speed: loc.coords.speed ?? null }, startedAt.current, sport.tracker),
      );
    });
  }, [sport.tracker]);
  const stopWatch = () => {
    sub.current?.remove();
    sub.current = null;
  };

  useEffect(() => {
    if (!sport.gps) return;
    void Location.getForegroundPermissionsAsync().then((p) => {
      setPerm(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'denied');
      if (p.granted) void watch().catch((e) => void reportError(e, { context: 'gps preparar' }));
    });
    return stopWatch;
  }, [sport.gps, watch]);

  // Cronômetro: tempo de relógio menos as pausas.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      const now = Date.now();
      const secs = Math.round((banked.current + (now - (runningSince.current ?? now))) / 1000);
      setElapsed(secs);
      // Parado com pausa automática ligada: pausa sozinho e volta quando a pessoa anda.
      if (sport.gps && prefsRef.current.autoPause && now - lastMoveAt.current > AUTO_PAUSE_MS) pauseRef.current(true);
      // Treino do professor: etapa cumprida (tempo ou distância) passa para a próxima e avisa.
      const g = guideRef.current;
      if (guide && g.i < guide.length && stepProgress(guide[g.i], secs - g.s0, runRef.current.distanceM - g.m0).done) advanceGuide(secs, runRef.current.distanceM);
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intervalo lê o estado vivo por refs
  }, [phase]);

  function advanceGuide(secs: number, meters: number) {
    if (!guide) return;
    const i = guideRef.current.i + 1;
    const next = { i, s0: secs, m0: meters };
    guideRef.current = next;
    setGuideAt(next);
    Vibration.vibrate(200);
    say(i < guide.length ? stepCue(guide[i]) : i18n.t('fitness:rec.guideDone'));
  }

  // Aviso a cada quilômetro (bike: a cada 5 km).
  const kmCount = run.kmMarks.length;
  useEffect(() => {
    if (!kmCount || phaseRef.current !== 'running') return;
    const r0 = runRef.current;
    if (sport.rate === 'speed') {
      if (kmCount % 5 === 0) say(kmCue(kmCount, 0, null, r0.movingMs ? (r0.distanceM / (r0.movingMs / 1000)) * 3.6 : 0));
      return;
    }
    const sp = kmSplits(r0).filter((x) => !x.partial);
    const last = sp[sp.length - 1];
    if (last) say(kmCue(kmCount, last.seconds, r0.movingMs ? (r0.movingMs / 1000 / r0.distanceM) * 1000 : null));
  }, [kmCount, say, sport.rate]);

  const discard = useCallback(() => {
    void confirmDialog({ title: t('rec.discardTitle'), message: t('rec.discardBody'), confirmLabel: t('rec.discard'), cancelLabel: t('rec.keepTraining'), tone: 'danger' }).then((ok) => {
      if (!ok) return;
      stopWatch();
      dropDraft();
      onClose();
    });
  }, [onClose, t]);

  // Voltar do Android no meio do treino não sai sem querer.
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      const p = phaseRef.current;
      if (locked) return true;
      if (p === 'running' || p === 'paused' || p === 'review') {
        if (p === 'review') go('paused');
        else discard();
        return true;
      }
      return false;
    });
    return () => h.remove();
  }, [discard, go, locked]);

  async function start() {
    if (sport.gps && perm !== 'granted') {
      const p = await Location.requestForegroundPermissionsAsync();
      setPerm(p.granted ? 'granted' : 'denied');
      if (!p.granted) return;
    }
    try {
      if (sport.gps) await watch();
    } catch (e) {
      void reportError(e, { context: 'gps iniciar' });
    }
    clearDraft();
    startedAt.current = Date.now();
    setStartMs(startedAt.current);
    runningSince.current = Date.now();
    banked.current = 0;
    setRun(emptyRun());
    setElapsed(0);
    trackAction('treino iniciado', { sport: sport.id });
    lastMoveAt.current = Date.now();
    const g0 = { i: 0, s0: 0, m0: 0 };
    guideRef.current = g0;
    setGuideAt(g0);
    setSets(0);
    go('running');
    say(guide?.length ? `${t('rec.say.started')} ${stepCue(guide[0])}` : t('rec.say.started'));
  }

  function pause(auto = false) {
    if (phaseRef.current !== 'running') return;
    banked.current += Date.now() - (runningSince.current ?? Date.now());
    // Pausa automática: o tempo parado até ela disparar não é treino (tempo em movimento, como nos relógios).
    if (auto) banked.current = Math.max(0, banked.current - Math.min(AUTO_PAUSE_MS, Date.now() - lastMoveAt.current));
    runningSince.current = null;
    setElapsed(Math.round(banked.current / 1000));
    autoPausedRef.current = auto;
    setAutoPaused(auto);
    go('paused');
    say(auto ? t('rec.say.autoPaused') : t('rec.say.paused'));
  }

  function resume(auto = false) {
    if (phaseRef.current !== 'paused') return;
    autoPausedRef.current = false;
    setAutoPaused(false);
    lastMoveAt.current = Date.now();
    if (!auto) say(t('rec.say.resumed'));
    else say(t('rec.say.resuming'));
    // Voltou da tela de salvar depois de uma falha: o GPS foi desligado ao tentar salvar.
    if (sport.gps) void watch().catch((e) => void reportError(e, { context: 'gps continuar' }));
    runningSince.current = Date.now();
    setRun((s) => resumeAt(s));
    go('running');
  }
  useEffect(() => {
    pauseRef.current = pause;
    resumeRef.current = resume;
  });

  function finish() {
    if (phaseRef.current === 'running') pause();
    autoPausedRef.current = false;
    setAutoPaused(false);
    if (askTitle && !title) setTitle(defaultTitle(sport.label, new Date(startedAt.current)));
    go('review');
  }

  async function save() {
    go('saving');
    stopWatch();
    const seconds = Math.max(1, Math.round(banked.current / 1000));
    try {
      const out = await onSave({
        startedAt: startedAt.current,
        seconds,
        distanceM: run.distanceM,
        elevationGainM: run.elevationGainM,
        track: sport.gps ? decimateTrack(run.track) : undefined,
        title: askTitle ? title.trim() || defaultTitle(sport.label, new Date(startedAt.current)) : undefined,
        feeling,
        effort,
        notes: notes.trim() || undefined,
        tag,
        sets: sport.gps ? undefined : sets || undefined,
      });
      dropDraft();
      go(out);
    } catch (e) {
      void reportError(e, { context: 'salvar treino gravado' });
      go('review');
      void showDialog(
        isRejected(e)
          ? { title: t('rec.saveFailTitle'), message: t('rec.rejectedBody'), tone: 'warn' }
          : { title: t('rec.saveFailTitle'), message: t('rec.saveFailBody'), tone: 'warn', icon: 'cloud-offline-outline' },
      );
    }
  }

  const avg = averagePace(run, elapsed);
  const now = phase === 'running' ? currentPace(run) : null;
  const kmh = elapsed > 0 ? (run.distanceM / elapsed) * 3.6 : 0;
  const splits = useMemo(() => kmSplits(run), [run]);
  const route = useMemo(() => run.track.lat.map((la, i) => [la, run.track.lon[i]] as [number, number]), [run.track]);
  const weak = accuracy != null && accuracy > 25;
  const speed = prefs.speed || sport.rate === 'speed';

  if (phase === 'saved' || phase === 'queued') {
    return (
      <Screen>
        <View style={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
          <LinearGradient colors={[colors.cyan, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneBadge}>
            <MaterialCommunityIcons name={phase === 'saved' ? 'check-bold' : 'cloud-clock-outline'} size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.doneTitle}>{phase === 'saved' ? t('rec.saved') : t('rec.queued')}</Text>
          <Muted style={styles.doneSub}>
            {phase === 'saved' ? t(sport.gps ? 'rec.savedBodyGps' : 'rec.savedBody') : t('rec.queuedBody')}
          </Muted>
          <View style={styles.doneStats}>
            {sport.gps ? <DoneStat value={formatKm(run.distanceM)} unit="km" /> : null}
            <DoneStat value={formatClock(elapsed)} unit={t('rec.timeUnit')} />
            {sport.gps && sport.rate === 'pace' ? <DoneStat value={formatPace(averagePace(run, elapsed))} unit="/km" /> : null}
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 'auto' }}>
            {phase === 'saved' ? <Button label={t('rec.seeHistory')} icon="time-outline" onPress={onHistory} /> : null}
            <Button label={t('rec.finishDone')} variant={phase === 'saved' ? 'secondary' : 'primary'} onPress={onClose} />
          </View>
        </View>
      </Screen>
    );
  }

  if (phase === 'review' || phase === 'saving') {
    const seconds = elapsed;
    return (
      <Screen>
        <NoSwipeBack phase={phase} />
        <TopBar safe title={t('rec.saveWorkout')} onBack={() => go('paused')} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            {sport.gps && route.length > 1 ? <RouteMap route={route} style={styles.summaryMap} /> : null}
            <View style={styles.summaryRow}>
              {!sport.gps ? (
                <LinearGradient colors={['#e3ecff', '#ddf3ff']} style={styles.summaryTile}>
                  <MaterialCommunityIcons name={sport.icon} size={30} color={colors.primary} />
                </LinearGradient>
              ) : null}
              <SummaryCell label={sport.gps ? t('rec.time') : t('rec.sportTime', { sport: sport.label })} value={formatClock(seconds)} />
              {!sport.gps && sets ? <SummaryCell label={t('rec.sets')} value={String(sets)} /> : null}
              {sport.gps ? <SummaryCell label={t('rec.distance')} value={`${formatKm(run.distanceM)} km`} /> : null}
              {sport.gps ? <SummaryCell label={speed ? t('rec.speed') : t('rec.pace')} value={speed ? `${num1(seconds ? (run.distanceM / seconds) * 3.6 : 0)} km/h` : `${formatPace(averagePace(run, seconds))}/km`} /> : null}
              {sport.gps ? <SummaryCell label={t('rec.climb')} value={`${Math.round(run.elevationGainM)} m`} /> : null}
            </View>
          </View>

          {askTitle ? <Field label={t('rec.name')} value={title} onChangeText={(v) => setTitle(v.slice(0, 80))} placeholder={defaultTitle(sport.label, new Date(startMs))} /> : null}

          {askTag ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.ask}>{t('rec.type')}</Text>
              <View style={styles.tags}>
                {WORKOUT_TAGS[sport.gps || sport.id === 'swim' ? 'endurance' : 'gym'].map((t) => {
                  const on = tag === t.id;
                  return (
                    <Pressable key={t.id} onPress={() => setTag(on ? undefined : t.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.tag, on && styles.tagOn]}>
                      <Text style={[styles.tagText, on && { color: '#fff' }]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Text style={styles.ask}>{t('rec.howWasIt')}</Text>
            <View style={styles.feelings}>
              {FEELINGS.map((f) => {
                const on = feeling === f.id;
                return (
                  <PressableScale key={f.id} onPress={() => setFeeling(on ? undefined : f.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={f.label} style={[styles.feeling, on && styles.feelingOn]}>
                    <MaterialCommunityIcons name={f.icon} size={28} color={on ? '#fff' : colors.primary} />
                    <Text style={[styles.feelingText, on && { color: '#fff' }]} numberOfLines={2}>{f.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.ask}>{t('rec.effort')}</Text>
              <Muted>{effort ? `${effort} · ${effortWord(effort)}` : t('rec.effortScale')}</Muted>
            </View>
            <View style={styles.effort}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const on = effort != null && n <= effort;
                return (
                  <Pressable key={n} onPress={() => setEffort(effort === n ? undefined : n)} accessibilityRole="button" accessibilityLabel={t('rec.effortA11y', { n, word: effortWord(n) })} accessibilityState={{ selected: effort === n }} style={[styles.effortCell, { height: 22 + n * 2.6 }, on && { backgroundColor: n >= 9 ? colors.warn : colors.primary }]}>
                    <Text style={[styles.effortNum, on && { color: '#fff' }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label={t('rec.notes')} value={notes} onChangeText={(v) => setNotes(v.slice(0, 500))} placeholder={t('rec.notesHint')} multiline />

          <View style={{ gap: 10 }}>
            <Button label={t('rec.saveWorkout')} icon="checkmark" loading={phase === 'saving'} onPress={() => void save()} />
            <Button label={t('rec.keepRecording')} variant="ghost" disabled={phase === 'saving'} onPress={() => go('paused')} />
            <Pressable onPress={discard} disabled={phase === 'saving'} accessibilityRole="button" style={styles.discard}>
              <Text style={styles.discardText}>{t('rec.discard')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const active = phase === 'running' || phase === 'paused';
  const showMap = sport.gps && view === 'map';
  const paused = phase === 'paused';
  const guideCard = guide?.length && active ? (
    <StepGuideCard steps={guide} index={guideAt.i} doneSeconds={elapsed - guideAt.s0} doneMeters={run.distanceM - guideAt.m0} pace={now} onNext={() => advanceGuide(elapsed, run.distanceM)} compact={showMap} />
  ) : null;
  return (
    <Screen backdrop="none" style={{ backgroundColor: '#fff' }}>
      <NoSwipeBack phase={phase} />
      {active && prefs.keepAwake ? <KeepAwake /> : null}
      {showMap ? (
        <View style={styles.mapWrap}>
          <RouteMap route={route} here={here} follow style={StyleSheet.absoluteFill} inset={{ top: insets.top + 96, bottom: 30 }} />
          <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']} style={[styles.mapFade, { height: insets.top + 70 }]} pointerEvents="none" />
        </View>
      ) : sport.gps ? (
        // Vista dos números (sem mapa): faixa curta no topo, que vira laranja na pausa.
        <View style={[styles.numbersTop, { height: insets.top + 90 }, paused && styles.bandPaused]} />
      ) : (
        <LinearGradient colors={paused ? [colors.warn, '#ea580c'] : ['#e3ecff', '#f4f8ff']} style={[styles.noMap, { paddingTop: insets.top + 64 }]}>
          <MaterialCommunityIcons name={sport.icon} size={64} color={paused ? '#fff' : colors.primary} />
        </LinearGradient>
      )}

      {/* Pausado: faixa forte, visível de longe (no mapa, embaixo dos botões). */}
      {paused && showMap ? (
        <View style={[styles.pausedBand, { top: insets.top + 60 }]}>
          <Ionicons name="pause" size={15} color="#fff" />
          <Text style={styles.pausedBandText}>{autoPaused ? t('rec.autoPausedBand') : t('rec.pausedLabel')}</Text>
        </View>
      ) : null}

      <View style={[styles.topRow, { top: insets.top + 8 }]}>
        {phase === 'ready' ? (
          <RoundButton icon="close" onPress={onClose} label={t('common:actions.close')} />
        ) : sport.gps ? (
          <RoundButton icon={view === 'map' ? 'speedometer-outline' : 'map-outline'} onPress={() => setView(view === 'map' ? 'numbers' : 'map')} label={view === 'map' ? t('rec.viewNumbers') : t('rec.viewMap')} />
        ) : (
          <View style={{ width: 44 }} />
        )}
        <Pressable
          disabled={phase !== 'ready' || !onPickSport}
          onPress={() => setPickerOpen(true)}
          accessibilityRole={phase === 'ready' && onPickSport ? 'button' : undefined}
          accessibilityLabel={phase === 'ready' && onPickSport ? t('rec.switchSportA11y', { sport: heading }) : heading}
          style={styles.headingPill}
        >
          <MaterialCommunityIcons name={sport.icon} size={16} color={colors.primary} />
          <Text style={styles.headingText} numberOfLines={1}>{heading}</Text>
          {phase === 'ready' && onPickSport ? <Ionicons name="chevron-down" size={14} color={colors.textMuted} /> : null}
        </Pressable>
        <RoundButton icon="options-outline" onPress={() => setSettingsOpen(true)} label={t('rec.settings')} />
      </View>

      {sport.gps && !(paused && showMap) && (showMap || phase === 'ready') ? (
        <View style={[styles.gpsChip, { top: insets.top + 62 }, weak || !here ? styles.gpsWeak : null]}>
          <View style={[styles.gpsDot, { backgroundColor: !here ? colors.textMuted : weak ? colors.warn : colors.success }]} />
          <Text style={styles.gpsText}>{perm === 'denied' ? t('rec.noLocation') : !here ? t('rec.gpsSearching') : t(weak ? 'rec.gpsWeak' : 'rec.gpsReady', { m: Math.round(accuracy ?? 0) })}</Text>
        </View>
      ) : null}

      <View style={[styles.sheet, !showMap && { marginTop: -28 }]}>
        {paused && !showMap ? (
          <View style={styles.pausedBar}>
            <Ionicons name="pause" size={14} color="#fff" />
            <Text style={styles.pausedText}>{autoPaused ? t('rec.autoPausedLabel') : t('rec.pausedLabel')}</Text>
          </View>
        ) : (
          <View style={styles.handle} />
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>{t('rec.time')}</Text>
          <Text style={styles.clock} accessibilityLabel={t('rec.timeA11y', { time: formatClock(elapsed) })}>{formatClock(elapsed)}</Text>
          {subtitle ? <Muted style={styles.subtitle} numberOfLines={1}>{subtitle}</Muted> : null}

          {sport.gps && !showMap && phase !== 'ready' ? (
            <View style={styles.bigDistance}>
              <Text style={styles.bigDistanceValue} accessibilityLabel={t('rec.kmA11y', { km: formatKm(run.distanceM) })}>{formatKm(run.distanceM)}</Text>
              <Text style={styles.label}>{t('rec.distanceKm')}</Text>
            </View>
          ) : null}

          {sport.gps ? (
            <View style={styles.pair}>
              <View style={styles.pairCell}>
                <Text style={styles.label}>{speed ? (showMap || phase === 'ready' ? t('rec.speed') : t('rec.average')) : t('rec.avgPace')}</Text>
                <Text style={styles.pairValue}>{speed ? num1(kmh) : formatPace(avg)}<Text style={styles.pairUnit}>{speed ? ' km/h' : ' /km'}</Text></Text>
              </View>
              <View style={styles.pairDivider} />
              {showMap || phase === 'ready' ? (
                <View style={styles.pairCell}>
                  <Text style={styles.label}>{t('rec.distance')}</Text>
                  <Text style={styles.pairValue}>{formatKm(run.distanceM)}<Text style={styles.pairUnit}> km</Text></Text>
                </View>
              ) : (
                <View style={styles.pairCell}>
                  <Text style={styles.label}>{speed ? t('rec.now') : t('rec.currentPace')}</Text>
                  <Text style={styles.pairValue}>{speed ? num1(now ? 3600 / now : 0) : formatPace(now)}<Text style={styles.pairUnit}>{speed ? ' km/h' : ' /km'}</Text></Text>
                </View>
              )}
            </View>
          ) : null}

          {guideCard}

          {sport.gps && phase !== 'ready' ? (
            <View style={styles.minor}>
              {/* Nos números grandes o ritmo atual já está no par de cima: aqui fica a máxima (bike) ou nada. */}
              {showMap || speed ? <Minor label={speed ? t('rec.max') : t('rec.currentPace')} value={speed ? `${num1(run.maxSpeedMs * 3.6)} km/h` : `${formatPace(now)} /km`} /> : null}
              <Minor label={t('rec.climb')} value={`${Math.round(run.elevationGainM)} m`} />
              <Minor label={t('rec.altitude')} value={run.altitudeM != null ? `${Math.round(run.altitudeM)} m` : '–'} />
            </View>
          ) : null}

          {goalMeters && sport.gps ? (
            <View style={{ marginTop: 16, gap: 6 }}>
              <ProgressBar progress={Math.min(1, run.distanceM / goalMeters)} />
              <Muted style={{ fontSize: 12.5 }}>{t('rec.goal', { km: formatKm(goalMeters) })}</Muted>
            </View>
          ) : null}

          {sport.gps && splits.length ? <Splits splits={splits} speed={speed} /> : null}

          {perm === 'denied' ? (
            <View style={styles.perm}>
              <Text style={styles.permText}>{t('rec.locationNeeded')}</Text>
              <Button label={t('rec.settingsShort')} variant="soft" compact onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}
          {phase === 'ready' && draft ? (
            <View style={styles.draft}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.draftTitle}>{t('rec.unsaved')}</Text>
                  <Muted style={{ fontSize: 12.5 }}>
                    {[t('rec.startedAtTime', { time: new Date(draft.startedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) }), formatClock(Math.round(draft.banked / 1000)), sport.gps ? `${formatKm(draft.run.distanceM)} km` : null].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label={t('rec.resume')} compact icon="play" onPress={() => restore(draft)} style={{ flex: 1 }} />
                <Button label={t('rec.discardShort')} compact variant="secondary" onPress={clearDraft} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
          {!sport.gps && phase !== 'ready' ? (
            <View style={styles.timerInfo}>
              <Minor label={t('rec.startedAt')} value={new Date(startMs).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })} />
              <Minor label={t('rec.status')} value={phase === 'paused' ? t('rec.pausedLabel') : t('rec.recording')} />
            </View>
          ) : null}
          {!sport.gps && active && (sport.id === 'strength' || sport.id === 'other') ? <RestTimer sets={sets} onSets={setSets} active={phase === 'running'} say={say} /> : null}
          {phase === 'ready' && !sport.gps && !draft ? <Muted style={styles.readyHint}>{t('rec.timerHint')}</Muted> : null}
        </ScrollView>

        <View style={[styles.controls, { paddingBottom: insets.bottom + 18 }, locked && { opacity: 0 }]} pointerEvents={locked ? 'none' : 'auto'}>
          {phase === 'ready' ? (
            <BigButton label={t('rec.start')} icon="play" onPress={() => void start()} />
          ) : phase === 'running' ? (
            <>
              <SideButton icon="lock-closed-outline" label={t('rec.lock')} onPress={() => setLocked(true)} />
              <BigButton icon="pause" tone="dark" accessibilityLabel={t('rec.pause')} onPress={() => pause()} />
              <View style={{ width: 64 }} />
            </>
          ) : (
            <>
              <BigButton label={t('rec.continue')} icon="play" onPress={() => resume()} />
              <BigButton label={t('rec.finish')} icon="stop" tone="dark" onPress={finish} />
            </>
          )}
        </View>
      </View>

      {locked ? (
        <Pressable style={StyleSheet.absoluteFill} onLongPress={() => setLocked(false)} delayLongPress={700} accessibilityLabel={t('rec.lockedA11y')}>
          <View style={[styles.lockPill, { bottom: insets.bottom + 40 }]}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
            <Text style={styles.lockText}>{t('rec.locked')}</Text>
          </View>
        </Pressable>
      ) : null}

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} accessibilityLabel={t('rec.closeSettings')} />
        <View style={[styles.settings, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.settingsTitle}>{t('rec.settings')}</Text>
          <PrefRow title={t('rec.pref.awake')} subtitle={t('rec.pref.awakeSub')} value={prefs.keepAwake} onChange={(v) => changePref('keepAwake', v)} />
          <PrefRow title={t('rec.pref.voice')} subtitle={sport.gps ? t('rec.pref.voiceSubGps') : t('rec.pref.voiceSub')} value={prefs.voice} onChange={(v) => changePref('voice', v)} />
          {sport.gps ? <PrefRow title={t('rec.autoPausedLabel')} subtitle={t('rec.pref.autoPauseSub')} value={prefs.autoPause} onChange={(v) => changePref('autoPause', v)} /> : null}
          {sport.gps ? <PrefRow title={t('rec.pref.startMap')} subtitle={t('rec.pref.startMapSub')} value={prefs.showMap} onChange={(v) => { changePref('showMap', v); setView(v ? 'map' : 'numbers'); }} /> : null}
          {sport.gps && sport.rate === 'pace' ? <PrefRow title={t('rec.pref.speed')} subtitle={t('rec.pref.speedSub')} value={prefs.speed} onChange={(v) => changePref('speed', v)} /> : null}
          <Muted style={{ marginTop: 6, lineHeight: 18 }}>{t('rec.lockNote')}</Muted>
          <Button label={t('rec.ok')} onPress={() => setSettingsOpen(false)} style={{ marginTop: 14 }} />
        </View>
      </Modal>

      {onPickSport ? (
        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} accessibilityLabel={t('common:actions.close')} />
          <View style={[styles.settings, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.handle} />
            <Text style={styles.settingsTitle}>{t('rec.whichWorkout')}</Text>
            <View style={styles.pickGrid}>
              {SPORTS.map((s2) => {
                const on = s2.id === sport.id;
                return (
                  <Pressable key={s2.id} onPress={() => { setPickerOpen(false); if (!on) onPickSport(s2.id); }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={s2.label} style={[styles.pick, on && styles.pickOn]}>
                    <MaterialCommunityIcons name={s2.icon} size={26} color={on ? '#fff' : colors.primary} />
                    <Text style={[styles.pickText, on && { color: '#fff' }]} numberOfLines={1}>{s2.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

/** Gravando, pausado ou salvando: o gesto de voltar do iPhone não pode tirar a pessoa da tela sem querer. */
function NoSwipeBack({ phase }: { phase: Phase }) {
  return <Stack.Screen options={{ gestureEnabled: phase === 'ready' || phase === 'saved' || phase === 'queued' }} />;
}

function BigButton({ label, icon, tone = 'primary', onPress, accessibilityLabel }: { label?: string; icon: keyof typeof Ionicons.glyphMap; tone?: 'primary' | 'dark'; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} trackLabel={accessibilityLabel ?? label} scaleTo={0.94} style={[styles.big, tone === 'dark' ? styles.bigDark : styles.bigPrimary]}>
        <Ionicons name={icon} size={34} color="#fff" style={icon === 'play' ? { marginLeft: 4 } : undefined} />
      </PressableScale>
      {label ? <Text style={styles.bigLabel}>{label}</Text> : null}
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.round, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function SideButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.side}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={styles.sideLabel}>{label}</Text>
    </PressableScale>
  );
}

function Minor({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
      <Text style={styles.minorValue}>{value}</Text>
    </View>
  );
}

function Splits({ splits, speed }: { splits: { km: number; seconds: number; partial?: number }[]; speed: boolean }) {
  const { t } = useTranslation('fitness');
  const pace = (s: { seconds: number; partial?: number }) => s.seconds / ((s.partial ?? 1000) / 1000);
  const full = splits.filter((s) => !s.partial);
  const best = full.length ? Math.min(...full.map(pace)) : null;
  return (
    <View style={styles.splits}>
      <View style={styles.rowBetween}>
        <Text style={styles.splitsTitle}>{t('rec.splits')}</Text>
        <Muted style={{ fontSize: 12 }}>{speed ? t('rec.splitsSpeed') : t('rec.splitsPace')}</Muted>
      </View>
      {[...splits].reverse().slice(0, 6).map((s) => {
        const p = pace(s);
        const isBest = best != null && !s.partial && p === best && full.length > 1;
        return (
          <View key={s.km} style={styles.splitRow}>
            <Text style={styles.splitKm}>{s.partial ? `${s.km}*` : s.km}</Text>
            <Text style={styles.splitPace}>{speed ? num1(3600 / p) : formatPace(p)}</Text>
            <View style={styles.splitTrack}>
              <View style={[styles.splitBar, { width: `${Math.max(12, Math.min(100, ((best ?? p) / p) * 100))}%` }, isBest && { backgroundColor: colors.success }, s.partial ? { opacity: 0.45 } : null]} />
            </View>
          </View>
        );
      })}
      {splits.some((s) => s.partial) ? <Muted style={{ fontSize: 11.5 }}>{t('rec.splitPartial')}</Muted> : null}
    </View>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Muted style={{ fontSize: 11.5 }}>{label}</Muted>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function DoneStat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 80 }}>
      <Text style={styles.doneValue}>{value}</Text>
      <Muted style={{ fontSize: 12 }}>{unit}</Muted>
    </View>
  );
}

function PrefRow({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.pref}>
      <View style={{ flex: 1 }}>
        <Text style={styles.prefTitle}>{title}</Text>
        <Muted style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17 }}>{subtitle}</Muted>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.track }} thumbColor="#fff" accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapWrap: { height: '42%', minHeight: 240 },
  mapFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  noMap: { height: '30%', minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingPill: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#fff', ...shadows.card },
  headingText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text, flexShrink: 1 },
  gpsChip: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff', ...shadows.card },
  gpsWeak: { backgroundColor: colors.warnSoft },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textSoft },
  sheet: { flex: 1, marginTop: -26, backgroundColor: '#fff', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, paddingHorizontal: 22, paddingTop: 10, ...shadows.hero },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.track, marginBottom: 12 },
  pausedBar: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.warn, marginBottom: 8 },
  pausedText: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: '#fff', letterSpacing: 0.3 },
  pausedBand: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: radii.md, backgroundColor: colors.warn, ...shadows.card },
  pausedBandText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: '#fff' },
  numbersTop: { backgroundColor: '#eef3fb' },
  bandPaused: { backgroundColor: colors.warn },
  bigDistance: { alignItems: 'center', marginTop: 14 },
  bigDistanceValue: { fontFamily: typography.fontFamilySemiBold, fontSize: 104, lineHeight: 112, letterSpacing: -4, color: colors.text, fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { height: 38, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: colors.primaryWash },
  tagOn: { backgroundColor: colors.primary },
  tagText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.primaryDeep },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  pick: { width: '31%', flexGrow: 1, height: 92, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryWash },
  pickOn: { backgroundColor: colors.primary },
  pickText: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.text },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  clock: { fontFamily: typography.fontFamilySemiBold, fontSize: 68, lineHeight: 76, letterSpacing: -2.5, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  subtitle: { textAlign: 'center', marginTop: -2 },
  pair: { flexDirection: 'row', alignItems: 'stretch', marginTop: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft },
  pairCell: { flex: 1, alignItems: 'center', gap: 2 },
  pairDivider: { width: 1, backgroundColor: colors.borderSoft },
  pairValue: { fontFamily: typography.fontFamilySemiBold, fontSize: 34, lineHeight: 40, letterSpacing: -1.2, color: colors.text, fontVariant: ['tabular-nums'] },
  pairUnit: { fontFamily: typography.fontFamilyMedium, fontSize: 14, letterSpacing: 0, color: colors.textMuted },
  minor: { flexDirection: 'row', gap: 12, marginTop: 14 },
  minorValue: { marginTop: 2, ...numbers.sm, color: colors.text },
  splits: { marginTop: 18, gap: 8, padding: 14, borderRadius: radii.lg, backgroundColor: '#f6f8fc' },
  splitsTitle: { ...text.section, color: colors.text },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitKm: { width: 26, ...numbers.xs, color: colors.textMuted },
  splitPace: { width: 56, ...numbers.sm, color: colors.text },
  splitTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#e7edf8', overflow: 'hidden' },
  splitBar: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  perm: { marginTop: 16, gap: 10, padding: 14, borderRadius: radii.md, backgroundColor: colors.warnSoft },
  permText: { ...text.callout, color: colors.warnText },
  draft: { marginTop: 18, gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.primaryWash },
  draftTitle: { ...text.bodyStrong, color: colors.text },
  timerInfo: { flexDirection: 'row', gap: 12, marginTop: 18, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg, backgroundColor: '#f6f8fc' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadows.card },
  readyHint: { marginTop: 18, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly', paddingTop: 12 },
  big: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  bigPrimary: { backgroundColor: colors.primary, ...shadows.button },
  bigDark: { backgroundColor: colors.chromeNavy },
  bigLabel: { fontFamily: typography.fontFamilyBold, fontSize: 13.5, color: colors.text },
  side: { width: 64, height: 84, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sideLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textSoft },
  lockPill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 44, borderRadius: 999, backgroundColor: 'rgba(5,10,20,0.88)' },
  lockText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: '#fff' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  settings: { backgroundColor: '#fff', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, paddingHorizontal: 22, paddingTop: 10 },
  settingsTitle: { ...text.title, color: colors.text, marginBottom: 6 },
  pref: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.borderSoft },
  prefTitle: { ...text.bodyStrong, color: colors.text },
  summary: { borderRadius: radii.xl, backgroundColor: '#fff', overflow: 'hidden', ...shadows.card },
  summaryMap: { height: 190 },
  summaryTile: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  summaryValue: { marginTop: 3, ...numbers.sm, color: colors.text },
  ask: { ...text.section, color: colors.text },
  feelings: { flexDirection: 'row', gap: 8 },
  feeling: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 2, borderRadius: radii.md, backgroundColor: colors.primaryWash },
  feelingOn: { backgroundColor: colors.primary },
  feelingText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.primaryDeep, textAlign: 'center' },
  effort: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  effortCell: { flex: 1, borderRadius: 8, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  effortNum: { ...numbers.xs, color: colors.primaryDeep },
  discard: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  discardText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.dangerText },
  done: { flex: 1, alignItems: 'center', paddingHorizontal: 28, gap: 10 },
  doneBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', ...shadows.hero },
  doneTitle: { marginTop: 12, ...text.headline, color: colors.text, textAlign: 'center' },
  doneSub: { textAlign: 'center', lineHeight: 20 },
  doneStats: { flexDirection: 'row', gap: 18, marginTop: 18, paddingVertical: 16, paddingHorizontal: 18, borderRadius: radii.lg, backgroundColor: '#fff', ...shadows.card },
  doneValue: { ...numbers.lg, color: colors.text },
});
