import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from '@/src/i18n';
import { colors, typography } from '@/src/design-system/tokens';
import type { CanvasRef } from '@/src/features/share/destinations';
import { AchievementPin } from './AchievementPin';
import type { AchievementView } from './achievements';

/** `square` serve ao WhatsApp e ao feed; `story` é o vertical de Story e Status. */
export type CardFormat = 'square' | 'story';
export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = { square: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 } };

type Item = Pick<AchievementView, 'color' | 'icon' | 'progress' | 'earned_at' | 'name' | 'tier' | 'xp' | 'description'>;

/** Medidas de cada formato: o quadrado é o mesmo desenho, mais compacto. */
const LAYOUT = {
  story: { padV: 150, padH: 96, kicker: 38, medal: 560, pin: 470, gap: 90, name: 112, nameLh: 124, pill: 46, pillPadV: 16, pillPadH: 38, desc: 46, descLh: 66, descGap: 44, brand: 52, mark: 84, date: 36, rings: [760, 900, 1040] },
  square: { padV: 66, padH: 80, kicker: 30, medal: 360, pin: 304, gap: 38, name: 78, nameLh: 88, pill: 34, pillPadV: 10, pillPadH: 28, desc: 33, descLh: 46, descGap: 20, brand: 38, mark: 58, date: 28, rings: [470, 560, 650] },
} as const;

const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

/** Pontinhos de brilho fixos (posição relativa), para o fundo não ficar liso. */
const SPARKS: [number, number, number][] = [[0.12, 0.2, 7], [0.86, 0.28, 5], [0.2, 0.55, 5], [0.9, 0.62, 8], [0.08, 0.82, 6], [0.78, 0.9, 5], [0.5, 0.1, 4]];

/**
 * Cartão da conquista que vira imagem para compartilhar. Fundo azul-noite com o brilho na cor da medalha, anéis em volta
 * do pin, nome, nível e XP numa pílula, a descrição e a assinatura da academia com a marca do Operax.
 * É desenhado em tamanho real e capturado; quem mostra na tela não deve usá-lo.
 */
export function AchievementShareCard({ item, company, dateLabel, format, canvasRef }: { item: Item; company: string; dateLabel: string | null; format: CardFormat; canvasRef: CanvasRef }) {
  const { w, h } = CARD_SIZE[format];
  const L = LAYOUT[format];
  const xp = item.xp.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const tier = i18n.t(`fitness:ach.tier.${item.tier}`);
  const cx = w / 2;
  // O brilho fica atrás da medalha: no story ela está mais abaixo do topo.
  const medalTop = format === 'story' ? L.padV + L.kicker + 90 : L.padV + L.kicker + 34;
  const medalCenterY = medalTop + L.medal / 2;

  return (
    <View ref={canvasRef} collapsable={false} style={{ width: w, height: h, overflow: 'hidden', backgroundColor: colors.chromeNavy }}>
      <LinearGradient colors={['#04080f', '#0a1a3a', '#050b18']} locations={[0, 0.55, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Auréola: círculos concêntricos cada vez mais fracos fazem o papel de um brilho suave. */}
      {[...L.rings].reverse().map((d, i) => (
        <View key={d} style={{ position: 'absolute', left: cx - d / 2, top: medalCenterY - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: alpha(item.color, 0.05 + i * 0.045) }} />
      ))}
      <View style={{ position: 'absolute', left: cx - (L.medal + 70) / 2, top: medalCenterY - (L.medal + 70) / 2, width: L.medal + 70, height: L.medal + 70, borderRadius: 999, borderWidth: 3, borderColor: alpha(item.color, 0.55) }} />
      {SPARKS.map(([x, y, s], i) => (
        <View key={i} style={{ position: 'absolute', left: x * w, top: y * h, width: s * 2, height: s * 2, borderRadius: s, backgroundColor: alpha(i % 2 ? '#ffffff' : item.color, 0.55) }} />
      ))}
      <View style={{ position: 'absolute', right: -w * 0.28, top: -w * 0.34, width: w * 0.78, height: w * 0.78, borderRadius: w, backgroundColor: alpha(colors.primary, 0.2) }} />

      <View style={{ flex: 1, paddingVertical: L.padV, paddingHorizontal: L.padH, alignItems: 'center' }}>
        <View style={styles.kickerRow}>
          <View style={[styles.line, { backgroundColor: alpha(colors.cyan, 0.5) }]} />
          <Text style={[styles.kicker, { fontSize: L.kicker, letterSpacing: L.kicker * 0.28 }]}>{i18n.t('fitness:ach.shareKicker')}</Text>
          <View style={[styles.line, { backgroundColor: alpha(colors.cyan, 0.5) }]} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* Disco branco com aro da cor do nível: o pin é desenhado para fundo claro. */}
          <View style={{ width: L.medal, height: L.medal, borderRadius: L.medal / 2, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: L.medal * 0.024, borderColor: alpha(item.color, 0.9) }}>
            <AchievementPin item={item} size={L.pin} />
          </View>
          <Text style={[styles.name, { fontSize: L.name, lineHeight: L.nameLh, marginTop: L.gap }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            {item.name}
          </Text>
          <View style={{ marginTop: L.gap * 0.4, paddingVertical: L.pillPadV, paddingHorizontal: L.pillPadH, borderRadius: 999, borderWidth: 3, borderColor: item.color, backgroundColor: alpha(item.color, 0.14) }}>
            <Text style={{ color: item.color, fontFamily: typography.fontFamilyBold, fontSize: L.pill, letterSpacing: L.pill * 0.06 }}>{`${tier.toUpperCase()}  ·  ${i18n.t('fitness:ach.xp', { xp })}`}</Text>
          </View>
          {item.description ? (
            <Text style={[styles.desc, { fontSize: L.desc, lineHeight: L.descLh, marginTop: L.descGap }]} numberOfLines={format === 'story' ? 4 : 2}>
              {item.description}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <View style={[styles.rule, { backgroundColor: alpha('#ffffff', 0.14) }]} />
          {dateLabel ? <Text style={[styles.date, { fontSize: L.date }]}>{dateLabel}</Text> : null}
          <View style={styles.brandRow}>
            <Image source={require('../../../assets/brand/operax-mark.png')} style={{ width: L.mark, height: L.mark }} resizeMode="contain" />
            <View>
              <Text style={[styles.company, { fontSize: L.brand }]} numberOfLines={1}>{company.toUpperCase()}</Text>
              <Text style={[styles.brand, { fontSize: L.brand * 0.5, letterSpacing: L.brand * 0.3 }]}>OPERAX</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 28, alignSelf: 'stretch', justifyContent: 'center' },
  line: { flex: 1, height: 3, borderRadius: 2, maxWidth: 120 },
  kicker: { color: colors.cyan, fontFamily: typography.fontFamilyBold },
  name: { color: '#ffffff', fontFamily: typography.fontFamilyBold, textAlign: 'center', letterSpacing: -2 },
  desc: { color: '#c9d4e8', fontFamily: typography.fontFamily, textAlign: 'center' },
  rule: { alignSelf: 'stretch', height: 2, marginBottom: 26 },
  date: { color: '#8fa3c4', fontFamily: typography.fontFamilySemiBold, marginBottom: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  company: { color: '#ffffff', fontFamily: typography.fontFamilyBold, letterSpacing: 4, maxWidth: 640 },
  brand: { color: colors.cyan, fontFamily: typography.fontFamilySemiBold, marginTop: 4 },
});
