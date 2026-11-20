import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useId } from 'react';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import i18n from '@/src/i18n';
import { colors, typography } from '@/src/design-system/tokens';
import { formatClock, formatKg } from '@/src/shared/format';
import { pathOf, projectRoute } from '@/src/features/fitness/routeProjection';
import { distanceLabel, intLabel } from '../format';
import type { ShareActivity } from '../types';

export type Stat = { label: string; value: string };


/** Números da atividade, na ordem em que aparecem nos modelos; só o que existe. */
export function statsOf(a: ShareActivity): Stat[] {
  const out: Stat[] = [];
  if (a.gps) {
    out.push({ label: i18n.t('fitness:share.stat.distance'), value: distanceLabel(a.gps.distanceM) });
    const isSpeed = a.gps.rateLabel === a.gps.speedLabel && a.gps.speedLabel != null;
    out.push({ label: isSpeed ? i18n.t('fitness:share.stat.speed') : i18n.t('fitness:share.stat.pace'), value: a.gps.rateLabel });
    out.push({ label: i18n.t('fitness:share.stat.time'), value: formatClock(a.seconds) });
    if (a.gps.elevationGainM != null && a.gps.elevationGainM > 0) out.push({ label: i18n.t('fitness:share.stat.climb'), value: `${intLabel(a.gps.elevationGainM)} m` });
    if (a.gps.avgHr != null) out.push({ label: i18n.t('fitness:share.stat.avgHr'), value: `${intLabel(a.gps.avgHr)} bpm` });
  } else {
    out.push({ label: i18n.t('fitness:share.stat.time'), value: formatClock(a.seconds) });
    const s = a.strength;
    if (s?.volumeKg != null && s.volumeKg > 0) out.push({ label: i18n.t('fitness:share.stat.volume'), value: `${formatKg(s.volumeKg)} kg` });
    if (s?.setsDone != null) out.push({ label: i18n.t('fitness:share.stat.sets'), value: s.setsTotal != null ? `${s.setsDone}/${s.setsTotal}` : String(s.setsDone) });
  }
  // Por último, para não tirar do lugar os números que os modelos já mostram.
  if (a.energyKcal != null && a.energyKcal > 0) out.push({ label: i18n.t('fitness:share.stat.calories'), value: `${intLabel(a.energyKcal)} kcal` });
  return out;
}

/** Números do modelo "percurso por trás", na ordem da referência: distância, subida, tempo, potência (ou FC), velocidade/ritmo e calorias. */
export function routeBehindStats(a: ShareActivity): Stat[] {
  const all = statsOf(a);
  const pick = (...keys: string[]) => all.find((s) => keys.some((k) => s.label === i18n.t(`fitness:share.stat.${k}` as never)));
  const g = a.gps!;
  const power = g.avgPowerW != null && g.avgPowerW > 0 ? { label: i18n.t('fitness:share.stat.avgPower'), value: `${intLabel(g.avgPowerW)} W` } : null;
  const rate = pick('speed', 'pace');
  return [pick('distance'), pick('climb'), pick('time'), power ?? pick('avgHr'), rate?.value === '–' ? undefined : rate, pick('calories')].filter((s): s is Stat => !!s);
}

export const shadow: TextStyle = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 };

export function Brand({ company, color = '#fff', style }: { company: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <Text style={[styles.brand, { color }, color === '#fff' && shadow]} numberOfLines={1}>
        {company.toUpperCase()}
      </Text>
      <Text style={[styles.brandSub, { color }, color === '#fff' && shadow]}>OPERAX</Text>
    </View>
  );
}

export function StatStack({ stats, color = '#fff', size = 1 }: { stats: Stat[]; color?: string; size?: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 34 * size }}>
      {stats.map((s) => (
        <View key={s.label} style={{ alignItems: 'center' }}>
          <Text style={[styles.statLabel, { color, fontSize: 40 * size }, color === '#fff' && shadow]}>{s.label}</Text>
          <Text style={[styles.statValue, { color, fontSize: 116 * size }, color === '#fff' && shadow]} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function StatRow({ stats, color = '#fff' }: { stats: Stat[]; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 56 }}>
      {stats.slice(0, 3).map((s) => (
        <View key={s.label} style={{ alignItems: 'center' }}>
          <Text style={[styles.statLabel, { color, fontSize: 34 }, color === '#fff' && shadow]}>{s.label}</Text>
          <Text style={[styles.statValue, { color, fontSize: 72 }, color === '#fff' && shadow]} numberOfLines={1}>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Traçado da rota com contorno branco, largada e chegada; fundo transparente, a menos que `grid`. */
export function RouteLine({ route, w, h, stroke = 18, grid = false, plain = false }: { route: [number, number][]; w: number; h: number; stroke?: number; grid?: boolean; plain?: boolean }) {
  const pad = stroke * 2 + 10;
  const xy = projectRoute(route, w, h, { side: pad, top: pad, bottom: pad });
  const d = pathOf(xy);
  const start = xy[0];
  const end = xy.length > 1 ? xy[xy.length - 1] : null;
  const cell = 72;
  // Id próprio por desenho: na grade vários modelos têm rota, e no web o id do degradê vale para a página toda.
  const gid = `shareRoute${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.cyan} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      {grid
        ? [
            ...Array.from({ length: Math.ceil(w / cell) }, (_, i) => <Line key={`v${i}`} x1={i * cell} y1={0} x2={i * cell} y2={h} stroke="#dfe7f5" strokeWidth={2} />),
            ...Array.from({ length: Math.ceil(h / cell) }, (_, i) => <Line key={`h${i}`} x1={0} y1={i * cell} x2={w} y2={i * cell} stroke="#dfe7f5" strokeWidth={2} />),
          ]
        : null}
      {d && !plain ? <Path d={d} stroke="#ffffff" strokeWidth={stroke * 1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      {d ? <Path d={d} stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      {start && !plain ? <Circle cx={start.x} cy={start.y} r={stroke * 0.9} fill="#ffffff" stroke={colors.success} strokeWidth={stroke * 0.5} /> : null}
      {end && !plain ? <Circle cx={end.x} cy={end.y} r={stroke * 0.9} fill={colors.chromeNavy} stroke="#ffffff" strokeWidth={stroke * 0.4} /> : null}
    </Svg>
  );
}

export function SplitBars({ splits, kind = 'km', color = '#fff' }: { splits: { index: number; seconds: number }[]; kind?: 'laps' | 'km' | '100m'; color?: string }) {
  const shown = splits.slice(0, 12);
  const fastest = Math.min(...shown.map((s) => s.seconds));
  const slowest = Math.max(...shown.map((s) => s.seconds));
  return (
    <View style={{ width: 860, gap: 18 }}>
      <Text style={[styles.statLabel, { color, fontSize: 44, marginBottom: 10 }, color === '#fff' && shadow]}>{i18n.t(kind === 'laps' ? 'fitness:share.splitsLaps' : kind === '100m' ? 'fitness:share.splits100m' : 'fitness:share.splitsTitle')}</Text>
      {shown.map((s) => {
        const ratio = slowest === fastest ? 1 : 0.45 + 0.55 * ((slowest - s.seconds) / (slowest - fastest));
        return (
          <View key={s.index} style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
            <Text style={[styles.splitKm, { color }, color === '#fff' && shadow]}>{s.index}</Text>
            <View style={{ flex: 1, height: 52, justifyContent: 'center' }}>
              <View style={{ width: `${Math.round(ratio * 100)}%`, height: 52, borderRadius: 14, backgroundColor: s.seconds === fastest ? colors.cyan : colors.primary }} />
            </View>
            <Text style={[styles.splitTime, { color }, color === '#fff' && shadow]}>{formatClock(s.seconds)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function VolumeBars({ bars, color = '#fff' }: { bars: { label: string; kg: number }[]; color?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.kg));
  return (
    <View style={{ width: 860 }}>
      <Text style={[styles.statLabel, { color, fontSize: 44, textAlign: 'center' }, color === '#fff' && shadow]}>{i18n.t('fitness:share.volumeTitle')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 28, height: 520, marginTop: 40 }}>
        {bars.map((b, i) => {
          const today = i === bars.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 16 }}>
              {today ? <Text style={[styles.splitTime, { color }, color === '#fff' && shadow]}>{`${formatKg(b.kg)}`}</Text> : null}
              <View style={{ width: '100%', height: Math.max(24, (b.kg / max) * 400), borderRadius: 20, backgroundColor: today ? colors.cyan : color === '#fff' ? 'rgba(255,255,255,0.85)' : '#c9d6f2' }} />
              <Text style={[styles.barLabel, { color }, color === '#fff' && shadow]}>{b.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function Records({ records, color = '#fff' }: { records: { name: string; kg: number }[]; color?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 30, width: 900 }}>
      <Text style={[styles.statLabel, { color, fontSize: 46 }, color === '#fff' && shadow]}>{i18n.t('fitness:share.recordsTitle', { count: records.length })}</Text>
      {records.slice(0, 5).map((r) => (
        <View key={r.name} style={{ alignItems: 'center' }}>
          <Text style={[styles.recordName, { color }, color === '#fff' && shadow]} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[styles.statValue, { color, fontSize: 96 }, color === '#fff' && shadow]}>{`${formatKg(r.kg)} kg`}</Text>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  canvas: { width: 1080, height: 1920, overflow: 'hidden' },
  brand: { fontFamily: typography.fontFamilyBold, fontSize: 40, letterSpacing: 8 },
  brandSub: { fontFamily: typography.fontFamilySemiBold, fontSize: 26, letterSpacing: 10, marginTop: 8, opacity: 0.85 },
  statLabel: { fontFamily: typography.fontFamilySemiBold, letterSpacing: 1 },
  statValue: { fontFamily: typography.fontFamilyBold, letterSpacing: -1 },
  splitKm: { width: 56, fontFamily: typography.fontFamilyBold, fontSize: 38, textAlign: 'right' },
  splitTime: { width: 150, fontFamily: typography.fontFamilyBold, fontSize: 38 },
  barLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 30 },
  recordName: { fontFamily: typography.fontFamilySemiBold, fontSize: 48, maxWidth: 900 },
  title: { fontFamily: typography.fontFamilyBold, fontSize: 76, letterSpacing: -1 },
  sub: { fontFamily: typography.fontFamilySemiBold, fontSize: 38 },
});
