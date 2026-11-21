import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { AchievementPin } from './AchievementPin';
import { FX, GOLD } from './CelebrationFx';
import { Laurel } from './CelebrationTitle';
import type { AchievementCard } from './achievements';

/** Canto da carta e espessura da moldura dourada (fina, como um filete de metal). */
export const CARD_RADIUS = 26;
const FRAME = 3;
/** Marrom-dourado dos contornos sobre o dourado (moeda e selo). */
const GOLD_INK = '#7A5A14';

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
/** "08 NOV 2026" (sem os "de" e o ponto do português). */
const shortDate = (iso: string) =>
  asDate(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/\s+de\s+/gi, ' ').toUpperCase();
export const longDate = (iso: string) => asDate(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'long', year: 'numeric' });

/** Selo no alto da moldura: hexágono dourado com uma estrela. */
function Gem({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.85} viewBox="0 0 40 34">
      <Defs>
        <SvgLinear id="gemGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF6D6" />
          <Stop offset="0.5" stopColor={GOLD.main} />
          <Stop offset="1" stopColor={GOLD.deep} />
        </SvgLinear>
      </Defs>
      <Polygon points="10,1 30,1 39,17 30,33 10,33 1,17" fill="url(#gemGold)" stroke={GOLD_INK} strokeWidth={1.2} strokeLinejoin="round" />
      <Polygon points="12.5,5.5 27.5,5.5 34,17 27.5,28.5 12.5,28.5 6,17" fill={FX.navy} />
      <Path d="M12 0C12 7 17 12 24 12C17 12 12 17 12 24C12 17 7 12 0 12C7 12 12 7 12 0Z" fill="#FFFFFF" transform="translate(12 9) scale(0.667)" />
    </Svg>
  );
}

const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 5.4 : 2.3;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return `${(12 + Math.cos(a) * r).toFixed(2)},${(12.2 + Math.sin(a) * r).toFixed(2)}`;
}).join(' ');

/** Moeda dourada do XP. */
function Coin({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <SvgLinear id="coinGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF6D6" />
          <Stop offset="0.55" stopColor={GOLD.main} />
          <Stop offset="1" stopColor={GOLD.deep} />
        </SvgLinear>
      </Defs>
      <Circle cx={12} cy={12} r={11} fill="url(#coinGold)" stroke={GOLD_INK} strokeWidth={1} />
      <Circle cx={12} cy={12} r={8.2} fill="none" stroke="#FFFFFF" strokeWidth={0.8} opacity={0.7} />
      <Polygon points={STAR} fill={GOLD_INK} />
    </Svg>
  );
}

/** Raios claros e parados atrás do selo da conquista, com um clarão na cor dela. */
function ArtGlow({ size, color }: { size: number; color: string }) {
  const c = size / 2;
  const rays = useMemo(() => {
    const n = 12;
    const half = (Math.PI / n) * 0.5;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.26;
      const p = (ang: number) => `${(c + Math.cos(ang) * c).toFixed(1)} ${(c + Math.sin(ang) * c).toFixed(1)}`;
      return `M${c} ${c} L${p(a - half)} L${p(a + half)} Z`;
    }).join(' ');
  }, [c]);
  const glowId = `pinGlow${color.replace(/[^0-9a-z]/gi, '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="cardRays" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.26} />
          <Stop offset="0.6" stopColor={FX.cyan} stopOpacity={0.08} />
          <Stop offset="1" stopColor={FX.cyan} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.5} />
          <Stop offset="0.5" stopColor={color} stopOpacity={0.18} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={rays} fill="url(#cardRays)" />
      <Circle cx={c} cy={c} r={c * 0.62} fill={`url(#${glowId})`} />
    </Svg>
  );
}

/**
 * A carta de uma conquista, nas cores do app: filete dourado em volta e selo no alto, a arte em azul da marca
 * (raios, louros e o selo da conquista num medalhão branco) e, embaixo, um painel branco com o nome, a descrição
 * e o XP. Só desenha; quem move é o baralho.
 */
export const AchievementCardFace = memo(function AchievementCardFace({ card, width, height }: { card: AchievementCard; width: number; height: number }) {
  const { t } = useTranslation('fitness');
  const u = width / 255;
  const inner = width - FRAME * 2;
  const pin = Math.round(width * 0.37);
  const laurel = Math.round(width * 0.19);
  const when = card.exact ? shortDate(card.earned_at!) : t('ach.cards.edition', { year: card.editionYear ?? 0 }).toUpperCase();
  return (
    <View style={{ width, height }}>
      <View style={styles.frame}>
        <LinearGradient colors={['#FFF6D6', GOLD.main, '#9C7422', GOLD.main, GOLD.light]} locations={[0, 0.28, 0.55, 0.8, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]} />
        <View style={styles.inner}>
          <View style={styles.art}>
            <LinearGradient colors={[FX.blue, '#12296b', '#0a1533']} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.center, { top: 14 * u }]}>
              <ArtGlow size={Math.round(width * 1.2)} color={card.color} />
            </View>
            <View style={styles.artTop}>
              <Text maxFontSizeMultiplier={1.1} style={styles.when}>{when}</Text>
              {card.new ? (
                <View style={styles.fresh}>
                  <Ionicons name="sparkles" size={10} color={FX.navy} />
                  <Text maxFontSizeMultiplier={1.1} style={styles.freshText}>{t('ach.cards.fresh').toUpperCase()}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.pinRow, { paddingTop: 10 * u }]}>
              <View style={{ marginRight: -pin * 0.14, marginTop: pin * 0.22 }}><Laurel size={laurel} /></View>
              {/* Medalhão branco atrás do selo: a cor da conquista aparece bem sobre o azul. */}
              <View style={[styles.medal, { width: pin + 10, height: pin + 10, borderRadius: pin }]}>
                <AchievementPin item={card} size={pin} />
              </View>
              <View style={{ marginLeft: -pin * 0.14, marginTop: pin * 0.22 }}><Laurel size={laurel} flip /></View>
            </View>
          </View>

          <View style={styles.panel}>
            <LinearGradient colors={['#FFFFFF', '#EEF3FF']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            <Svg width={inner} height={18} viewBox={`0 0 ${inner} 18`} style={styles.arc}>
              <Path d={`M0 18 Q ${inner / 2} -10 ${inner} 18 Z`} fill="#FFFFFF" />
            </Svg>
            <Text maxFontSizeMultiplier={1.15} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.name, { fontSize: Math.max(18, 21 * u), lineHeight: Math.max(22, 25 * u) }]}>
              {card.name}
            </Text>
            <View style={styles.ornament}>
              <View style={styles.ornLine} />
              <Ionicons name="diamond" size={7} color={GOLD.main} />
              <View style={styles.ornLine} />
            </View>
            {card.description ? (
              <Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={[styles.desc, { fontSize: Math.max(12, 13 * u), lineHeight: Math.max(16.5, 18 * u) }]}>
                {card.description}
              </Text>
            ) : null}
            <View style={styles.xp}>
              <Coin size={22} />
              <Text maxFontSizeMultiplier={1.15} style={styles.xpText}>{t('ach.xp', { xp: card.xp.toLocaleString(locale()) })}</Text>
            </View>
          </View>
          <View pointerEvents="none" style={styles.hairline} />
        </View>
      </View>
      <View pointerEvents="none" style={[styles.gem, { left: width / 2 - 20 * u }]}>
        <Gem width={40 * u} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { flex: 1, borderRadius: CARD_RADIUS, backgroundColor: GOLD.deep, shadowColor: FX.cyan, shadowOpacity: 0.45, shadowRadius: 26, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  inner: { position: 'absolute', left: FRAME, right: FRAME, top: FRAME, bottom: FRAME, borderRadius: CARD_RADIUS - FRAME, overflow: 'hidden', backgroundColor: '#0a1533' },
  center: { alignItems: 'center', justifyContent: 'center' },
  art: { flex: 54, overflow: 'hidden' },
  artTop: { position: 'absolute', left: 14, right: 14, top: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 },
  when: { fontFamily: typography.fontFamilySemiBold, fontSize: 10.5, letterSpacing: 1.4, color: 'rgba(255,255,255,0.78)' },
  fresh: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: GOLD.main },
  freshText: { fontFamily: typography.fontFamilyBold, fontSize: 9.5, letterSpacing: 0.9, color: FX.navy },
  medal: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: GOLD.main, shadowColor: FX.cyan, shadowOpacity: 0.8, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  pinRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  panel: { flex: 46, alignItems: 'center', paddingHorizontal: 16, paddingBottom: 13 },
  arc: { position: 'absolute', top: -17, left: 0 },
  name: { marginTop: 2, fontFamily: typography.fontFamilyDisplay, letterSpacing: -0.5, color: colors.text, textAlign: 'center' },
  ornament: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ornLine: { width: 30, height: 1.5, borderRadius: 1, backgroundColor: colors.track },
  desc: { marginTop: 6, fontFamily: typography.fontFamily, color: colors.textSoft, textAlign: 'center' },
  xp: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingLeft: 6, paddingRight: 15, borderRadius: 17, backgroundColor: colors.text },
  xpText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  hairline: { position: 'absolute', left: 3, right: 3, top: 3, bottom: 3, borderRadius: CARD_RADIUS - FRAME - 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  gem: { position: 'absolute', top: -13 },
});
