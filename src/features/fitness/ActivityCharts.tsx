import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient as SvgLinear, Path, Rect, Stop } from 'react-native-svg';
import { Card, Muted } from '@/src/design-system/ui';
import { colors, numbers, text, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { formatClock } from '@/src/shared/format';
import { formatPace } from './runTracker';
import type { ActivityDetail, ChartPoint, SeriesKey } from './types';

/** Cores das cinco zonas de frequência, da leve (azul) à máxima (vermelho). */
export const ZONE_COLORS = ['#7aa7ff', '#1e9e8f', '#e3a008', '#ea6a1f', '#dc2626'] as const;

const HEIGHT = 150;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PAD_LEFT = 44;
const PAD_RIGHT = 8;

type Metric = { key: SeriesKey; title: string; unit: string; color: string; invert?: boolean; format: (v: number) => string };

/** Valor da série mais perto do instante (busca binária: as séries vêm em ordem de tempo). */
export function valueAt(points: ChartPoint[], t: number): number | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] < t) lo = mid; else hi = mid;
  }
  return Math.abs(points[lo][0] - t) <= Math.abs(points[hi][0] - t) ? points[lo][1] : points[hi][1];
}

/** Faixa do eixo: corta os 3% mais extremos de cada lado (largada parada, pico do GPS) para o desenho não achatar. */
export function domainOf(values: number[], trim: boolean): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  const cut = trim && sorted.length > 30 ? Math.floor(sorted.length * 0.03) : 0;
  let lo = sorted[cut];
  let hi = sorted[sorted.length - 1 - cut];
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

const avg = (pts: ChartPoint[]) => pts.reduce((a, p) => a + p[1], 0) / pts.length;

/** Os gráficos do treino, com um cursor só para todos: arrastar num deles mostra o mesmo instante nos outros. */
export function ActivityCharts({ detail }: { detail: ActivityDetail }) {
  const { t } = useTranslation('fitness');
  const [cursor, setCursor] = useState<number | null>(null);
  const nf = (digits: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const rateMetric: Metric =
    detail.rate_unit === 'kmh'
      ? { key: 'rate', title: t('charts.speed'), unit: 'km/h', color: colors.primary, format: (v) => nf(1).format(v) }
      : { key: 'rate', title: t('charts.pace'), unit: detail.rate_unit === 'min_km' ? '/km' : detail.rate_unit === 'min_100m' ? '/100 m' : '/500 m', color: colors.primary, invert: true, format: (v) => formatPace(v) };
  const metrics: Metric[] = [
    rateMetric,
    { key: 'hr', title: t('charts.hr'), unit: 'bpm', color: colors.danger, format: (v) => String(Math.round(v)) },
    { key: 'alt', title: t('charts.altitude'), unit: 'm', color: '#0f766e', format: (v) => String(Math.round(v)) },
    { key: 'cad', title: t('charts.cadence'), unit: detail.sport === 'bike' ? 'rpm' : 'spm', color: '#7c3aed', format: (v) => String(Math.round(v)) },
    { key: 'pw', title: t('charts.power'), unit: 'W', color: '#ea6a1f', format: (v) => String(Math.round(v)) },
  ];
  const shown = metrics.filter((m) => (detail.series?.[m.key]?.length ?? 0) >= 2);
  if (!shown.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {shown.map((m) => (
        <MetricChart key={m.key} metric={m} points={detail.series![m.key]!} total={detail.seconds} cursor={cursor} onCursor={setCursor} zones={m.key === 'hr' ? detail.zones : null} />
      ))}
      <Muted style={{ textAlign: 'center', fontSize: 12 }}>{t('charts.dragHint')}</Muted>
    </View>
  );
}

function MetricChart({ metric, points, total, cursor, onCursor, zones }: {
  metric: Metric; points: ChartPoint[]; total: number; cursor: number | null; onCursor: (t: number | null) => void; zones: ActivityDetail['zones'];
}) {
  const { t } = useTranslation('fitness');
  const [width, setWidth] = useState(0);
  const span = Math.max(total, points[points.length - 1][0], 1);
  const values = points.map((p) => p[1]);
  const [lo, hi] = useMemo(() => domainOf(values, metric.key === 'rate'), [values, metric.key]);
  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (s: number) => PAD_LEFT + (s / span) * plotW;
  const y = (v: number) => {
    const c = Math.min(hi, Math.max(lo, v));
    const f = (c - lo) / (hi - lo);
    return PAD_TOP + (metric.invert ? f : 1 - f) * plotH;
  };
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const base = PAD_TOP + plotH;
  const area = `${line} L${x(points[points.length - 1][0]).toFixed(1)} ${base} L${x(points[0][0]).toFixed(1)} ${base} Z`;
  const mean = avg(points);
  const best = metric.invert ? Math.min(...values) : Math.max(...values);
  const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * (metric.invert ? f : 1 - f));
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => span * f);
  const gid = `g-${metric.key}`;

  const pan = useMemo(() => {
    const move = (px: number) => {
      const w = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
      const f = Math.min(1, Math.max(0, (px - PAD_LEFT) / w));
      onCursor(f * span);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Só pega o arrasto quando ele é mais de lado que de pé: o resto continua rolando a tela.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (e) => move(e.nativeEvent.locationX),
      onPanResponderMove: (e) => move(e.nativeEvent.locationX),
      onPanResponderRelease: () => onCursor(null),
      onPanResponderTerminate: () => onCursor(null),
    });
  }, [width, span, onCursor]);

  const at = cursor == null ? null : valueAt(points, cursor);
  // Frequência: a linha muda de cor na altura de cada zona.
  const zoneStops = zones?.length && !metric.invert
    ? [...zones].sort((a, b) => b.zone - a.zone).flatMap((z) => {
        // De cima (zona 5) para baixo: os pontos de cor precisam vir em ordem crescente.
        const top = Math.min(1, Math.max(0, (y(z.to_bpm) - PAD_TOP) / plotH));
        const bottom = Math.min(1, Math.max(0, (y(z.from_bpm) - PAD_TOP) / plotH));
        const c = ZONE_COLORS[z.zone - 1];
        return [<Stop key={`a${z.zone}`} offset={top} stopColor={c} />, <Stop key={`b${z.zone}`} offset={bottom} stopColor={c} />];
      })
    : null;

  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{metric.title}</Text>
        {cursor != null ? <Muted style={{ fontSize: 12 }}>{formatClock(Math.round(cursor))}</Muted> : null}
      </View>
      <View style={styles.figures}>
        <Figure label={cursor != null ? t('charts.now') : t('charts.avg')} value={metric.format(at ?? mean)} unit={metric.unit} strong />
        <Figure label={metric.invert ? t('charts.fastest') : t('charts.max')} value={metric.format(best)} unit={metric.unit} />
        {metric.key === 'alt' ? <Figure label={t('charts.min')} value={metric.format(Math.min(...values))} unit={metric.unit} /> : null}
      </View>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={t('charts.a11y', { title: metric.title, avg: metric.format(mean), unit: metric.unit })}
        {...pan.panHandlers}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <SvgLinear id={`${gid}-fill`} x1="0" y1={metric.invert ? '1' : '0'} x2="0" y2={metric.invert ? '0' : '1'}>
                <Stop offset="0" stopColor={metric.color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={metric.color} stopOpacity={0.02} />
              </SvgLinear>
              {zoneStops ? (
                <SvgLinear id={`${gid}-stroke`} x1="0" y1={PAD_TOP} x2="0" y2={PAD_TOP + plotH} gradientUnits="userSpaceOnUse">
                  {zoneStops}
                </SvgLinear>
              ) : null}
            </Defs>
            {ticks.map((v, i) => {
              const yy = PAD_TOP + (i / 2) * plotH;
              return <Line key={i} x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={yy} y2={yy} stroke={colors.borderSoft} strokeWidth={1} />;
            })}
            <Path d={metric.invert ? `${line} L${x(points[points.length - 1][0]).toFixed(1)} ${PAD_TOP} L${x(points[0][0]).toFixed(1)} ${PAD_TOP} Z` : area} fill={`url(#${gid}-fill)`} />
            <Line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(mean)} y2={y(mean)} stroke={metric.color} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 4" />
            <Path d={line} stroke={zoneStops ? `url(#${gid}-stroke)` : metric.color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {cursor != null && at != null ? (
              <>
                <Line x1={x(cursor)} x2={x(cursor)} y1={PAD_TOP} y2={base} stroke={colors.text} strokeOpacity={0.5} strokeWidth={1} />
                <Rect x={x(cursor) - 4} y={y(at) - 4} width={8} height={8} rx={4} fill="#fff" stroke={metric.color} strokeWidth={2.5} />
              </>
            ) : null}
          </Svg>
        ) : null}
        {width > 0
          ? ticks.map((v, i) => (
              <Text key={`y${i}`} style={[styles.yLabel, { top: PAD_TOP + (i / 2) * plotH - 7 }]} numberOfLines={1}>{metric.format(v)}</Text>
            ))
          : null}
        {width > 0
          ? timeTicks.map((s, i) => (
              <Text key={`x${i}`} style={[styles.xLabel, { left: Math.min(width - 40, Math.max(PAD_LEFT - 12, x(s) - 20)) }]}>{formatClock(Math.round(s)).replace(/^00:/, '0:')}</Text>
            ))
          : null}
      </View>
    </Card>
  );
}

function Figure({ label, value, unit, strong }: { label: string; value: string; unit: string; strong?: boolean }) {
  return (
    <View style={{ minWidth: 86 }}>
      <Muted style={{ fontSize: 11.5 }}>{label}</Muted>
      <Text style={[strong ? styles.figStrong : styles.fig]}>
        {value}
        <Text style={styles.unit}>{` ${unit}`}</Text>
      </Text>
    </View>
  );
}

/** Tempo em cada zona de frequência: barra proporcional ao tempo, com a faixa de batimentos. */
export function HrZonesCard({ detail }: { detail: ActivityDetail }) {
  const { t } = useTranslation('fitness');
  const zones = detail.zones;
  if (!zones?.length) return null;
  const totalZ = zones.reduce((a, z) => a + z.seconds, 0);
  if (!totalZ) return null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('charts.zones')}</Text>
        {detail.hr_max_used ? <Muted style={{ fontSize: 12 }}>{t('charts.hrMaxUsed', { bpm: detail.hr_max_used })}</Muted> : null}
      </View>
      {[...zones].reverse().map((z) => {
        const pct = Math.round((z.seconds / totalZ) * 100);
        return (
          <View key={z.zone} style={styles.zoneRow}>
            <Text style={[styles.zoneName, { color: ZONE_COLORS[z.zone - 1] }]}>{`Z${z.zone}`}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.zoneTrack}>
                <View style={[styles.zoneBar, { width: `${Math.max(pct ? 3 : 0, pct)}%`, backgroundColor: ZONE_COLORS[z.zone - 1] }]} />
              </View>
              <Muted style={{ fontSize: 11 }}>{`${t(`charts.zone${z.zone}`)} · ${z.from_bpm}–${z.to_bpm} bpm`}</Muted>
            </View>
            <View style={{ width: 62, alignItems: 'flex-end' }}>
              <Text style={styles.zoneTime}>{formatClock(z.seconds)}</Text>
              <Muted style={{ fontSize: 11 }}>{`${pct}%`}</Muted>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...text.section, color: colors.text },
  figures: { flexDirection: 'row', gap: 18, marginBottom: 4 },
  figStrong: { marginTop: 1, ...numbers.md, color: colors.text },
  fig: { marginTop: 1, ...numbers.sm, color: colors.textSoft },
  unit: { fontFamily: typography.fontFamilyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0 },
  yLabel: { position: 'absolute', left: 0, width: PAD_LEFT - 6, textAlign: 'right', ...numbers.xs, fontSize: 10.5, color: colors.textMuted },
  xLabel: { position: 'absolute', bottom: 2, width: 40, textAlign: 'center', ...numbers.xs, fontSize: 10.5, color: colors.textMuted },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneName: { width: 26, ...numbers.sm },
  zoneTrack: { height: 10, borderRadius: 5, backgroundColor: '#eef2f8', overflow: 'hidden' },
  zoneBar: { height: 10, borderRadius: 5 },
  zoneTime: { ...numbers.xs, color: colors.text },
});
