import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Field, Muted, PressableScale, ProgressBar, Screen, TopBar } from '@/src/design-system/ui';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { formatClock } from '@/src/shared/format';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { reportError, trackAction } from '@/src/shared/telemetry/errorReporter';
import { RouteMap } from './RouteMap';
import { addPoint, averagePace, currentPace, decimateTrack, defaultTitle, emptyRun, formatKm, formatPace, kmSplits, resumeAt, type RunState, type Track } from './runTracker';
import { FEELINGS, effortWord, type SportInfo } from './sports';
import type { FitnessFeeling } from './types';

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
};

type Phase = 'ready' | 'running' | 'paused' | 'review' | 'saving' | 'saved' | 'queued';
type Prefs = { keepAwake: boolean; showMap: boolean; speed: boolean };
const PREFS_KEY = 'fitness_recorder_prefs';

/**
 * Rascunho da gravação no banco do aparelho: se o Android fechar o app no meio do treino (pouca memória,
 * bateria) ou o app travar, a pessoa reabre e retoma de onde parou, em vez de perder a corrida.
 */
const DRAFT_KEY = 'fitness_recording_draft';
const DRAFT_MAX_AGE_MS = 6 * 3600_000;
type Draft = { key: string; startedAt: number; banked: number; savedAt: number; run: Omit<RunState, 'last' | 'recent'> };

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
}: {
  sport: SportInfo;
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
  const [prefs, setPrefs] = useState<Prefs>({ keepAwake: true, showMap: true, speed: sport.rate === 'speed' });
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
    void kvGet<Draft>(DRAFT_KEY).then((d) => {
      if (d && d.key === draftKey && Date.now() - d.savedAt < DRAFT_MAX_AGE_MS && d.banked >= 5000) setDraft(d);
    });
  }, [draftKey]);

  const clearDraft = () => {
    setDraft(null);
    void kvSet(DRAFT_KEY, null);
  };

  // Grava o rascunho a cada ~10 s gravando e sempre que muda de fase (pausa, fim).
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused' && phase !== 'review') return;
    const now = Date.now();
    if (phase === 'running' && now - lastDraftAt.current < 10_000) return;
    lastDraftAt.current = now;
    const bankedNow = banked.current + (runningSince.current ? now - runningSince.current : 0);
    const { last: _l, recent: _r, ...keep } = run;
    void kvSet(DRAFT_KEY, { key: draftKey, startedAt: startedAt.current, banked: bankedNow, savedAt: now, run: keep } satisfies Draft);
  }, [run, phase, draftKey]);

  function restore(d: Draft) {
    startedAt.current = d.startedAt;
    setStartMs(d.startedAt);
    banked.current = d.banked;
    runningSince.current = null;
    setElapsed(Math.round(d.banked / 1000));
    setRun({ ...emptyRun(), ...d.run, last: null, recent: [] });
    setDraft(null);
    trackAction('treino retomado do rascunho', { sport: sport.id });
    go('paused');
  }

  useEffect(() => {
    void kvGet<Partial<Prefs>>(PREFS_KEY).then((p) => p && setPrefs((cur) => ({ ...cur, ...p })));
  }, []);
  const changePref = (k: keyof Prefs, v: boolean) =>
    setPrefs((cur) => {
      const next = { ...cur, [k]: v };
      void kvSet(PREFS_KEY, next);
      return next;
    });

  // GPS ligado desde a tela de largada: o sinal já está pronto quando a pessoa toca em Iniciar.
  const watch = useCallback(async () => {
    if (sub.current) return;
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 }, (loc) => {
      setAccuracy(loc.coords.accuracy ?? null);
      setHere({ lat: loc.coords.latitude, lng: loc.coords.longitude });
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
    const t = setInterval(() => setElapsed(Math.round((banked.current + (Date.now() - (runningSince.current ?? Date.now()))) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  const discard = useCallback(() => {
    Alert.alert('Descartar treino?', 'O que foi gravado agora não vai para o histórico.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => { stopWatch(); void kvSet(DRAFT_KEY, null); onClose(); } },
    ]);
  }, [onClose]);

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
    go('running');
  }

  function pause() {
    banked.current += Date.now() - (runningSince.current ?? Date.now());
    runningSince.current = null;
    setElapsed(Math.round(banked.current / 1000));
    go('paused');
  }

  function resume() {
    // Voltou da tela de salvar depois de uma falha: o GPS foi desligado ao tentar salvar.
    if (sport.gps) void watch().catch((e) => void reportError(e, { context: 'gps continuar' }));
    runningSince.current = Date.now();
    setRun((s) => resumeAt(s));
    go('running');
  }

  function finish() {
    if (phaseRef.current === 'running') pause();
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
      });
      void kvSet(DRAFT_KEY, null);
      go(out);
    } catch (e) {
      void reportError(e, { context: 'salvar treino gravado' });
      go('review');
      Alert.alert('Não deu para salvar', 'Tente de novo em instantes.');
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
          <Text style={styles.doneTitle}>{phase === 'saved' ? 'Treino salvo' : 'Guardado no celular'}</Text>
          <Muted style={styles.doneSub}>
            {phase === 'saved' ? `Está no seu histórico${sport.gps ? ', com o caminho' : ''} e com o que você contou. Seu professor também vê.` : 'Sem internet agora. Ele vai sozinho para o histórico quando a conexão voltar.'}
          </Muted>
          <View style={styles.doneStats}>
            {sport.gps ? <DoneStat value={formatKm(run.distanceM)} unit="km" /> : null}
            <DoneStat value={formatClock(elapsed)} unit="tempo" />
            {sport.gps && sport.rate === 'pace' ? <DoneStat value={formatPace(averagePace(run, elapsed))} unit="/km" /> : null}
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 'auto' }}>
            {phase === 'saved' ? <Button label="Ver no histórico" icon="time-outline" onPress={onHistory} /> : null}
            <Button label="Concluir" variant={phase === 'saved' ? 'secondary' : 'primary'} onPress={onClose} />
          </View>
        </View>
      </Screen>
    );
  }

  if (phase === 'review' || phase === 'saving') {
    const seconds = elapsed;
    return (
      <Screen>
        <TopBar safe title="Salvar treino" onBack={() => go('paused')} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            {sport.gps && route.length > 1 ? <RouteMap route={route} style={styles.summaryMap} /> : null}
            <View style={styles.summaryRow}>
              {!sport.gps ? (
                <LinearGradient colors={['#e3ecff', '#ddf3ff']} style={styles.summaryTile}>
                  <MaterialCommunityIcons name={sport.icon} size={30} color={colors.primary} />
                </LinearGradient>
              ) : null}
              <SummaryCell label={sport.gps ? 'Tempo' : `${sport.label} · tempo`} value={formatClock(seconds)} />
              {sport.gps ? <SummaryCell label="Distância" value={`${formatKm(run.distanceM)} km`} /> : null}
              {sport.gps ? <SummaryCell label={speed ? 'Velocidade' : 'Ritmo'} value={speed ? `${(seconds ? (run.distanceM / seconds) * 3.6 : 0).toFixed(1).replace('.', ',')} km/h` : `${formatPace(averagePace(run, seconds))}/km`} /> : null}
              {sport.gps ? <SummaryCell label="Subida" value={`${Math.round(run.elevationGainM)} m`} /> : null}
            </View>
          </View>

          {askTitle ? <Field label="Nome do treino" value={title} onChangeText={(v) => setTitle(v.slice(0, 80))} placeholder={defaultTitle(sport.label, new Date(startMs))} /> : null}

          <View style={{ gap: 10 }}>
            <Text style={styles.ask}>Como foi o treino?</Text>
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
              <Text style={styles.ask}>Esforço</Text>
              <Muted>{effort ? `${effort} · ${effortWord(effort)}` : 'De 1 a 10'}</Muted>
            </View>
            <View style={styles.effort}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const on = effort != null && n <= effort;
                return (
                  <Pressable key={n} onPress={() => setEffort(effort === n ? undefined : n)} accessibilityRole="button" accessibilityLabel={`Esforço ${n}, ${effortWord(n)}`} accessibilityState={{ selected: effort === n }} style={[styles.effortCell, { height: 22 + n * 2.6 }, on && { backgroundColor: n >= 9 ? colors.warn : colors.primary }]}>
                    <Text style={[styles.effortNum, on && { color: '#fff' }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="Anotações para o professor" value={notes} onChangeText={(v) => setNotes(v.slice(0, 500))} placeholder="Dor, clima, o que sentiu…" multiline />

          <View style={{ gap: 10 }}>
            <Button label="Salvar treino" icon="checkmark" loading={phase === 'saving'} onPress={() => void save()} />
            <Button label="Continuar gravando" variant="ghost" disabled={phase === 'saving'} onPress={() => go('paused')} />
            <Pressable onPress={discard} disabled={phase === 'saving'} accessibilityRole="button" style={styles.discard}>
              <Text style={styles.discardText}>Descartar treino</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const active = phase === 'running' || phase === 'paused';
  const showMap = sport.gps && prefs.showMap;
  return (
    <Screen backdrop="none" style={{ backgroundColor: '#fff' }}>
      {active && prefs.keepAwake ? <KeepAwake /> : null}
      {showMap ? (
        <View style={styles.mapWrap}>
          <RouteMap route={route} here={here} follow style={StyleSheet.absoluteFill} inset={{ top: insets.top + 96, bottom: 30 }} />
          <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']} style={[styles.mapFade, { height: insets.top + 70 }]} pointerEvents="none" />
        </View>
      ) : (
        <LinearGradient colors={['#e3ecff', '#f4f8ff']} style={[styles.noMap, { paddingTop: insets.top + 64 }]}>
          <MaterialCommunityIcons name={sport.icon} size={64} color={colors.primary} />
        </LinearGradient>
      )}

      <View style={[styles.topRow, { top: insets.top + 8 }]}>
        {phase === 'ready' ? <RoundButton icon="close" onPress={onClose} label="Fechar" /> : <View style={{ width: 44 }} />}
        <View style={styles.headingPill}>
          <MaterialCommunityIcons name={sport.icon} size={16} color={colors.primary} />
          <Text style={styles.headingText} numberOfLines={1}>{heading}</Text>
        </View>
        <RoundButton icon="options-outline" onPress={() => setSettingsOpen(true)} label="Ajustes da gravação" />
      </View>

      {sport.gps ? (
        <View style={[styles.gpsChip, { top: insets.top + 62 }, weak || !here ? styles.gpsWeak : null]}>
          <View style={[styles.gpsDot, { backgroundColor: !here ? colors.textMuted : weak ? colors.warn : colors.success }]} />
          <Text style={styles.gpsText}>{perm === 'denied' ? 'Sem permissão de localização' : !here ? 'Procurando GPS…' : weak ? `GPS fraco · ±${Math.round(accuracy ?? 0)} m` : `GPS pronto · ±${Math.round(accuracy ?? 0)} m`}</Text>
        </View>
      ) : null}

      <View style={[styles.sheet, !showMap && { marginTop: -28 }]}>
        {phase === 'paused' ? (
          <View style={styles.pausedBar}>
            <Ionicons name="pause" size={14} color={colors.warnText} />
            <Text style={styles.pausedText}>Pausado</Text>
          </View>
        ) : (
          <View style={styles.handle} />
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Tempo</Text>
          <Text style={styles.clock} accessibilityLabel={`Tempo ${formatClock(elapsed)}`}>{formatClock(elapsed)}</Text>
          {subtitle ? <Muted style={styles.subtitle} numberOfLines={1}>{subtitle}</Muted> : null}

          {sport.gps ? (
            <View style={styles.pair}>
              <View style={styles.pairCell}>
                <Text style={styles.label}>{speed ? 'Velocidade' : 'Ritmo médio'}</Text>
                <Text style={styles.pairValue}>{speed ? kmh.toFixed(1).replace('.', ',') : formatPace(avg)}<Text style={styles.pairUnit}>{speed ? ' km/h' : ' /km'}</Text></Text>
              </View>
              <View style={styles.pairDivider} />
              <View style={styles.pairCell}>
                <Text style={styles.label}>Distância</Text>
                <Text style={styles.pairValue}>{formatKm(run.distanceM)}<Text style={styles.pairUnit}> km</Text></Text>
              </View>
            </View>
          ) : null}

          {sport.gps && phase !== 'ready' ? (
            <View style={styles.minor}>
              <Minor label={speed ? 'Máxima' : 'Ritmo atual'} value={speed ? `${(run.maxSpeedMs * 3.6).toFixed(1).replace('.', ',')} km/h` : `${formatPace(now)} /km`} />
              <Minor label="Subida" value={`${Math.round(run.elevationGainM)} m`} />
              <Minor label="Altitude" value={run.altitudeM != null ? `${Math.round(run.altitudeM)} m` : '–'} />
            </View>
          ) : null}

          {goalMeters && sport.gps ? (
            <View style={{ marginTop: 16, gap: 6 }}>
              <ProgressBar progress={Math.min(1, run.distanceM / goalMeters)} />
              <Muted style={{ fontSize: 12.5 }}>{`Meta do treino: ${formatKm(goalMeters)} km`}</Muted>
            </View>
          ) : null}

          {sport.gps && splits.length ? <Splits splits={splits} speed={speed} /> : null}

          {perm === 'denied' ? (
            <View style={styles.perm}>
              <Text style={styles.permText}>Para medir distância e desenhar o caminho, o Operax precisa da sua localização durante o treino.</Text>
              <Button label="Ajustes" variant="soft" compact onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}
          {phase === 'ready' && draft ? (
            <View style={styles.draft}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.draftTitle}>Treino não salvo</Text>
                  <Muted style={{ fontSize: 12.5 }}>
                    {[`Começou às ${new Date(draft.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, formatClock(Math.round(draft.banked / 1000)), sport.gps ? `${formatKm(draft.run.distanceM)} km` : null].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Retomar" compact icon="play" onPress={() => restore(draft)} style={{ flex: 1 }} />
                <Button label="Descartar" compact variant="secondary" onPress={clearDraft} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
          {!sport.gps && phase !== 'ready' ? (
            <View style={styles.timerInfo}>
              <Minor label="Começou às" value={new Date(startMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} />
              <Minor label="Situação" value={phase === 'paused' ? 'Pausado' : 'Gravando'} />
            </View>
          ) : null}
          {!sport.gps && phase === 'running' ? <Muted style={styles.readyHint}>Pode deixar o celular de lado. Toque em pausa quando terminar e conte como foi.</Muted> : null}
          {phase === 'ready' && !sport.gps && !draft ? <Muted style={styles.readyHint}>O cronômetro grava o tempo do treino. No fim você conta como foi, e o professor acompanha.</Muted> : null}
        </ScrollView>

        <View style={[styles.controls, { paddingBottom: insets.bottom + 18 }, locked && { opacity: 0 }]} pointerEvents={locked ? 'none' : 'auto'}>
          {phase === 'ready' ? (
            <BigButton label="Iniciar" icon="play" onPress={() => void start()} />
          ) : phase === 'running' ? (
            <>
              <SideButton icon="lock-closed-outline" label="Travar" onPress={() => setLocked(true)} />
              <BigButton icon="pause" tone="dark" accessibilityLabel="Pausar" onPress={pause} />
              <View style={{ width: 64 }} />
            </>
          ) : (
            <>
              <BigButton label="Continuar" icon="play" onPress={resume} />
              <BigButton label="Fim" icon="stop" tone="dark" onPress={finish} />
            </>
          )}
        </View>
      </View>

      {locked ? (
        <Pressable style={StyleSheet.absoluteFill} onLongPress={() => setLocked(false)} delayLongPress={700} accessibilityLabel="Tela travada. Toque e segure para destravar">
          <View style={[styles.lockPill, { bottom: insets.bottom + 40 }]}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
            <Text style={styles.lockText}>Tela travada · toque e segure para destravar</Text>
          </View>
        </Pressable>
      ) : null}

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} accessibilityLabel="Fechar ajustes" />
        <View style={[styles.settings, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.settingsTitle}>Ajustes da gravação</Text>
          <PrefRow title="Manter a tela acesa" subtitle="A tela não apaga enquanto o treino está gravando." value={prefs.keepAwake} onChange={(v) => changePref('keepAwake', v)} />
          {sport.gps ? <PrefRow title="Mostrar o mapa" subtitle="Sem o mapa, os números ficam maiores." value={prefs.showMap} onChange={(v) => changePref('showMap', v)} /> : null}
          {sport.gps && sport.rate === 'pace' ? <PrefRow title="Velocidade em vez de ritmo" subtitle="km/h no lugar de minutos por quilômetro." value={prefs.speed} onChange={(v) => changePref('speed', v)} /> : null}
          <Muted style={{ marginTop: 6, lineHeight: 18 }}>Com a tela bloqueada o celular pode parar o GPS. Use o botão Travar para guardar o celular no bolso sem tocar em nada.</Muted>
          <Button label="Pronto" onPress={() => setSettingsOpen(false)} style={{ marginTop: 14 }} />
        </View>
      </Modal>
    </Screen>
  );
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
  const pace = (s: { seconds: number; partial?: number }) => s.seconds / ((s.partial ?? 1000) / 1000);
  const full = splits.filter((s) => !s.partial);
  const best = full.length ? Math.min(...full.map(pace)) : null;
  return (
    <View style={styles.splits}>
      <View style={styles.rowBetween}>
        <Text style={styles.splitsTitle}>Parciais</Text>
        <Muted style={{ fontSize: 12 }}>{speed ? 'km · km/h' : 'km · ritmo'}</Muted>
      </View>
      {[...splits].reverse().slice(0, 6).map((s) => {
        const p = pace(s);
        const isBest = best != null && !s.partial && p === best && full.length > 1;
        return (
          <View key={s.km} style={styles.splitRow}>
            <Text style={styles.splitKm}>{s.partial ? `${s.km}*` : s.km}</Text>
            <Text style={styles.splitPace}>{speed ? (3600 / p).toFixed(1).replace('.', ',') : formatPace(p)}</Text>
            <View style={styles.splitTrack}>
              <View style={[styles.splitBar, { width: `${Math.max(12, Math.min(100, ((best ?? p) / p) * 100))}%` }, isBest && { backgroundColor: colors.success }, s.partial ? { opacity: 0.45 } : null]} />
            </View>
          </View>
        );
      })}
      {splits.some((s) => s.partial) ? <Muted style={{ fontSize: 11.5 }}>* quilômetro em andamento</Muted> : null}
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
  pausedBar: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.warnSoft, marginBottom: 8 },
  pausedText: { fontFamily: typography.fontFamilyBold, fontSize: 12.5, color: colors.warnText, letterSpacing: 0.3 },
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
