import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { GOLD } from './CelebrationFx';

/** Ramo de louro dourado: caule em arco com folhas dos dois lados, apontando para cima. `flip` espelha (lado direito). */
function Laurel({ size = 62, flip = false }: { size?: number; flip?: boolean }) {
  const P0 = [16, 76], P1 = [2, 38], P2 = [34, 4];
  const at = (t: number) => ({
    x: (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    y: (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
    ang: (Math.atan2(2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0])) * 180) / Math.PI,
  });
  const leaves = Array.from({ length: 6 }, (_, i) => {
    const t = 0.1 + (i / 5) * 0.8;
    return { ...at(t), s: 1.05 - t * 0.45 };
  });
  return (
    <Svg width={size} height={size * 1.4} viewBox="0 0 50 80" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Defs>
        <SvgGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF1B8" />
          <Stop offset="0.55" stopColor={GOLD.main} />
          <Stop offset="1" stopColor={GOLD.deep} />
        </SvgGradient>
      </Defs>
      <Path d={`M${P0[0]} ${P0[1]} Q ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`} stroke="url(#lg)" strokeWidth={2} fill="none" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <Ellipse key={`a${i}`} cx={l.x + 8 * l.s} cy={l.y} rx={8 * l.s} ry={3.6 * l.s} fill="url(#lg)" transform={`rotate(${l.ang - 42} ${l.x} ${l.y})`} />
      ))}
      {leaves.map((l, i) => (
        <Ellipse key={`b${i}`} cx={l.x + 8 * l.s} cy={l.y} rx={8 * l.s} ry={3.6 * l.s} fill="url(#lg)" opacity={0.92} transform={`rotate(${l.ang + 42} ${l.x} ${l.y})`} />
      ))}
      <Ellipse cx={P2[0] + 1} cy={P2[1] - 2} rx={3} ry={6} fill="url(#lg)" transform={`rotate(${at(1).ang + 90 - 90} ${P2[0]} ${P2[1]})`} />
    </Svg>
  );
}

const OUTLINE = [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5], [-2, -2], [2, 2], [-2, 2], [2, -2]] as const;

/**
 * "Parabéns!" dourado e brilhante entre dois louros: letra grossa e arredondada, contorno marrom-dourado,
 * "degrau" embaixo (efeito 3D) e brilho em volta, tudo com camadas de texto (funciona igual no iOS, Android e web).
 */
export function GoldTitle({ text, size = 50 }: { text: string; size?: number }) {
  const base = { fontFamily: 'LilitaOne_400Regular', fontSize: size, lineHeight: size * 1.18, textAlign: 'center' as const };
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={text}>
      <Laurel />
      <View style={{ marginHorizontal: 2 }} importantForAccessibility="no-hide-descendants">
        <Text style={[base, styles.glow]}>{text}</Text>
        {/* degrau 3D */}
        <Text style={[base, styles.layer, { top: 5, color: '#7a3f06' }]}>{text}</Text>
        {OUTLINE.map(([dx, dy], i) => (
          <Text key={i} style={[base, styles.layer, { left: dx, top: dy, color: '#a85d0b' }]}>{text}</Text>
        ))}
        <Text style={[base, styles.layer, { color: '#FFD45A' }]}>{text}</Text>
        {/* reflexo claro na metade de cima */}
        <View style={[styles.layer, { height: size * 0.5, overflow: 'hidden' }]}>
          <Text style={[base, { color: '#FFF3C4' }]}>{text}</Text>
        </View>
      </View>
      <Laurel flip />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', left: 0, right: 0, top: 0 },
  glow: { color: 'transparent', textShadowColor: GOLD.main, textShadowRadius: 22, textShadowOffset: { width: 0, height: 0 } },
});
