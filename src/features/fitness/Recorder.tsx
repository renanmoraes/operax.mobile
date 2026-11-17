import { router, Stack } from 'expo-router';
import { isRejected } from './resultsQueue';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, Vibration, View } from 'react-native';
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
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { addPoint, averagePace, currentPace, decimateTrack, defaultTitle, emptyRun, formatKm, formatPace, haversine, kmSplits, MAX_ACCURACY_M, resumeAt, type GpsPoint, type RunState, type Track } from './runTracker';
import { gpsGate, isPoolChoice, liveSummary, NO_GPS_OFFER_MS, parsePoolLength, POOL_PRESETS, restoredBanked, swimDistance, type PoolChoice } from './background/liveLogic';
import { bufferedSince, clearBuffer, liveMeta, onLiveFixes, startLiveTracking, stopLiveTracking, toGpsPoint, trimBuffer } from './background/liveTracking';
import { askSummaryPermission, clearLiveSummary, showLiveSummary } from './background/lockScreen';
import { kmCue, stepCue, stepProgress, type GuideStep } from './coach';
import { StepGuideCard } from './recorder/StepGuideCard';
import { RestTimer } from './recorder/RestTimer';
import { SlideToUnlock } from './recorder/SlideToUnlock';
import { fitnessOwner, ownedKey } from './owner';
import { FEELINGS, SPORTS, WORKOUT_TAGS, effortWord, type SportInfo } from './sports';
import type { FitnessFeeling, FreeSport } from './types';
import { useActiveCompanyName } from '@/src/features/client/useClientData';
import { fromRecording, fromStrength } from '@/src/features/share/fromSources';
import { setShareActivity } from '@/src/features/share/store';

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
  /** Natação: tamanho da piscina (m) e piscinas nadadas; a distância já vem em `distanceM`. */
  poolLengthM?: number;
  poolLengths?: number;
};

type Phase = 'ready' | 'running' | 'paused' | 'review' | 'saving' | 'saved' | 'queued';
type Prefs = { keepAwake: boolean; showMap: boolean; speed: boolean; voice: boolean; autoPause: boolean; lockSummary: boolean };
/** Tamanho da piscina: preferência do aluno (por conta), perguntada antes de nadar. */
const POOL_BASE = 'fitness_pool_length';
/** Resumo da tela bloqueada: no máximo uma atualização a cada tanto (bateria). */
const SUMMARY_EVERY_MS = 15_000;
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
/**
 * `guide`: etapa do treino do professor e de onde ela começou; `sets`: séries marcadas na musculação.
 * `live`: estava gravando quando foi guardado (o treino seguiu com o app fechado); `noGps`: começou sem GPS;
 * `pool`: piscina da natação.
 */
type Draft = {
  key: string;
  startedAt: number;
  banked: number;
  savedAt: number;
  /** Com o último ponto: a retomada liga o primeiro ponto da reserva a ele, sem perder o trecho do meio. */
  run: Omit<RunState, 'recent'>;
  guide?: { i: number; s0: number; m0: number };
  sets?: number;
  live?: boolean;
  noGps?: boolean;
  pool?: PoolChoice | null;
};

const run0 = () => emptyRun();
/** Número com 1 casa no formato do idioma ("12,5" / "12.5"). */
/** Metros com até 1 casa no formato do idioma ("1.250" / "33,3"). */
const meters = (n: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n);
const num1 = (n: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

function KeepAwake() {
  // No navegador o pedido de tela acesa pode ser recusado (aba escondida): desligar depois não pode derrubar a tela.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
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
  resumeRoute,
}: {
  sport: SportInfo;
  /** Tela desta gravação: se o app for reaberto com o GPS ainda gravando, volta direto para cá. */
  resumeRoute: string;
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
  const [prefs, setPrefs] = useState<Prefs>({ keepAwake: true, showMap: true, speed: sport.rate === 'speed', voice: true, autoPause: sport.id === 'bike', lockSummary: true });
  /** Começou sem GPS (sem permissão ou sem sinal): grava só o tempo. */
  const [noGps, setNoGps] = useState(false);
  const noGpsRef = useRef(false);
  const gps = sport.gps && !noGps;
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);
  const [waitedLong, setWaitedLong] = useState(false);
  const [pool, setPool] = useState<PoolChoice | null>(null);
  const poolRef = useRef<PoolChoice | null>(null);
  const [poolOther, setPoolOther] = useState<string | null>(null);
  /** A piscina veio da última vez (não foi escolhida agora). */
  const [poolRemembered, setPoolRemembered] = useState(false);
  const [lengths, setLengths] = useState('');
  /** GPS de segundo plano ligado (segue com a tela bloqueada). */
  const bgOn = useRef(false);
  /** Largada em andamento (permissões e GPS ligando): segura toque duplo. */
  const starting = useRef(false);
  const lastSummaryAt = useRef(0);
  const alive = useRef(true);
  const onFixRef = useRef<(p: GpsPoint) => void>(() => undefined);
  const pushSummaryRef = useRef<(force: boolean) => void>(() => undefined);
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
  const unlock = useCallback(() => setLocked(false), []);
  const [title, setTitle] = useState('');
  const [feeling, setFeeling] = useState<FitnessFeeling | undefined>();
  const [effort, setEffort] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const startedAt = useRef(0);
  const [startMs, setStartMs] = useState(0);
  const runningSince = useRef<number | null>(null);
  const banked = useRef(0);
  const sub = useRef<Location.LocationSubscription | null>(null);
  /** Sobe a cada ligar/desligar do GPS: um ligar que termina depois de desligado (ou de sair da tela) é descartado. */
  const watchGen = useRef(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const lastDraftAt = useRef(0);
  const setsRef = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Os intervalos, o GPS de segundo plano e o resumo da tela bloqueada leem o estado vivo por aqui.
  useEffect(() => {
    prefsRef.current = prefs;
    runRef.current = run;
    guideRef.current = guideAt;
    setsRef.current = sets;
    poolRef.current = pool;
    onFixRef.current = onFix;
    pushSummaryRef.current = pushSummary;
  });

  useEffect(() => {
    const k = draftStoreKey();
    if (!k) return;
    void kvGet<Draft>(k).then((d) => {
      const mine = !!d && d.key === draftKey && Date.now() - d.savedAt < DRAFT_MAX_AGE_MS && d.banked >= 5000;
      if (mine) setDraft(d);
      // GPS de segundo plano ligado sem gravação para retomar (sobra de um app fechado): desliga.
      // Só ainda na largada e só se o GPS é desta gravação: outra gravação aberta continua a dela.
      if ((!mine || !d?.live) && phaseRef.current === 'ready' && !starting.current) {
        void liveMeta().then((meta) => {
          if (meta && meta.draftKey === draftKey && phaseRef.current === 'ready' && !starting.current) void stopLiveTracking();
        });
      }
    });
  }, [draftKey]);

  // Natação: o tamanho da piscina vem da última vez (preferência do aluno).
  useEffect(() => {
    if (sport.id !== 'swim') return;
    const k = ownedKey(POOL_BASE);
    if (!k) return;
    void kvGet<PoolChoice>(k).then((p) => {
      // Já escolheu (ou retomou um rascunho) antes de a preferência chegar: fica o que está.
      if (!isPoolChoice(p) || poolRef.current) return;
      setPool(p);
      setPoolRemembered(true);
    });
  }, [sport.id]);
  const choosePool = (p: PoolChoice | null) => {
    setPool(p);
    setPoolRemembered(false);
    const k = ownedKey(POOL_BASE);
    if (k && p) void kvSet(k, p);
  };

  const dropDraft = () => {
    const k = draftStoreKey();
    if (k) void kvSet(k, null);
    void clearBuffer();
  };
  const clearDraft = () => {
    setDraft(null);
    dropDraft();
  };

  /** Guarda o rascunho agora (a cada ~10 s gravando, a cada troca de fase e ao ir para segundo plano). */
  const persistDraft = useCallback(() => {
    const p = phaseRef.current;
    if (p !== 'running' && p !== 'paused' && p !== 'review') return;
    const k = draftStoreKey();
    if (!k) return;
    const now = Date.now();
    lastDraftAt.current = now;
    const bankedNow = banked.current + (runningSince.current ? now - runningSince.current : 0);
    const { recent: _r, ...keep } = runRef.current;
    const d: Draft = { key: draftKey, startedAt: startedAt.current, banked: bankedNow, savedAt: now, run: keep, guide: guideRef.current, sets: setsRef.current, live: p === 'running', noGps: noGpsRef.current, pool: poolRef.current };
    // Os pontos do GPS até aqui já estão no rascunho: a reserva do segundo plano guarda só os de depois.
    void kvSet(k, d).then(() => trimBuffer(now - 5000));
  }, [draftKey]);

  // Pelo cronômetro: musculação não tem GPS mudando nada.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused' && phase !== 'review') return;
    if (phase === 'running' && Date.now() - lastDraftAt.current < 10_000) return;
    persistDraft();
  }, [run, phase, elapsed, sets, persistDraft]);

  async function restore(d: Draft) {
    // Gravando quando o app foi fechado: soma o que o GPS de segundo plano guardou e o tempo que passou.
    const withGps = sport.gps && !d.noGps;
    const points = d.live && withGps ? await bufferedSince(d.savedAt) : [];
    let r: RunState = { ...emptyRun(), ...d.run, last: d.run.last ?? null, recent: [] };
    for (const p of points) r = addPoint(r, p, d.startedAt, sport.tracker);
    const until = withGps ? (points[points.length - 1]?.at ?? d.savedAt) : Date.now();
    startedAt.current = d.startedAt;
    setStartMs(d.startedAt);
    banked.current = restoredBanked(d, Math.min(Date.now(), until), withGps);
    runningSince.current = null;
    setElapsed(Math.round(banked.current / 1000));
    setRun(r);
    noGpsRef.current = !!d.noGps;
    setNoGps(!!d.noGps);
    if (d.noGps) stopWatch();
    if (d.pool !== undefined) setPool(d.pool);
    // Retoma na etapa em que estava (senão a primeira etapa seria medida contra o treino inteiro e repetiria as etapas feitas).
    const g = d.guide ?? { i: 0, s0: 0, m0: 0 };
    guideRef.current = g;
    setGuideAt(g);
    setSets(d.sets ?? 0);
    setDraft(null);
    trackAction('treino retomado do rascunho', { sport: sport.id, live: !!d.live, points: points.length });
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

  /** Avisos de voz (km, etapa, pausa): dá para treinar sem olhar o celular. */
  const say = useCallback((t: string) => {
    if (!prefsRef.current.voice) return;
    try {
      Speech.speak(t, { language: locale(), rate: 1.02 });
    } catch {
      // sem voz no aparelho
    }
  }, []);

  /** Cada posição do GPS (o comum e o de segundo plano): o sinal, a pausa automática e a gravação. */
  function onFix(p: GpsPoint) {
    setAccuracy(p.accuracy);
    setHere({ lat: p.lat, lng: p.lng });
    const prev = prevLoc.current;
    // Ponto repetido ou fora de ordem (os dois GPS na troca de um para o outro): já foi contado.
    if (prev && p.at <= prev.at) return;
    const cur = { lat: p.lat, lng: p.lng, at: p.at };
    prevLoc.current = cur;
    // Velocidade pelo deslocamento entre leituras: o GPS do celular nem sempre informa.
    const ms = prev ? haversine(prev, cur) / ((cur.at - prev.at) / 1000) : 0;
    if (ms > 0.9 && (p.accuracy ?? 0) <= MAX_ACCURACY_M) lastMoveAt.current = Date.now();
    if (phaseRef.current === 'paused' && autoPausedRef.current && ms > 1.4) resumeRef.current(true);
    if (phaseRef.current !== 'running' || noGpsRef.current) return;
    setRun((s) => addPoint(s, p, startedAt.current, sport.tracker));
  }

  /** Resumo na tela bloqueada (tempo, distância, ritmo). `force`: na hora (pausa, saída do app); senão a cada 15 s. */
  const pushSummary = useCallback(
    (force: boolean) => {
      const p = phaseRef.current;
      if (!prefsRef.current.lockSummary || (p !== 'running' && p !== 'paused')) return;
      const now = Date.now();
      if (!force && now - lastSummaryAt.current < SUMMARY_EVERY_MS) return;
      lastSummaryAt.current = now;
      const elapsedS = Math.round((banked.current + (runningSince.current ? now - runningSince.current : 0)) / 1000);
      const s = liveSummary({ sport: heading, paused: p === 'paused', elapsedS, gps: sport.gps && !noGpsRef.current, distanceM: runRef.current.distanceM, speed: prefsRef.current.speed || sport.rate === 'speed', startedAt: startedAt.current });
      void showLiveSummary(s.title, s.body);
    },
    [heading, sport.gps, sport.rate],
  );

  // Pontos do GPS de segundo plano (com a tela bloqueada também): mesmo caminho do GPS comum.
  useEffect(
    () =>
      onLiveFixes((points) => {
        for (const p of points) onFixRef.current(p);
        if (AppState.currentState !== 'active') pushSummaryRef.current(false);
      }),
    [],
  );

  // GPS ligado desde a tela de largada: o sinal já está pronto quando a pessoa toca em Iniciar.
  const watch = useCallback(async () => {
    if (sub.current) return;
    const gen = ++watchGen.current;
    const started = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 }, (loc) => onFixRef.current(toGpsPoint(loc)));
    // Saiu da tela (ou desligou) enquanto o GPS ligava: desliga na hora, senão ficaria ligado gastando bateria.
    if (gen !== watchGen.current) {
      started.remove();
      return;
    }
    sub.current = started;
  }, []);
  const stopWatch = useCallback(() => {
    watchGen.current += 1;
    sub.current?.remove();
    sub.current = null;
  }, []);

  /** Largada: confere a permissão e se a localização do celular está ligada, e liga o GPS para achar o sinal. */
  const prepareGps = useCallback(async () => {
    if (!sport.gps || noGpsRef.current) return;
    const p = await Location.getForegroundPermissionsAsync();
    if (!alive.current) return; // saiu da tela antes de o sistema responder: não liga o GPS
    setPerm(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'denied');
    if (!p.granted) return;
    const on = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!alive.current) return;
    setServicesOn(on);
    if (on) await watch().catch((e) => void reportError(e, { context: 'gps preparar' }));
  }, [sport.gps, watch]);

  useEffect(() => {
    if (!sport.gps) return;
    void prepareGps();
    // Muito tempo sem sinal bom: aparece a saída "Iniciar sem GPS".
    const t = setTimeout(() => setWaitedLong(true), NO_GPS_OFFER_MS);
    return () => {
      clearTimeout(t);
      stopWatch();
    };
  }, [sport.gps, prepareGps, stopWatch]);

  /** Gravando: o GPS que segue com a tela bloqueada; se o aparelho não deixar (Expo Go, web), o GPS comum. */
  const startTracking = useCallback(async () => {
    if (!sport.gps || noGpsRef.current) return;
    const ok = bgOn.current || (await startLiveTracking({ route: resumeRoute, draftKey, startedAt: startedAt.current, owner: fitnessOwner() }, { title: i18n.t('fitness:live.serviceTitle'), body: i18n.t('fitness:live.serviceBody') }));
    if (!alive.current) {
      if (ok) void stopLiveTracking();
      return;
    }
    bgOn.current = ok;
    if (ok) stopWatch();
    else await watch();
  }, [sport.gps, resumeRoute, draftKey, watch, stopWatch]);
  const stopTracking = useCallback(() => {
    stopWatch();
    bgOn.current = false;
    void stopLiveTracking();
    void clearLiveSummary();
  }, [stopWatch]);

  // Saiu da tela: o GPS de segundo plano e o resumo da tela bloqueada não ficam ligados sozinhos.
  useEffect(
    () => () => {
      if (bgOn.current) void stopLiveTracking();
      void clearLiveSummary();
    },
    [],
  );

  // App para trás (tela bloqueada, outro app): guarda o rascunho e mostra o resumo; de volta, tira o resumo.
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        lastSummaryAt.current = 0;
        void clearLiveSummary();
        // Voltou dos Ajustes (permissão, localização ligada): confere de novo antes de largar.
        if (phaseRef.current === 'ready') void prepareGps();
        return;
      }
      if (st !== 'background') return;
      persistDraft();
      pushSummaryRef.current(true);
    });
    return () => s.remove();
  }, [persistDraft, prepareGps]);

  // Cronômetro: tempo de relógio menos as pausas.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      const now = Date.now();
      const secs = Math.round((banked.current + (now - (runningSince.current ?? now))) / 1000);
      setElapsed(secs);
      // Tela bloqueada: o resumo anda com o relógio (a cada 15 s), mesmo parado, sem ponto novo de GPS.
      if (AppState.currentState !== 'active') pushSummaryRef.current(false);
      // Parado com pausa automática ligada: pausa sozinho e volta quando a pessoa anda.
      if (sport.gps && !noGpsRef.current && prefsRef.current.autoPause && now - lastMoveAt.current > AUTO_PAUSE_MS) pauseRef.current(true);
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
      stopTracking();
      dropDraft();
      onClose();
    });
  }, [onClose, t, stopTracking]);

  // Voltar do Android no meio do treino não sai sem querer.
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      const p = phaseRef.current;
      if (locked) return true;
      // Salvando: nada muda até o envio terminar (voltar e continuar gravando perderia o que viesse depois).
      if (p === 'saving') return true;
      if (p === 'running' || p === 'paused' || p === 'review') {
        if (p === 'review') go('paused');
        else discard();
        return true;
      }
      return false;
    });
    return () => h.remove();
  }, [discard, go, locked]);

  /**
   * Largada. Com GPS, só sai com sinal bom (ver `gpsGate`); `withoutGps`: o aluno escolheu gravar só o tempo
   * (sem permissão, localização desligada ou sem sinal). Natação: precisa do tamanho da piscina.
   */
  async function start(withoutGps = false) {
    if (starting.current) return;
    if (sport.gps && !withoutGps) {
      if (perm !== 'granted') {
        // Primeiro toque: pede a localização; o Iniciar libera quando o sinal ficar bom.
        const p = await Location.requestForegroundPermissionsAsync();
        // Recusou agora: mostra o caminho dos Ajustes e a saída sem GPS (na próxima abertura pergunta de novo, se puder).
        setPerm(p.granted ? 'granted' : 'denied');
        if (p.granted) void prepareGps();
        return;
      }
      if (!gate.ok) return;
    }
    if (sport.id === 'swim' && !pool) return;
    starting.current = true;
    try {
      if (withoutGps) {
        noGpsRef.current = true;
        setNoGps(true);
        stopWatch();
        trackAction('treino sem gps', { sport: sport.id, reason: gate.ok ? 'ok' : gate.reason });
      }
      // Permissão de notificação, pedida aqui quando faz sentido (uma vez só): para o resumo da tela bloqueada e,
      // no Android com GPS, para o aviso obrigatório do serviço de localização aparecer (Android 13 ou mais novo).
      if (prefsRef.current.lockSummary || (Platform.OS === 'android' && sport.gps && !noGpsRef.current)) await askSummaryPermission();
      clearDraft();
      startedAt.current = Date.now();
      setStartMs(startedAt.current);
      try {
        await startTracking();
      } catch (e) {
        void reportError(e, { context: 'gps iniciar' });
      }
      if (!alive.current) return;
      runningSince.current = Date.now();
      banked.current = 0;
      setRun(emptyRun());
      setElapsed(0);
      trackAction('treino iniciado', { sport: sport.id, background: bgOn.current });
      lastMoveAt.current = Date.now();
      const g0 = { i: 0, s0: 0, m0: 0 };
      guideRef.current = g0;
      setGuideAt(g0);
      setSets(0);
      go('running');
      say(guide?.length ? `${t('rec.say.started')} ${stepCue(guide[0])}` : t('rec.say.started'));
    } finally {
      starting.current = false;
    }
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
    if (AppState.currentState !== 'active') pushSummaryRef.current(true);
  }

  function resume(auto = false) {
    if (phaseRef.current !== 'paused') return;
    autoPausedRef.current = false;
    setAutoPaused(false);
    lastMoveAt.current = Date.now();
    if (!auto) say(t('rec.say.resumed'));
    else say(t('rec.say.resuming'));
    // Voltou da tela de salvar depois de uma falha (ou retomou um rascunho): o GPS estava desligado.
    if (gps) void startTracking().catch((e) => void reportError(e, { context: 'gps continuar' }));
    runningSince.current = Date.now();
    setRun((s) => resumeAt(s));
    go('running');
    if (AppState.currentState !== 'active') pushSummaryRef.current(true);
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
    stopTracking();
    const seconds = Math.max(1, Math.round(banked.current / 1000));
    const laps = poolLaps;
    try {
      const out = await onSave({
        startedAt: startedAt.current,
        seconds,
        distanceM: sport.id === 'swim' ? swimDistance(pool, laps) : gps ? run.distanceM : 0,
        elevationGainM: gps ? run.elevationGainM : 0,
        track: gps ? decimateTrack(run.track) : undefined,
        poolLengthM: sport.id === 'swim' && pool?.kind === 'pool' ? pool.m : undefined,
        poolLengths: sport.id === 'swim' && pool?.kind === 'pool' && laps > 0 ? laps : undefined,
        title: askTitle ? title.trim() || defaultTitle(sport.label, new Date(startedAt.current)) : undefined,
        feeling,
        effort,
        notes: notes.trim() || undefined,
        tag,
        sets: gps ? undefined : sets || undefined,
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
  const weak = accuracy != null && accuracy > MAX_ACCURACY_M;
  const speed = prefs.speed || sport.rate === 'speed';
  // Largada com GPS: o Iniciar espera um sinal bom (ou a escolha de gravar só o tempo).
  const gate = sport.gps ? gpsGate({ perm, servicesOn, hasFix: !!here, accuracy, searchingMs: waitedLong ? NO_GPS_OFFER_MS : 0 }) : ({ ok: true } as const);
  const poolLaps = Math.min(2000, Math.max(0, Math.floor(Number(lengths) || 0)));
  const swimM = sport.id === 'swim' ? swimDistance(pool, poolLaps) : 0;

  const companyName = useActiveCompanyName();
  function share() {
    const base = {
      title: askTitle ? title.trim() || defaultTitle(sport.label, new Date(startedAt.current)) : heading,
      company: companyName,
      date: new Date(startedAt.current).toISOString(),
      seconds: elapsed,
    };
    setShareActivity(
      gps
        ? fromRecording(base, { sport: sport.id, preferSpeed: speed, distanceM: run.distanceM, elevationGainM: run.elevationGainM, route, kmMarks: run.kmMarks })
        : fromStrength(base, { setsDone: sets || null }),
    );
    router.push('/cliente/compartilhar');
  }

  if (phase === 'saved' || phase === 'queued') {
    return (
      <Screen>
        <View style={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
          <LinearGradient colors={[colors.cyan, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneBadge}>
            <MaterialCommunityIcons name={phase === 'saved' ? 'check-bold' : 'cloud-clock-outline'} size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.doneTitle}>{phase === 'saved' ? t('rec.saved') : t('rec.queued')}</Text>
          <Muted style={styles.doneSub}>
            {phase === 'saved' ? t(gps ? 'rec.savedBodyGps' : 'rec.savedBody') : t('rec.queuedBody')}
          </Muted>
          <View style={styles.doneStats}>
            {gps ? <DoneStat value={formatKm(run.distanceM)} unit="km" /> : null}
            {swimM > 0 ? <DoneStat value={meters(swimM)} unit="m" /> : null}
            <DoneStat value={formatClock(elapsed)} unit={t('rec.timeUnit')} />
            {gps && sport.rate === 'pace' ? <DoneStat value={formatPace(averagePace(run, elapsed))} unit="/km" /> : null}
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 'auto' }}>
            <Button label={t('done.share')} icon="share-outline" onPress={share} />
            {phase === 'saved' ? <Button label={t('rec.seeHistory')} icon="time-outline" variant="secondary" onPress={onHistory} /> : null}
            <Button label={t('rec.finishDone')} variant="ghost" onPress={onClose} />
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
        <TopBar safe title={t('rec.saveWorkout')} onBack={phase === 'saving' ? undefined : () => go('paused')} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            {gps && route.length > 1 ? <RouteMap route={route} style={styles.summaryMap} /> : null}
            <View style={styles.summaryRow}>
              {!gps ? (
                <LinearGradient colors={['#e3ecff', '#ddf3ff']} style={styles.summaryTile}>
                  <MaterialCommunityIcons name={sport.icon} size={30} color={colors.primary} />
                </LinearGradient>
              ) : null}
              <SummaryCell label={gps ? t('rec.time') : t('rec.sportTime', { sport: sport.label })} value={formatClock(seconds)} />
              {!gps && sets ? <SummaryCell label={t('rec.sets')} value={String(sets)} /> : null}
              {swimM > 0 ? <SummaryCell label={t('rec.distance')} value={`${meters(swimM)} m`} /> : null}
              {swimM > 0 && seconds > 0 ? <SummaryCell label={t('rec.pool.pace')} value={formatPace((seconds / swimM) * 100)} /> : null}
              {gps ? <SummaryCell label={t('rec.distance')} value={`${formatKm(run.distanceM)} km`} /> : null}
              {gps ? <SummaryCell label={speed ? t('rec.speed') : t('rec.pace')} value={speed ? `${num1(seconds ? (run.distanceM / seconds) * 3.6 : 0)} km/h` : `${formatPace(averagePace(run, seconds))}/km`} /> : null}
              {gps ? <SummaryCell label={t('rec.climb')} value={`${Math.round(run.elevationGainM)} m`} /> : null}
            </View>
          </View>

          {sport.id === 'swim' && pool?.kind === 'pool' ? (
            <View style={{ gap: 6 }}>
              <Field label={t('rec.pool.lengths')} value={lengths} onChangeText={(v) => setLengths(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="40" />
              <Muted style={{ fontSize: 12.5 }}>{swimM > 0 ? t('rec.pool.total', { m: meters(swimM), pool: meters(pool.m) }) : t('rec.pool.lengthsHint', { pool: meters(pool.m) })}</Muted>
            </View>
          ) : null}

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
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  const active = phase === 'running' || phase === 'paused';
  const showMap = gps && view === 'map';
  const paused = phase === 'paused';
  const guideCard = guide?.length && active ? (
    <StepGuideCard steps={guide} index={guideAt.i} doneSeconds={elapsed - guideAt.s0} doneMeters={run.distanceM - guideAt.m0} pace={now} onNext={() => advanceGuide(elapsed, run.distanceM)} compact={showMap} />
  ) : null;
  const draftFirst = phase === 'ready' && !!draft;
  const customPool = pool?.kind === 'pool' && !(POOL_PRESETS as readonly number[]).includes(pool.m);
  const needsPermission = !gate.ok && gate.reason === 'permission';
  const poolMissing = sport.id === 'swim' && !pool;
  const startBlocked = (!gate.ok && !needsPermission) || poolMissing;
  // Por que o Iniciar ainda não libera (e a saída sem GPS quando não tem sinal ou permissão).
  const startNote: { text: string; icon: keyof typeof Ionicons.glyphMap; warn: boolean; offerNoGps: boolean } | null =
    phase !== 'ready' || draft
      ? null
      : !gate.ok
        ? {
            text: t(`rec.gate.${gate.reason}`, { m: Math.round(accuracy ?? 0), max: MAX_ACCURACY_M }),
            icon: gate.reason === 'permission' ? 'navigate-outline' : gate.reason === 'searching' || gate.reason === 'weak' ? 'locate-outline' : 'alert-circle-outline',
            warn: gate.reason === 'denied' || gate.reason === 'servicesOff',
            offerNoGps: gate.offerNoGps,
          }
        : poolMissing
          ? { text: t('rec.gate.pool'), icon: 'water-outline', warn: false, offerNoGps: false }
          : null;
  const confirmClearDraft = () =>
    void confirmDialog({ title: t('rec.discardTitle'), message: t('rec.discardBody'), confirmLabel: t('rec.discard'), cancelLabel: t('common:actions.back'), tone: 'danger' }).then((ok) => {
      if (!ok) return;
      clearDraft();
      // Rascunho de um app fechado no meio: o GPS de segundo plano ainda podia estar ligado.
      void stopLiveTracking();
    });
  return (
    <Screen backdrop="none" style={{ backgroundColor: '#fff' }}>
      <NoSwipeBack phase={phase} />
      {active && prefs.keepAwake ? <KeepAwake /> : null}
      {showMap ? (
        <View style={styles.mapWrap}>
          <RouteMap route={route} here={here} follow style={StyleSheet.absoluteFill} inset={{ top: insets.top + 96, bottom: 30 }} />
          <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']} style={[styles.mapFade, { height: insets.top + 70 }]} pointerEvents="none" />
        </View>
      ) : gps ? (
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
        ) : gps ? (
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

      {gps && !(paused && showMap) && (showMap || phase === 'ready') ? (
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
          {/* Na largada com treino não salvo, os números zerados saem e o rascunho fica inteiro à vista. */}
          {draftFirst ? null : (
            <>
              <Text style={styles.label}>{t('rec.time')}</Text>
              <Text style={styles.clock} accessibilityLabel={t('rec.timeA11y', { time: formatClock(elapsed) })}>{formatClock(elapsed)}</Text>
              {subtitle ? <Muted style={styles.subtitle} numberOfLines={1}>{subtitle}</Muted> : null}
            </>
          )}

          {gps && !showMap && phase !== 'ready' ? (
            <View style={styles.bigDistance}>
              <Text style={styles.bigDistanceValue} accessibilityLabel={t('rec.kmA11y', { km: formatKm(run.distanceM) })}>{formatKm(run.distanceM)}</Text>
              <Text style={styles.label}>{t('rec.distanceKm')}</Text>
            </View>
          ) : null}

          {gps && !draftFirst ? (
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

          {gps && phase !== 'ready' ? (
            <View style={styles.minor}>
              {/* Nos números grandes o ritmo atual já está no par de cima: aqui fica a máxima (bike) ou nada. */}
              {showMap || speed ? <Minor label={speed ? t('rec.max') : t('rec.currentPace')} value={speed ? `${num1(run.maxSpeedMs * 3.6)} km/h` : `${formatPace(now)} /km`} /> : null}
              <Minor label={t('rec.climb')} value={`${Math.round(run.elevationGainM)} m`} />
              <Minor label={t('rec.altitude')} value={run.altitudeM != null ? `${Math.round(run.altitudeM)} m` : '–'} />
            </View>
          ) : null}

          {goalMeters && gps ? (
            <View style={{ marginTop: 16, gap: 6 }}>
              <ProgressBar progress={Math.min(1, run.distanceM / goalMeters)} />
              <Muted style={{ fontSize: 12.5 }}>{t('rec.goal', { km: formatKm(goalMeters) })}</Muted>
            </View>
          ) : null}

          {gps && splits.length ? <Splits splits={splits} speed={speed} /> : null}

          {gps && perm === 'denied' ? (
            <View style={styles.perm}>
              <Text style={styles.permText}>{t('rec.locationNeeded')}</Text>
              <Button label={t('rec.settingsShort')} variant="soft" compact onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}
          {phase === 'ready' && draft ? (
            <View style={[styles.draft, draftFirst && { marginTop: 6 }]}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.draftTitle}>{t('rec.unsaved')}</Text>
                  <Muted style={{ fontSize: 12.5 }}>
                    {[t('rec.startedAtTime', { time: new Date(draft.startedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) }), formatClock(Math.round(restoredBanked(draft, sport.gps && !draft.noGps ? draft.savedAt : Date.now(), !!(sport.gps && !draft.noGps)) / 1000)), sport.gps && !draft.noGps ? `${formatKm(draft.run.distanceM)} km` : null].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
              </View>
            </View>
          ) : null}
          {!gps && phase !== 'ready' ? (
            <View style={styles.timerInfo}>
              <Minor label={t('rec.startedAt')} value={new Date(startMs).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })} />
              <Minor label={t('rec.status')} value={phase === 'paused' ? t('rec.pausedLabel') : t('rec.recording')} />
              {sport.id === 'swim' && pool ? <Minor label={t('rec.pool.short')} value={pool.kind === 'pool' ? `${meters(pool.m)} m` : t('rec.pool.open')} /> : null}
              {noGps ? <Minor label={t('rec.gpsLabel')} value={t('rec.gpsOff')} /> : null}
            </View>
          ) : null}
          {!gps && active && (sport.id === 'strength' || sport.id === 'other') ? <RestTimer sets={sets} onSets={setSets} active={phase === 'running'} say={say} /> : null}
          {phase === 'ready' && sport.id === 'swim' && !draft ? (
            <View style={styles.poolCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.ask}>{t('rec.pool.title')}</Text>
                {pool && poolRemembered ? <Muted style={{ fontSize: 12 }}>{t('rec.pool.remembered')}</Muted> : null}
              </View>
              <View style={styles.tags} accessibilityRole="radiogroup">
                {POOL_PRESETS.map((m) => (
                  <PoolChip key={m} label={`${m} m`} on={pool?.kind === 'pool' && pool.m === m && poolOther === null} onPress={() => { setPoolOther(null); choosePool({ kind: 'pool', m }); }} />
                ))}
                <PoolChip label={customPool && poolOther === null ? `${meters(pool.m)} m` : t('rec.pool.other')} on={poolOther !== null || customPool} onPress={() => setPoolOther(customPool ? String(pool.m).replace('.', ',') : '')} />
                <PoolChip label={t('rec.pool.open')} on={pool?.kind === 'open'} onPress={() => { setPoolOther(null); choosePool({ kind: 'open' }); }} />
              </View>
              {poolOther !== null ? (
                <Field
                  label={t('rec.pool.otherLabel')}
                  value={poolOther}
                  keyboardType="decimal-pad"
                  placeholder="33,3"
                  onChangeText={(v) => {
                    const clean = v.replace(/[^\d.,]/g, '').slice(0, 5);
                    setPoolOther(clean);
                    const m = parsePoolLength(clean);
                    if (m) choosePool({ kind: 'pool', m });
                    else choosePool(null);
                  }}
                />
              ) : null}
              <Muted style={{ fontSize: 12.5, lineHeight: 18 }}>{poolOther !== null && !pool ? t('rec.pool.range') : t('rec.pool.hint')}</Muted>
            </View>
          ) : null}
        </ScrollView>

        {startNote ? (
          <View style={[styles.startNote, startNote.warn && styles.startNoteWarn]} accessibilityLiveRegion="polite">
            <View style={styles.startNoteRow}>
              <Ionicons name={startNote.icon} size={17} color={startNote.warn ? colors.warnText : colors.primary} />
              <Text style={[styles.startNoteText, startNote.warn && { color: colors.warnText }]}>{startNote.text}</Text>
            </View>
            {startNote.offerNoGps ? (
              <Pressable onPress={() => void start(true)} accessibilityRole="button" hitSlop={6} style={styles.noGps}>
                <Ionicons name="timer-outline" size={16} color={colors.primaryDeep} />
                <Text style={styles.noGpsText}>{t('rec.gate.noGps')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.controls, { paddingBottom: insets.bottom + 18 }, locked && { opacity: 0 }]} pointerEvents={locked ? 'none' : 'auto'}>
          {phase === 'ready' && draft ? (
            // Com treino não salvo, só as duas saídas possíveis: retomar ou descartar (sem "Iniciar", que confundia).
            <>
              <BigButton label={t('rec.discardShort')} icon="trash-outline" tone="dark" onPress={confirmClearDraft} />
              <BigButton label={t('rec.resume')} icon="play" onPress={() => restore(draft)} />
            </>
          ) : phase === 'ready' ? (
            needsPermission ? (
              <BigButton label={t('rec.allowGps')} icon="navigate" onPress={() => void start()} />
            ) : (
              <BigButton label={t('rec.start')} icon="play" disabled={startBlocked} onPress={() => void start()} />
            )
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
        // A tela inteira engole os toques; só o trilho do cadeado destrava.
        <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true}>
          <SlideToUnlock label={t('rec.locked')} a11yLabel={t('rec.lockedA11y')} onUnlock={unlock} style={[styles.lockSlider, { bottom: insets.bottom + 28 }]} />
        </View>
      ) : null}

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} accessibilityLabel={t('rec.closeSettings')} />
        <View style={[styles.settings, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.settingsTitle}>{t('rec.settings')}</Text>
          <PrefRow title={t('rec.pref.awake')} subtitle={t('rec.pref.awakeSub')} value={prefs.keepAwake} onChange={(v) => changePref('keepAwake', v)} />
          <PrefRow title={t('rec.pref.voice')} subtitle={gps ? t('rec.pref.voiceSubGps') : t('rec.pref.voiceSub')} value={prefs.voice} onChange={(v) => changePref('voice', v)} />
          {gps ? <PrefRow title={t('rec.autoPausedLabel')} subtitle={t('rec.pref.autoPauseSub')} value={prefs.autoPause} onChange={(v) => changePref('autoPause', v)} /> : null}
          {gps ? <PrefRow title={t('rec.pref.startMap')} subtitle={t('rec.pref.startMapSub')} value={prefs.showMap} onChange={(v) => { changePref('showMap', v); setView(v ? 'map' : 'numbers'); }} /> : null}
          {gps && sport.rate === 'pace' ? <PrefRow title={t('rec.pref.speed')} subtitle={t('rec.pref.speedSub')} value={prefs.speed} onChange={(v) => changePref('speed', v)} /> : null}
          {Platform.OS !== 'web' ? <PrefRow title={t('rec.pref.lockSummary')} subtitle={t('rec.pref.lockSummarySub')} value={prefs.lockSummary} onChange={(v) => changePref('lockSummary', v)} /> : null}
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

function BigButton({ label, icon, tone = 'primary', onPress, accessibilityLabel, disabled }: { label?: string; icon: keyof typeof Ionicons.glyphMap; tone?: 'primary' | 'dark'; onPress: () => void; accessibilityLabel?: string; disabled?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} accessibilityLabel={accessibilityLabel ?? label} trackLabel={accessibilityLabel ?? label} scaleTo={0.94} style={[styles.big, disabled ? styles.bigOff : tone === 'dark' ? styles.bigDark : styles.bigPrimary]}>
        <Ionicons name={icon} size={34} color="#fff" style={icon === 'play' ? { marginLeft: 4 } : undefined} />
      </PressableScale>
      {label ? <Text style={[styles.bigLabel, disabled && { color: colors.textMuted }]}>{label}</Text> : null}
    </View>
  );
}

function PoolChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.tag, styles.poolChip, on && styles.tagOn]}>
      <Text style={[styles.tagText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
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
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly', paddingTop: 12 },
  big: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  bigPrimary: { backgroundColor: colors.primary, ...shadows.button },
  bigDark: { backgroundColor: colors.chromeNavy },
  bigOff: { backgroundColor: colors.textMuted, opacity: 0.45 },
  startNote: { gap: 8, marginTop: 4, paddingVertical: 11, paddingHorizontal: 14, borderRadius: radii.md, backgroundColor: colors.primaryWash },
  startNoteWarn: { backgroundColor: colors.warnSoft },
  startNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  startNoteText: { flex: 1, ...text.callout, color: colors.primaryDeep },
  noGps: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff' },
  noGpsText: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.primaryDeep },
  poolCard: { marginTop: 18, gap: 12, padding: 16, borderRadius: radii.lg, backgroundColor: '#f6f8fc' },
  poolChip: { minWidth: 64, alignItems: 'center' },
  bigLabel: { fontFamily: typography.fontFamilyBold, fontSize: 13.5, color: colors.text },
  side: { width: 64, height: 84, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sideLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textSoft },
  lockSlider: { position: 'absolute', left: 24, right: 24 },
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
