import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import type { AchievementView } from './achievements';

/** Cor com transparência (#RRGGBB + alfa em hex). */
export const tint = (hex: string, alpha: number) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

/** Estado da conquista: ganha, começada (tem progresso) ou ainda não começada. */
export type AchievementState = 'won' | 'progress' | 'idle';
export const achievementState = (item: Pick<AchievementView, 'progress' | 'earned_at'>): AchievementState =>
  item.earned_at ? 'won' : item.progress.current > 0 ? 'progress' : 'idle';

/**
 * Pin da conquista, com três caras bem diferentes:
 * - ganha: disco cheio na cor do nível, ícone branco e um selo de visto;
 * - começada: anel azul mostrando quanto já foi, ícone azul;
 * - não começada: cinza, anel tracejado, ícone apagado.
 * O SVG vem da biblioteca fixa do backend; o ícone enviado pela academia chega como imagem.
 */
export function AchievementPin({ item, size = 64, style }: { item: Pick<AchievementView, 'color' | 'icon' | 'progress' | 'earned_at'>; size?: number; style?: StyleProp<ViewStyle> }) {
  const state = achievementState(item);
  const won = state === 'won';
  const color = won ? '#ffffff' : state === 'progress' ? colors.primary : '#a3acbb';
  const ring = Math.max(3, Math.round(size / 16));
  const r = (size - ring) / 2;
  const c = 2 * Math.PI * r;
  const p = won ? 1 : Math.max(0, Math.min(1, item.progress.current / Math.max(1, item.progress.target)));
  const inner = Math.round(size * 0.46);
  const xml = item.icon.svg
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon.svg}</svg>`
    : null;
  const badge = Math.max(16, Math.round(size * 0.32));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} accessible={false}>
      <View style={{ position: 'absolute', width: size - ring * 2, height: size - ring * 2, borderRadius: size, backgroundColor: won ? item.color : state === 'progress' ? colors.primaryWash : '#f1f3f6' }} />
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={won ? tint(item.color, 0.35) : colors.track} strokeWidth={ring} fill="none" strokeDasharray={state === 'idle' ? `${ring * 1.4} ${ring * 1.6}` : undefined} />
        {state === 'progress' ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primary} strokeWidth={ring} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </Svg>
      {/* Numa View: na web o SVG solto ficaria por baixo do fundo (que é absoluto). */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {item.icon.url ? (
          <Image source={{ uri: item.icon.url }} style={{ width: size - ring * 4, height: size - ring * 4, borderRadius: size, opacity: won ? 1 : state === 'progress' ? 0.7 : 0.35 }} />
        ) : xml ? (
          <SvgXml xml={xml} width={inner} height={inner} />
        ) : (
          <Ionicons name="medal-outline" size={inner} color={color} />
        )}
      </View>
      {won ? (
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: badge, height: badge, borderRadius: badge, backgroundColor: colors.success, borderWidth: 2.5, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={badge * 0.62} color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}
