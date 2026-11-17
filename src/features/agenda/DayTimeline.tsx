import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { buildAxis, clockLabel, hourRange, layoutEvents, nowMinutes, relativeLabel, yAt } from './timeline';

export type DayEvent = {
  id: string;
  startMin: number;
  endMin: number;
  title: string;
  person: string;
  location?: string;
  statusLabel: string;
  tone: 'success' | 'warn' | 'danger' | 'neutral' | 'primary';
};

const HOURS_COL = 56;
const CARD_PAD_V = 7;
const HOUR_ROW_H = 18;
const TICK_MS = 15_000;
/** Depois de rolar com o dedo, a agenda espera isso antes de voltar a seguir o relógio. */
const MANUAL_HOLD_MS = 45_000;

const TONE = {
  success: { stripe: '#16a34a', soft: '#effaf3', text: colors.success },
  warn: { stripe: '#ea580c', soft: '#fff6ee', text: colors.warnText },
  danger: { stripe: '#dc2626', soft: '#fdf1f1', text: colors.dangerText },
  neutral: { stripe: '#94a3b8', soft: '#f4f6f9', text: colors.textMuted },
  primary: { stripe: colors.primary, soft: colors.primaryWash, text: colors.primaryDeep },
} as const;

/**
 * Dia em linha do tempo: grade de horas, compromissos na altura do horário e a linha azul da
 * hora atual, que desce sozinha. Abre já na hora atual e continua acompanhando o relógio
 * enquanto a pessoa não rola; se ela rolar para longe, aparece o botão "Agora".
 */
export function DayTimeline({
  events,
  bottomInset,
  header,
  onPressEvent,
  day = 'today',
}: {
  events: DayEvent[];
  bottomInset: number;
  header?: React.ReactNode;
  /** Outro dia que não hoje: sem a linha da hora atual nem "daqui a pouco"; tudo é passado ou futuro. */
  day?: 'today' | 'past' | 'future';
  /** Toque no cartão: abre a ficha do agendamento. */
  onPressEvent?: (id: string) => void;
}) {
  const { t } = useTranslation('agenda');
  const reduced = useReducedMotion();
  const [clock, setNow] = useState(() => nowMinutes());
  const isToday = day === 'today';
  // Fora de hoje não existe "agora": tudo é passado (dia anterior) ou ainda vai acontecer (dia à frente).
  const now = isToday ? clock : day === 'past' ? 24 * 60 : 0;
  const [gridW, setGridW] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [nowVisible, setNowVisible] = useState(true);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const lastManual = useRef(0);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowMinutes()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Altura que o texto de cada cartão precisa (medida na tela); a escala do dia abre espaço para ela.
  const [needs, setNeeds] = useState<Record<string, number>>({});
  const reportNeed = useCallback((id: string, h: number) => {
    setNeeds((prev) => (Math.abs((prev[id] ?? 0) - h) < 1 ? prev : { ...prev, [id]: h }));
  }, []);

  const [startHour, endHour] = useMemo(() => hourRange(events, isToday ? now : (events[0]?.startMin ?? 8 * 60)), [events, now, isToday]);
  const axis = useMemo(
    () => buildAxis(events.map((e) => ({ ...e, need: needs[e.id] ? needs[e.id] + CARD_PAD_V * 2 + 3 : 0 })), startHour, endHour),
    [events, needs, startHour, endHour],
  );
  const placed = useMemo(() => layoutEvents(events, axis), [events, axis]);
  const gridH = yAt(axis, endHour * 60);
  const nowY = yAt(axis, isToday ? now : (events[0]?.startMin ?? 8 * 60));

  // A linha desliza até a nova posição em vez de pular a cada atualização.
  const lineY = useSharedValue(nowY);
  useEffect(() => {
    lineY.set(reduced ? nowY : withTiming(nowY, { duration: 1200, easing: Easing.bezier(0.45, 0, 0.15, 1) }));
  }, [nowY, reduced, lineY]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lineY.value }] }));

  const targetFor = useCallback((y: number) => Math.max(0, headerH + y - viewH * 0.3), [headerH, viewH]);

  const scrollToNow = useCallback(
    (animated = true) => {
      scrollRef.current?.scrollTo({ y: targetFor(nowY), animated });
      lastManual.current = 0;
    },
    [nowY, targetFor],
  );

  // Abre na hora atual.
  useEffect(() => {
    if (didInitialScroll.current || !viewH) return;
    didInitialScroll.current = true;
    requestAnimationFrame(() => scrollToNow(false));
  }, [viewH, scrollToNow]);

  // Segue o relógio: se a linha está saindo da tela e ninguém mexeu há pouco, acompanha.
  useEffect(() => {
    if (!viewH || !didInitialScroll.current) return;
    if (Date.now() - lastManual.current < MANUAL_HOLD_MS) return;
    const lineOnScreen = headerH + nowY - scrollY.current;
    if (lineOnScreen < 80 || lineOnScreen > viewH - bottomInset - 60) scrollToNow(true);
  }, [nowY, viewH, headerH, bottomInset, scrollToNow]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    const lineOnScreen = headerH + nowY - scrollY.current;
    const visible = lineOnScreen > 0 && lineOnScreen < viewH - bottomInset;
    if (visible !== nowVisible) setNowVisible(visible);
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setViewH(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onScrollBeginDrag={() => (lastManual.current = Date.now())}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>{header}</View>
        <View style={[styles.grid, { height: gridH + 16 }]}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => (
            <View key={i} style={[styles.hourRow, { top: yAt(axis, (startHour + i) * 60) - HOUR_ROW_H / 2 }]} pointerEvents="none">
              <Text style={[styles.hourLabel, Math.abs(startHour * 60 + i * 60 - now) < 14 && { opacity: 0 }]}>{clockLabel((startHour + i) * 60)}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}

          <View style={styles.events} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
            {gridW
              ? placed.map((ev) => {
                  const tone = TONE[ev.tone];
                  const past = ev.endMin <= now;
                  const rel = isToday ? relativeLabel(ev.startMin, ev.endMin, now) : null;
                  const isNow = rel === t('timeline.now');
                  const w = gridW / ev.lanes;
                  return (
                    <PressableScale
                      key={ev.id}
                      onPress={() => onPressEvent?.(ev.id)}
                      accessibilityHint={t('timeline.opensDetails')}
                      accessibilityRole="button"
                      accessibilityLabel={t(rel ? 'timeline.eventLabelRel' : 'timeline.eventLabel', { start: clockLabel(ev.startMin), end: clockLabel(ev.endMin), title: ev.title, person: ev.person, status: ev.statusLabel, rel: rel ?? '' })}
                      style={[
                        styles.card,
                        { top: ev.top + 2, height: ev.height, left: ev.lane * w + 2, width: w - 6, backgroundColor: past ? '#fafbfc' : '#fff' },
                        past && { opacity: 0.6 },
                        isNow && styles.cardNow,
                      ]}
                    >
                      <View style={[styles.stripe, { backgroundColor: tone.stripe }]} />
                      <View style={styles.cardBody}>
                        {/* Texto sempre inteiro (quebra linha, nunca corta); a altura medida volta para a escala do dia. */}
                        <View onLayout={(e) => reportNeed(ev.id, e.nativeEvent.layout.height)}>
                          <View style={styles.cardTop}>
                            <Text style={[styles.cardTime, { flexShrink: 1 }]}>{`${clockLabel(ev.startMin)}–${clockLabel(ev.endMin)}`}</Text>
                            {rel ? (
                              <View style={[styles.rel, isNow && { backgroundColor: colors.primary }]}>
                                <Text style={[styles.relText, isNow && { color: '#fff' }]}>{rel}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.cardTitle}>{ev.title}</Text>
                          <Text style={styles.cardPerson}>{ev.location ? `${ev.person} · ${ev.location}` : ev.person}</Text>
                        </View>
                        {ev.height - (needs[ev.id] ?? ev.height) >= 40 ? (
                          <View style={[styles.status, { backgroundColor: tone.soft }]}>
                            <Text style={[styles.statusText, { color: tone.text }]}>{ev.statusLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    </PressableScale>
                  );
                })
              : null}
          </View>

          {/* Linha da hora atual: pílula com a hora na coluna das horas e o traço azul até a borda. */}
          {isToday ? (
          <Animated.View pointerEvents="none" style={[styles.nowWrap, lineStyle]} accessible accessibilityLabel={t('timeline.nowAt', { time: clockLabel(now) })}>
            <View style={styles.nowPill}>
              <Text style={styles.nowPillText}>{clockLabel(now)}</Text>
            </View>
            <View style={styles.nowDot} />
            <View style={styles.nowLine} />
          </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      {isToday && !nowVisible ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={[styles.nowBtnWrap, { bottom: bottomInset + 12 }]}>
          <PressableScale onPress={() => scrollToNow(true)} accessibilityRole="button" accessibilityLabel={t('timeline.backToNow')} style={styles.nowBtn}>
            <Ionicons name="time" size={16} color="#fff" />
            <Text style={styles.nowBtnText}>{t('timeline.now')}</Text>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { marginTop: 22, marginHorizontal: 16 },
  // A linha tem a altura do texto: com 1 px o iPhone cortava os rótulos das horas (sumiam).
  hourRow: { position: 'absolute', left: 0, right: 0, height: HOUR_ROW_H, flexDirection: 'row', alignItems: 'center' },
  hourLabel: {
    width: HOURS_COL,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11.5,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#dfe5ee' },
  events: { position: 'absolute', top: 0, bottom: 0, left: HOURS_COL, right: 0 },
  card: { position: 'absolute', flexDirection: 'row', borderRadius: 14, overflow: 'hidden', ...shadows.card },
  cardNow: { borderWidth: 1.5, borderColor: colors.primary },
  stripe: { width: 4 },
  cardBody: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: CARD_PAD_V },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTime: { ...text.label, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  rel: { marginLeft: 'auto', paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: colors.primaryWash, justifyContent: 'center' },
  relText: { fontFamily: typography.fontFamilyBold, fontSize: 10.5, color: colors.primary },
  cardTitle: { ...text.calloutStrong, color: colors.text, marginTop: 2 },
  cardPerson: { ...text.caption, color: colors.textSoft, marginTop: 1 },
  status: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, height: 22, borderRadius: 11, justifyContent: 'center' },
  statusText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5 },
  nowWrap: { position: 'absolute', left: 0, right: 0, top: -10, height: 20, flexDirection: 'row', alignItems: 'center' },
  nowPill: {
    width: HOURS_COL - 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  nowPillText: { fontFamily: typography.fontFamilyBold, fontSize: 11, color: '#fff', fontVariant: ['tabular-nums'] },
  nowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginLeft: 1, borderWidth: 2, borderColor: '#fff' },
  nowLine: { flex: 1, height: 2, backgroundColor: colors.primary, marginLeft: -2, borderRadius: 1 },
  nowBtnWrap: { position: 'absolute', alignSelf: 'center' },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  nowBtnText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: '#fff' },
});
