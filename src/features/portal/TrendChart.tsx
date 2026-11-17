import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';

const fmt = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 2 });
const date = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), { day: '2-digit', month: 'short' });

/** Linha simples da evolução de um indicador: pontos ligados, primeiro e último valor em destaque. */
export function TrendChart({ title, unit, points, width = 300, height = 84 }: { title: string; unit: string; points: { date: string; value: number }[]; width?: number; height?: number }) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 10;
  const xy = points.map((p, i) => ({
    x: pad + (points.length === 1 ? (width - pad * 2) / 2 : (i / (points.length - 1)) * (width - pad * 2)),
    y: height - pad - ((p.value - min) / span) * (height - pad * 2),
  }));
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <View style={styles.card} accessible accessibilityLabel={`${title}: ${fmt(last.value)}${unit ? ` ${unit}` : ''}`}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{`${fmt(last.value)}${unit ? ` ${unit}` : ''}`}</Text>
      </View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {xy.length > 1 ? <Polyline points={xy.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {xy.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === xy.length - 1 ? 4.5 : 3} fill={i === xy.length - 1 ? colors.primary : '#fff'} stroke={colors.primary} strokeWidth={2} />
        ))}
      </Svg>
      <View style={styles.head}>
        <Text style={styles.axis}>{`${date(first.date)} · ${fmt(first.value)}`}</Text>
        {points.length > 1 ? <Text style={styles.axis}>{date(last.date)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radii.lg, backgroundColor: '#fff', gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textSoft },
  value: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] },
  axis: { fontFamily: typography.fontFamilyMedium, fontSize: 11.5, color: colors.textMuted },
});
