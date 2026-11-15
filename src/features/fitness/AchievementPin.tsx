import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import type { AchievementView } from './achievements';

/** Cor com transparência (#RRGGBB + alfa em hex). */
const tint = (hex: string, alpha: number) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

/**
 * Pin da conquista: anel na cor do nível (ou a escolhida pela academia), fundo claro da mesma cor e o ícone.
 * Sem ganhar, fica cinza e o anel mostra quanto falta. O SVG vem da biblioteca fixa do backend; o ícone enviado
 * pela academia chega como imagem.
 */
export function AchievementPin({ item, size = 64, style }: { item: Pick<AchievementView, 'color' | 'icon' | 'progress' | 'earned_at'>; size?: number; style?: StyleProp<ViewStyle> }) {
  const won = !!item.earned_at;
  const color = won ? item.color : colors.textMuted;
  const ring = Math.max(3, Math.round(size / 16));
  const r = (size - ring) / 2;
  const c = 2 * Math.PI * r;
  const p = won ? 1 : Math.max(0, Math.min(1, item.progress.current / Math.max(1, item.progress.target)));
  const inner = Math.round(size * 0.46);
  const xml = item.icon.svg
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon.svg}</svg>`
    : null;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} accessible={false}>
      <View style={{ position: 'absolute', width: size - ring * 2, height: size - ring * 2, borderRadius: size, backgroundColor: won ? tint(item.color, 0.14) : '#eef0f3' }} />
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={won ? tint(item.color, 0.25) : colors.track} strokeWidth={ring} fill="none" />
        {p > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={won ? item.color : colors.primary} strokeWidth={ring} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </Svg>
      {/* Numa View: na web o SVG solto ficaria por baixo do fundo (que é absoluto). */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {item.icon.url ? (
          <Image source={{ uri: item.icon.url }} style={{ width: size - ring * 4, height: size - ring * 4, borderRadius: size, opacity: won ? 1 : 0.45 }} />
        ) : xml ? (
          <SvgXml xml={xml} width={inner} height={inner} />
        ) : (
          <Ionicons name="medal-outline" size={inner} color={color} />
        )}
      </View>
    </View>
  );
}
