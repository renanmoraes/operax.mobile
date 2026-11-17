import { StyleSheet, Text, View } from 'react-native';
import i18n from '@/src/i18n';
import { colors, typography } from '@/src/design-system/tokens';
import type { CanvasRef } from '@/src/features/share/destinations';
import { CANVAS } from '@/src/features/share/types';
import { AchievementPin } from './AchievementPin';
import type { AchievementView } from './achievements';

/** Tamanho em que o cartão é desenhado: o mesmo quadro 1080×1920 dos treinos (serve de story). */
export const ACHIEVEMENT_CARD = CANVAS;

type Item = Pick<AchievementView, 'color' | 'icon' | 'progress' | 'earned_at' | 'name' | 'tier' | 'xp' | 'description'>;

/**
 * Cartão da conquista que vira imagem para compartilhar. Fundo escuro com o brilho na cor da medalha,
 * o pin grande no centro, nome, nível · XP, a descrição e a assinatura da academia com o Operax.
 * É desenhado em tamanho real e capturado; quem mostra na tela não deve usá-lo.
 */
export function AchievementShareCard({ item, company, dateLabel, canvasRef }: { item: Item; company: string; dateLabel: string | null; canvasRef: CanvasRef }) {
  const xp = item.xp.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const tier = i18n.t(`fitness:ach.tier.${item.tier}`);
  return (
    <View ref={canvasRef} collapsable={false} style={styles.card}>
      <View style={[styles.glow, { backgroundColor: item.color }]} />
      <View style={[styles.glowSoft, { backgroundColor: colors.primary }]} />
      <View style={styles.top}>
        <Text style={styles.kicker}>{i18n.t('fitness:ach.shareKicker')}</Text>
      </View>
      <View style={styles.middle}>
        <View style={styles.medal}>
          <AchievementPin item={item} size={520} />
        </View>
        <Text style={styles.name} numberOfLines={3} adjustsFontSizeToFit>
          {item.name}
        </Text>
        <Text style={[styles.tier, { color: item.color }]}>{`${tier} · ${i18n.t('fitness:ach.xp', { xp })}`}</Text>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={4}>
            {item.description}
          </Text>
        ) : null}
        {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
      </View>
      <View style={styles.bottom}>
        <Text style={styles.company} numberOfLines={1}>
          {company.toUpperCase()}
        </Text>
        <Text style={styles.brand}>OPERAX</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CANVAS.w, height: CANVAS.h, backgroundColor: colors.chromeNavy, overflow: 'hidden', paddingHorizontal: 90, paddingVertical: 140 },
  glow: { position: 'absolute', top: 330, left: CANVAS.w / 2 - 460, width: 920, height: 920, borderRadius: 460, opacity: 0.2 },
  glowSoft: { position: 'absolute', top: -260, right: -300, width: 760, height: 760, borderRadius: 380, opacity: 0.18 },
  top: { alignItems: 'center' },
  kicker: { color: colors.cyan, fontFamily: typography.fontFamilyBold, fontSize: 44, letterSpacing: 10 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Fundo claro por trás do pin: ele é desenhado para o claro e some no escuro sem isso.
  medal: { width: 600, height: 600, borderRadius: 300, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 80, color: '#ffffff', fontFamily: typography.fontFamilyBold, fontSize: 104, lineHeight: 118, textAlign: 'center' },
  tier: { marginTop: 28, fontFamily: typography.fontFamilySemiBold, fontSize: 48, letterSpacing: 2 },
  desc: { marginTop: 40, color: '#c9d4e8', fontFamily: typography.fontFamily, fontSize: 46, lineHeight: 64, textAlign: 'center' },
  date: { marginTop: 36, color: '#8fa3c4', fontFamily: typography.fontFamilySemiBold, fontSize: 38 },
  bottom: { alignItems: 'center' },
  company: { color: '#ffffff', fontFamily: typography.fontFamilyBold, fontSize: 52, letterSpacing: 6 },
  brand: { marginTop: 10, color: colors.cyan, fontFamily: typography.fontFamilySemiBold, fontSize: 32, letterSpacing: 12 },
});
