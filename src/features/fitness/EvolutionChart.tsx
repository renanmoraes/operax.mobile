import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgLinear, Path, Stop, Text as SvgText } from 'react-native-svg';
import { colors, typography } from '@/src/design-system/tokens';
import type { Point } from './bodyEvolution';

const H = 188;
const TOP = 40;
const BOTTOM = 34;
const SIDE = 30;

/** Linha da medida com o valor em cada avaliação e a data embaixo. Com muitas avaliações, só as pontas, o maior e o menor ganham número. */
export function EvolutionChart({ points, fmt, dateOf, a11y }: { points: Point[]; fmt: (n: number) => string; dateOf: (iso: string) => string; a11y: string }) {
  const [w, setW] = useState(0);
  const n = points.length;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const lo = min - span * 0.18;
  const hi = max + span * 0.18;
  const plotH = H - TOP - BOTTOM;
  const x = (i: number) => (n === 1 ? w / 2 : SIDE + (i * (w - SIDE * 2)) / (n - 1));
  const y = (v: number) => TOP + ((hi - v) / (hi - lo)) * plotH;
  const minI = values.indexOf(min);
  const maxI = values.indexOf(max);
  const labelled = (i: number) => n <= 6 || i === 0 || i === n - 1 || i === minI || i === maxI;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const base = H - BOTTOM;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={a11y} style={{ height: H }}>
      {w ? (
        <Svg width={w} height={H}>
          <Defs>
            <SvgLinear id="evoArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.2} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </SvgLinear>
          </Defs>
          <Line x1={SIDE / 2} x2={w - SIDE / 2} y1={base} y2={base} stroke={colors.border} strokeWidth={1} />
          {n > 1 ? <Path d={`${line} L${x(n - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`} fill="url(#evoArea)" /> : null}
          {n > 1 ? <Path d={line} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.map((p, i) => {
            const last = i === n - 1;
            const cx = x(i);
            const cy = y(p.value);
            const anchor = n > 1 && i === 0 ? 'start' : n > 1 && last ? 'end' : 'middle';
            const tx = anchor === 'start' ? cx - 8 : anchor === 'end' ? cx + 8 : cx;
            return (
              <G key={p.id}>
                <Line x1={cx} x2={cx} y1={cy + 8} y2={base} stroke={colors.track} strokeWidth={1} strokeDasharray="3 4" />
                <Circle cx={cx} cy={cy} r={last ? 7 : 5} fill={last ? colors.primary : '#fff'} stroke={colors.primary} strokeWidth={last ? 3 : 2.5} />
                {labelled(i) ? (
                  <SvgText x={tx} y={cy - 14} textAnchor={anchor} fontSize={last ? 15 : 13} fontFamily={last ? typography.fontFamilyBold : typography.fontFamilySemiBold} fill={last ? colors.primaryDeep : colors.textSoft}>
                    {fmt(p.value)}
                  </SvgText>
                ) : null}
                {labelled(i) ? (
                  <SvgText x={tx} y={H - 10} textAnchor={anchor} fontSize={11.5} fontFamily={typography.fontFamilySemiBold} fill={colors.textMuted}>
                    {dateOf(p.date)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
