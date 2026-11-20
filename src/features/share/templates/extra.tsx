import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import i18n, { locale } from '@/src/i18n';
import { colors, typography } from '@/src/design-system/tokens';
import { formatClock, longDate } from '@/src/shared/format';
import { formatPace } from '@/src/features/fitness/runTracker';
import type { ShareActivity, TemplateProps } from '../types';
import { Brand, statsOf, styles as base } from './parts';

const MONO = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });
/** Texto do compartilhar por chave montada (as chaves estão em `fitness:share`). */
const tr = (k: string, o?: Record<string, unknown>): string => String(i18n.t(`fitness:share.${k}` as never, o as never));
const kmNumber = (m: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m / 1000);
const timeOf = (d: string) => new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

/* ---------------------------------- Notinha ---------------------------------- */

/** Código de barras desenhado a partir da data do treino: sempre o mesmo para o mesmo treino, sem nada aleatório. */
function Barcode({ seed, w, h }: { seed: string; w: number; h: number }) {
  let x = 0;
  let n = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const bars: { x: number; w: number }[] = [];
  while (x < w) {
    n = (n * 1103515245 + 12345) >>> 0;
    const bw = 3 + (n % 4) * 3;
    if ((n >> 3) % 3 !== 0) bars.push({ x, w: bw });
    x += bw + 4 + ((n >> 5) % 3) * 2;
  }
  return (
    <Svg width={w} height={h}>
      {bars.map((b, i) => <Rect key={i} x={b.x} y={0} width={b.w} height={h} fill="#151515" />)}
    </Svg>
  );
}

/** Borda serrilhada do papel (em cima e embaixo). */
function Zigzag({ w, flip }: { w: number; flip?: boolean }) {
  const tooth = 26;
  const pts: string[] = [`0,${flip ? 0 : 22}`];
  for (let x = 0; x <= w; x += tooth) pts.push(`${x + tooth / 2},${flip ? 22 : 0}`, `${Math.min(w, x + tooth)},${flip ? 0 : 22}`);
  pts.push(`${w},${flip ? 0 : 22}`);
  return (
    <Svg width={w} height={22}>
      <Polygon points={pts.join(' ')} fill="#fbfaf6" />
    </Svg>
  );
}

function Line({ left, right, bold }: { left: string; right?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
      <Text style={[rs.mono, bold && rs.monoBold]} numberOfLines={1}>{left}</Text>
      {right ? <Text style={[rs.mono, bold && rs.monoBold]} numberOfLines={1}>{right}</Text> : null}
    </View>
  );
}

/** Ritmo do trecho pela distância que ele teve (o último km quase sempre é mais curto). */
const paceOf = (s: { seconds: number; distanceM?: number | null }, per: number) => (s.distanceM && s.distanceM > 0 ? (s.seconds / s.distanceM) * per : s.seconds);

const Dash = () => <Text style={rs.dash} numberOfLines={1}>{'- '.repeat(40)}</Text>;

/** Recibo de padaria do treino: cabeçalho da empresa, parciais, totais e um código de barras. Fundo transparente. */
export function Receipt({ activity }: TemplateProps) {
  const g = activity.gps;
  const per = g?.splitsKind === '100m' ? '/100m' : '/km';
  const splits = (g?.splits ?? []).slice(0, 12);
  const label = g?.splitsKind === 'laps' ? tr('receipt.lap') : g?.splitsKind === '100m' ? '100M' : 'KM';
  const totals = statsOf(activity).filter((s) => s.label !== tr('stat.distance'));
  return (
    <View style={[base.canvas, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={rs.paperShadow}>
        <Zigzag w={780} />
        <View style={rs.paper}>
          <Text style={rs.company} numberOfLines={1}>{activity.company.toUpperCase()}</Text>
          <Text style={[rs.mono, { textAlign: 'center' }]}>{tr('receipt.title').toUpperCase()}</Text>
          <Text style={[rs.mono, { textAlign: 'center' }]}>{`${longDate(new Date(activity.date))}  ${timeOf(activity.date)}`}</Text>
          <Dash />
          <Text style={[rs.mono, rs.monoBold]} numberOfLines={1}>{activity.title.toUpperCase()}</Text>
          {splits.length > 1
            ? splits.map((s) => (
                <Line key={s.index} left={`${label} ${String(s.index).padStart(2, '0')}`} right={g?.splitsKind === 'laps' ? formatClock(s.seconds) : `${formatPace(paceOf(s, g?.splitsKind === '100m' ? 100 : 1000))} ${per}`} />
              ))
            : null}
          <Dash />
          {totals.map((s) => <Line key={s.label} left={s.label.toUpperCase()} right={s.value} />)}
          <Dash />
          <Line bold left={tr('receipt.total').toUpperCase()} right={g ? `${kmNumber(g.distanceM)} KM` : formatClock(activity.seconds)} />
          <Dash />
          <Text style={[rs.mono, { textAlign: 'center', marginTop: 6 }]}>{tr('receipt.thanks').toUpperCase()}</Text>
          <View style={{ alignItems: 'center', marginTop: 22 }}>
            <Barcode seed={activity.date + activity.title} w={600} h={110} />
          </View>
          <Text style={[rs.mono, { textAlign: 'center', fontSize: 22, marginTop: 14, letterSpacing: 6 }]}>OPERAX</Text>
        </View>
        <Zigzag w={780} flip />
      </View>
    </View>
  );
}

/* ------------------------------ Número de peito ------------------------------ */

/** Furo de alfinete no canto do número. */
const Pin = ({ style, dark }: { style: object; dark: boolean }) => <View style={[rs.pin, { backgroundColor: dark ? '#05070b' : '#c7cfdd' }, style]} />;

function Bib({ activity, dark }: TemplateProps & { dark: boolean }) {
  const g = activity.gps;
  const ink = dark ? '#ffffff' : '#0c1222';
  const soft = dark ? '#9aa7bd' : '#5c677a';
  const big = g ? kmNumber(g.distanceM) : formatClock(activity.seconds);
  const bigLabel = g ? tr('bib.km') : tr('bib.time');
  const small = g
    ? [{ v: formatClock(activity.seconds), l: tr('bib.time') }, g.rateLabel.endsWith('km/h') ? { v: g.rateLabel.replace(/\s*km\/h$/, ''), l: 'KM/H' } : { v: g.rateLabel.replace(/\s*\/.*$/, ''), l: tr('bib.pace') }]
    : (activity.energyKcal ? [{ v: String(activity.energyKcal), l: 'KCAL' }] : []);
  return (
    <View style={[base.canvas, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={[rs.bib, { backgroundColor: dark ? '#12161e' : '#ffffff' }]}>
        <LinearGradient colors={[colors.cyan, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rs.bibBand}>
          <Text style={rs.bibCompany} numberOfLines={1}>{activity.company.toUpperCase()}</Text>
        </LinearGradient>
        <Pin dark={dark} style={{ top: 22, left: 22 }} />
        <Pin dark={dark} style={{ top: 22, right: 22 }} />
        <Pin dark={dark} style={{ bottom: 22, left: 22 }} />
        <Pin dark={dark} style={{ bottom: 22, right: 22 }} />
        <View style={{ alignItems: 'center', paddingTop: 34 }}>
          <Text style={[rs.bibNumber, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>{big}</Text>
          <Text style={[rs.bibLabel, { color: soft }]}>{bigLabel.toUpperCase()}</Text>
        </View>
        <View style={[rs.bibRule, { backgroundColor: dark ? '#2a3140' : '#d9dfea' }]} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 120 }}>
          {small.map((s) => (
            <View key={s.l} style={{ alignItems: 'center' }}>
              <Text style={[rs.bibSmall, { color: ink }]}>{s.v}</Text>
              <Text style={[rs.bibSmallLabel, { color: soft }]}>{s.l.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        <Text style={[rs.bibTitle, { color: soft }]} numberOfLines={1}>{activity.title.toUpperCase()}</Text>
      </View>
      <Text style={[rs.bibPowered, { color: '#ffffff' }]}>OPERAX</Text>
    </View>
  );
}

export const BibLight = (p: TemplateProps) => <Bib {...p} dark={false} />;
export const BibDark = (p: TemplateProps) => <Bib {...p} dark />;

/* ------------------------------- Treino cumprido ------------------------------ */

function Ring({ pct, size }: { pct: number; size: number }) {
  const stroke = 34;
  const r = size / 2 - stroke * 1.6;
  const c = 2 * Math.PI * r;
  const ro = r + stroke * 0.95;
  const co = 2 * Math.PI * ro;
  const main = Math.min(pct, 100) / 100;
  const over = Math.min(Math.max(pct - 100, 0), 100) / 100;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={pct < 90 ? '#ffb27a' : '#5be38f'} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${main * c} ${c}`} />
        {over > 0 ? <Circle cx={size / 2} cy={size / 2} r={ro} stroke={colors.cyan} strokeWidth={stroke * 0.45} fill="none" strokeLinecap="round" strokeDasharray={`${over * co} ${co}`} /> : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={rs.ringPct}>{pct}<Text style={rs.ringSign}>%</Text></Text>
        <Text style={rs.ringLabel}>{tr('plan.ofPlanned')}</Text>
      </View>
    </View>
  );
}

const Check = () => (
  <Svg width={120} height={120} viewBox="0 0 120 120">
    <Circle cx={60} cy={60} r={56} fill={colors.cyan} />
    <Path d="M36 62 l16 16 l32 -36" stroke="#0b1a3a" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/** Treino do professor cumprido: o percentual do planejado, e a distância e o tempo planejados ao lado do feito. */
export function PlanDone({ activity }: TemplateProps) {
  const p = activity.plan!;
  const pct = p.percent ?? 0;
  const rows = [
    p.plannedMeters != null ? { l: tr('stat.distance'), a: `${kmNumber(p.plannedMeters)} km`, b: p.doneMeters != null ? `${kmNumber(p.doneMeters)} km` : '—' } : null,
    p.plannedSeconds ? { l: tr('stat.time'), a: p.plannedSeconds.min === p.plannedSeconds.max ? formatClock(p.plannedSeconds.min) : `${formatClock(p.plannedSeconds.min)} – ${formatClock(p.plannedSeconds.max)}`, b: p.doneSeconds != null ? formatClock(p.doneSeconds) : '—' } : null,
  ].filter((r): r is { l: string; a: string; b: string } => !!r);
  return (
    <View style={base.canvas}>
      <LinearGradient colors={['#071226', '#123a8f', '#1e4ed8']} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 90, gap: 56 }}>
        {pct >= 100 ? <Check /> : null}
        <Text style={rs.planHead}>{(pct >= 100 ? tr('plan.done') : tr('plan.partial', { pct })).toUpperCase()}</Text>
        <View style={{ alignItems: 'center' }}>
          <Text style={[base.title, { color: '#fff', textAlign: 'center' }]} numberOfLines={2}>{activity.title}</Text>
          <Text style={[base.sub, { color: '#c9d8ff', marginTop: 10 }]}>{longDate(new Date(activity.date))}</Text>
        </View>
        <Ring pct={pct} size={520} />
        <View style={rs.planTable}>
          <View style={rs.planRow}>
            <Text style={[rs.planCell, rs.planLabel]} />
            <Text style={[rs.planCell, rs.planColHead, { flex: 1.35 }]}>{tr('plan.planned').toUpperCase()}</Text>
            <Text style={[rs.planCell, rs.planColHead]}>{tr('plan.doneCol').toUpperCase()}</Text>
          </View>
          {rows.map((r) => (
            <View key={r.l} style={[rs.planRow, rs.planRowLine]}>
              <Text style={[rs.planCell, rs.planLabel]}>{r.l}</Text>
              <Text style={[rs.planCell, rs.planValue, { flex: 1.35 }]} numberOfLines={2}>{r.a}</Text>
              <Text style={[rs.planCell, rs.planValue, { color: colors.cyan }]} numberOfLines={1}>{r.b}</Text>
            </View>
          ))}
        </View>
        <Brand company={activity.company} />
      </View>
    </View>
  );
}

export const hasPlan = (a: ShareActivity) => a.plan?.percent != null;

const rs = StyleSheet.create({
  paperShadow: { width: 780, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  paper: { backgroundColor: '#fbfaf6', paddingHorizontal: 56, paddingVertical: 34, gap: 12 },
  company: { fontFamily: MONO, fontWeight: '700', fontSize: 46, color: '#151515', textAlign: 'center', letterSpacing: 2 },
  mono: { fontFamily: MONO, fontSize: 28, color: '#2a2a2a' },
  monoBold: { fontWeight: '700', fontSize: 34, color: '#151515' },
  dash: { fontFamily: MONO, fontSize: 24, color: '#9a9a9a', marginVertical: 2 },
  pin: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  bib: { width: 900, borderRadius: 28, overflow: 'hidden', paddingBottom: 46, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 10 },
  bibBand: { height: 130, alignItems: 'center', justifyContent: 'center' },
  bibCompany: { fontFamily: typography.fontFamilyBold, fontSize: 40, color: '#fff', letterSpacing: 8, maxWidth: 760 },
  bibNumber: { fontFamily: typography.fontFamilyBold, fontSize: 250, letterSpacing: -8, maxWidth: 820 },
  bibLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 32, letterSpacing: 10, marginTop: -8 },
  bibRule: { height: 3, marginHorizontal: 70, marginVertical: 34 },
  bibSmall: { fontFamily: typography.fontFamilyBold, fontSize: 74, letterSpacing: -1 },
  bibSmallLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 24, letterSpacing: 6 },
  bibTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 28, letterSpacing: 6, textAlign: 'center', marginTop: 36, paddingHorizontal: 70 },
  bibPowered: { fontFamily: typography.fontFamilySemiBold, fontSize: 26, letterSpacing: 10, marginTop: 40, opacity: 0.85, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 10 },
  ringPct: { fontFamily: typography.fontFamilyBold, fontSize: 150, color: '#fff', letterSpacing: -4 },
  ringSign: { fontSize: 70, color: '#c9d8ff' },
  ringLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 32, color: '#c9d8ff', marginTop: -6 },
  planHead: { fontFamily: typography.fontFamilyBold, fontSize: 40, letterSpacing: 4, color: '#fff', textAlign: 'center' },
  planTable: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 32, paddingHorizontal: 40, paddingVertical: 24 },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  planRowLine: { borderTopWidth: 2, borderColor: 'rgba(255,255,255,0.12)' },
  planCell: { flex: 1 },
  planLabel: { flex: 0.8, fontFamily: typography.fontFamilySemiBold, fontSize: 32, color: '#c9d8ff' },
  planColHead: { fontFamily: typography.fontFamilySemiBold, fontSize: 26, letterSpacing: 4, color: '#9fb4e8' },
  planValue: { fontFamily: typography.fontFamilyBold, fontSize: 44, color: '#fff' },
});
