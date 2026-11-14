import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { clockLabel, HOUR_H, hourRange, layoutEvents, nowMinutes, relativeLabel, yFor } from './timeline';

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
export function DayTimeline({ events, bottomInset, header }: { events: DayEvent[]; bottomInset: number; header?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => nowMinutes());
  const [gridW, setGridW] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [nowVisible, setNowVisible] = useState(true);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const lastManual = useRef(0);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const [startHour, endHour] = useMemo(() => hourRange(events, now), [events, now]);
  const placed = useMemo(() => layoutEvents(events, startHour), [events, startHour]);
  const gridH = (endHour - startHour) * HOUR_H;
  const nowY = yFor(now, startHour);

  // A linha desliza até a nova posição em vez de pular a cada atualização.
  const lineY = useSharedValue(nowY);
  useEffect(() => {
    lineY.value = reduced ? nowY : withTiming(nowY, { duration: 1200, easing: Easing.bezier(0.45, 0, 0.15, 1) });
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
            <View key={i} style={[styles.hourRow, { top: i * HOUR_H }]} pointerEvents="none">
              <Text style={[styles.hourLabel, Math.abs(startHour * 60 + i * 60 - now) < 14 && { opacity: 0 }]}>{clockLabel((startHour + i) * 60)}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}

          <View style={styles.events} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
            {gridW
              ? placed.map((ev) => {
                  const tone = TONE[ev.tone];
                  const past = ev.endMin <= now;
                  const rel = relativeLabel(ev.startMin, ev.endMin, now);
                  const w = gridW / ev.lanes;
                  const compact = ev.height < 70 || ev.lanes > 1;
                  return (
                    <PressableScale
                      key={ev.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${clockLabel(ev.startMin)} a ${clockLabel(ev.endMin)}, ${ev.title}, ${ev.person}, ${ev.statusLabel}${rel ? `, ${rel}` : ''}`}
                      style={[
                        styles.card,
                        { top: ev.top + 2, height: ev.height, left: ev.lane * w + 2, width: w - 6, backgroundColor: past ? '#fafbfc' : '#fff' },
                        past && { opacity: 0.6 },
                        rel === 'Agora' && styles.cardNow,
                      ]}
                    >
                      <View style={[styles.stripe, { backgroundColor: tone.stripe }]} />
                      {ev.height < 62 ? (
                        // Curto (até ~40 min): hora e título numa linha só, centralizados.
                        <View style={[styles.cardBody, styles.cardTop, { justifyContent: 'center' }]}>
                          <Text style={styles.cardTime}>{clockLabel(ev.startMin)}</Text>
                          <Text style={[styles.cardTitle, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
                            {ev.title}
                            <Text style={styles.cardPersonInline}>{` · ${ev.person}`}</Text>
                          </Text>
                          {rel ? (
                            <View style={[styles.rel, { marginLeft: 0 }, rel === 'Agora' && { backgroundColor: colors.primary }]}>
                              <Text style={[styles.relText, rel === 'Agora' && { color: '#fff' }]}>{rel}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.cardBody}>
                          <View style={styles.cardTop}>
                            <Text style={styles.cardTime}>{`${clockLabel(ev.startMin)}–${clockLabel(ev.endMin)}`}</Text>
                            {rel ? (
                              <View style={[styles.rel, rel === 'Agora' && { backgroundColor: colors.primary }]}>
                                <Text style={[styles.relText, rel === 'Agora' && { color: '#fff' }]}>{rel}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.cardTitle} numberOfLines={compact ? 1 : 2}>
                            {ev.title}
                            {compact ? <Text style={styles.cardPersonInline}>{` · ${ev.person}`}</Text> : null}
                          </Text>
                          {!compact ? (
                            <>
                              <Text style={styles.cardPerson} numberOfLines={1}>
                                {ev.location ? `${ev.person} · ${ev.location}` : ev.person}
                              </Text>
                              {ev.height >= 110 ? (
                                <View style={[styles.status, { backgroundColor: tone.soft }]}>
                                  <Text style={[styles.statusText, { color: tone.text }]}>{ev.statusLabel}</Text>
                                </View>
                              ) : null}
                            </>
                          ) : null}
                        </View>
                      )}
                    </PressableScale>
                  );
                })
              : null}
          </View>

          {/* Linha da hora atual: pílula com a hora na coluna das horas e o traço azul até a borda. */}
          <Animated.View pointerEvents="none" style={[styles.nowWrap, lineStyle]} accessible accessibilityLabel={`Agora, ${clockLabel(now)}`}>
            <View style={styles.nowPill}>
              <Text style={styles.nowPillText}>{clockLabel(now)}</Text>
            </View>
            <View style={styles.nowDot} />
            <View style={styles.nowLine} />
          </Animated.View>
        </View>
      </ScrollView>

      {!nowVisible ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={[styles.nowBtnWrap, { bottom: bottomInset + 12 }]}>
          <PressableScale onPress={() => scrollToNow(true)} accessibilityRole="button" accessibilityLabel="Voltar para a hora atual" style={styles.nowBtn}>
            <Ionicons name="time" size={16} color="#fff" />
            <Text style={styles.nowBtnText}>Agora</Text>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { marginTop: 22, marginHorizontal: 16 },
  hourRow: { position: 'absolute', left: 0, right: 0, height: 1, flexDirection: 'row', alignItems: 'center' },
  hourLabel: {
    width: HOURS_COL,
    marginTop: -1,
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
  cardBody: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTime: { ...text.label, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  rel: { marginLeft: 'auto', paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: colors.primaryWash, justifyContent: 'center' },
  relText: { fontFamily: typography.fontFamilyBold, fontSize: 10.5, color: colors.primary },
  cardTitle: { ...text.calloutStrong, color: colors.text, marginTop: 2 },
  cardPersonInline: { fontFamily: typography.fontFamily, color: colors.textSoft },
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
