import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { FX, GOLD } from './CelebrationFx';

/** Ramo de louro dourado: caule em arco com folhas dos dois lados, apontando para cima. `flip` espelha (lado direito). */
export function Laurel({ size = 62, flip = false }: { size?: number; flip?: boolean }) {
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
          <Stop offset="0" stopColor="#FFF6D6" />
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
      {/* folha da ponta, na direção do caule */}
      <Ellipse cx={P2[0] + 4} cy={P2[1]} rx={5.5} ry={2.6} fill="url(#lg)" transform={`rotate(${at(1).ang} ${P2[0]} ${P2[1]})`} />
    </Svg>
  );
}

/**
 * Título da comemoração ("Parabéns!"). Mesma família do app (Inter), no peso mais forte e em itálico, branco e
 * limpo, com a pontuação em dourado e um brilho suave da cor da marca. Em cima, um troféu pequeno entre louros.
 * Palavra comprida em outro idioma ("Congratulations!") encolhe para caber numa linha.
 */
export function CelebrationTitle({ text, size = 46, crest = true }: { text: string; size?: number; crest?: boolean }) {
  const cut = text.search(/[!?.¡¿]+$/);
  const word = cut > 0 ? text.slice(0, cut) : text;
  const mark = cut > 0 ? text.slice(cut) : '';
  const fit = text.length > 11 ? Math.round((size * 11) / text.length) : size;
  return (
    <View style={styles.root} accessible accessibilityRole="header" accessibilityLabel={text}>
      {crest ? (
        <View style={styles.crest} importantForAccessibility="no-hide-descendants">
          <Laurel size={22} />
          <Ionicons name="trophy" size={28} color={GOLD.main} style={styles.trophy} />
          <Laurel size={22} flip />
        </View>
      ) : null}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.1} importantForAccessibility="no" style={[styles.title, { fontSize: fit, lineHeight: Math.round(fit * 1.16), letterSpacing: -fit * 0.035 }]}>
        {word}
        <Text style={{ color: GOLD.main }}>{mark}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  crest: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  trophy: { marginHorizontal: 1, marginBottom: 3 },
  // paddingHorizontal: a letra inclinada passa da caixa do texto e seria cortada na ponta.
  title: { fontFamily: 'Inter_800ExtraBold_Italic', color: '#FFFFFF', textAlign: 'center', paddingHorizontal: 10, textShadowColor: `${FX.cyan}80`, textShadowRadius: 22, textShadowOffset: { width: 0, height: 0 } },
});
