import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, LinearGradient as SvgLinear } from 'react-native-svg';
import { colors, gradients, motion, NumberSize, numbers, radii, shadows, spacing, text, TextRole, typography } from './tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const easeOut = Easing.bezier(...motion.easeOut);

/** Fundo em degradê suave (azul + ciano) que fica atrás de toda tela. */
export function Backdrop({ variant = 'default' }: { variant?: 'default' | 'mirror' | 'chat' }) {
  const a = variant === 'mirror' ? { cx: '0%', cy: '0%' } : { cx: '100%', cy: '0%' };
  const b = variant === 'mirror' ? { cx: '100%', cy: '8%' } : { cx: '0%', cy: '8%' };
  const c = variant === 'chat' ? { cx: '0%', cy: '75%' } : null;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="bgA" cx={a.cx} cy={a.cy} rx="110%" ry="55%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={colors.blueWash} stopOpacity={1} />
          <Stop offset="0.62" stopColor={colors.blueWash} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="bgB" cx={b.cx} cy={b.cy} rx="90%" ry="45%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={colors.cyanWash} stopOpacity={1} />
          <Stop offset="0.6" stopColor={colors.cyanWash} stopOpacity={0} />
        </RadialGradient>
        {c ? (
          <RadialGradient id="bgC" cx={c.cx} cy={c.cy} rx="100%" ry="40%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor="#dfe9ff" stopOpacity={1} />
            <Stop offset="0.6" stopColor="#dfe9ff" stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      <Rect width="100%" height="100%" fill={colors.pageBg} />
      <Rect width="100%" height="100%" fill="url(#bgA)" />
      <Rect width="100%" height="100%" fill="url(#bgB)" />
      {c ? <Rect width="100%" height="100%" fill="url(#bgC)" /> : null}
    </Svg>
  );
}

/** Mancha de luz decorativa usada dentro dos cards herói. */
export function Glow({
  size,
  color = colors.cyan,
  opacity = 0.32,
  style,
}: {
  size: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = `g${size}${color.replace('#', '')}`;
  return (
    <Svg width={size} height={size} style={[{ position: 'absolute' }, style]} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

export function Screen({
  children,
  style,
  backdrop = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  backdrop?: 'default' | 'mirror' | 'chat' | 'none';
}) {
  return (
    <View style={[styles.screen, style]}>
      {backdrop !== 'none' ? <Backdrop variant={backdrop} /> : null}
      {children}
    </View>
  );
}

/** Entrada em cascata: sobe 12px e aparece, com atraso por índice. */
export function Rise({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(index * motion.stagger, withTiming(1, { duration: 520, easing: easeOut }));
  }, [index, progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));
  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

// O Pressable externo precisa receber o layout (flex, largura, margem), senão `flex: 1` só afeta a camada animada.
const OUTER_LAYOUT_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'left', 'right', 'bottom'] as const;

/** Pressable com resposta ao toque (escala 0.97). */
export function PressableScale({
  children,
  style,
  scaleTo = motion.pressScale,
  ...rest
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = { ...flat };
  for (const k of OUTER_LAYOUT_KEYS) {
    if (flat[k] !== undefined) {
      outer[k] = flat[k];
      delete inner[k];
    }
  }
  if (outer.flex !== undefined || outer.flexGrow !== undefined) inner.flexGrow = 1;
  return (
    <Pressable
      {...rest}
      style={outer as ViewStyle}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: motion.pressMs, easing: easeOut });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: motion.pressMs, easing: easeOut });
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[animated, inner as ViewStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Card de destaque: degradê claro do branco ao azul/ciano, com brilhos. */
export function HeroCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  side = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  side?: boolean;
}) {
  const body = (
    <View style={[styles.hero, style]}>
      <LinearGradient
        colors={side ? gradients.heroSide : gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Glow size={240} style={{ right: -80, top: -100 }} />
      <Glow size={260} color={colors.primary} opacity={0.14} style={{ left: -120, bottom: -160 }} />
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {body}
      </PressableScale>
    );
  }
  return body;
}

export function Display({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.display, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** Número com dígitos tabulares. Tamanhos: xs 13 · sm 15 · md 19 · lg 24 · xl 30. */
export function Num({
  children,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityLiveRegion,
}: {
  children: ReactNode;
  size?: NumberSize;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}) {
  return (
    <Text style={[numbers[size], styles.num, style]} accessibilityLabel={accessibilityLabel} accessibilityLiveRegion={accessibilityLiveRegion}>
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const TONE_COLOR = {
  default: colors.text,
  soft: colors.textSoft,
  muted: colors.textMuted,
  primary: colors.primary,
  inverse: '#fff',
} as const;

/** Texto por papel da escala (display, headline, title, section, body, callout, caption, label). */
export function T({
  role = 'body',
  tone = 'default',
  children,
  style,
  numberOfLines,
  header,
}: {
  role?: TextRole;
  tone?: keyof typeof TONE_COLOR;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  header?: boolean;
}) {
  return (
    <Text style={[text[role], { color: TONE_COLOR[tone] }, style]} numberOfLines={numberOfLines} accessibilityRole={header ? 'header' : undefined}>
      {children}
    </Text>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.section} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
            <Text style={styles.sectionAction}>{action}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionMeta}>{action}</Text>
        )
      ) : null}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  compact,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const fg =
    variant === 'primary'
      ? '#fff'
      : variant === 'danger'
        ? colors.dangerText
        : variant === 'soft'
          ? colors.primary
          : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'soft' && styles.btnSoft,
        variant === 'ghost' && styles.btnGhost,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.btnText, compact && styles.btnTextCompact, { color: fg }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'light',
  size = 44,
  badge,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: 'light' | 'primary' | 'soft' | 'glass';
  size?: number;
  badge?: boolean;
}) {
  const bg =
    tone === 'primary'
      ? colors.primary
      : tone === 'soft'
        ? colors.primaryWash
        : tone === 'glass'
          ? 'rgba(255,255,255,0.75)'
          : colors.cardBg;
  const fg = tone === 'primary' ? '#fff' : tone === 'soft' ? colors.primary : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.92}
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        tone === 'primary' && shadows.button,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.44)} color={fg} />
      {badge ? <View style={styles.iconBadge} /> : null}
    </PressableScale>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  icon,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  multiline?: boolean;
  icon?: IconName;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: ComponentProps<typeof TextInput>['autoComplete'];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && { minHeight: 96, alignItems: 'flex-start', paddingVertical: 14 }, focused && styles.inputFocused]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#6b7486"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && { textAlignVertical: 'top' }]}
        />
      </View>
    </View>
  );
}

type Tone = 'neutral' | 'primary' | 'warn' | 'danger' | 'success' | 'solid';

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#f0f2f5', fg: colors.textSoft },
  primary: { bg: colors.primaryTint, fg: colors.primaryDeep },
  warn: { bg: colors.warnSoft, fg: colors.warnText },
  danger: { bg: colors.dangerSoft, fg: colors.dangerText },
  success: { bg: colors.successSoft, fg: colors.success },
  solid: { bg: colors.primary, fg: '#fff' },
};

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && { color: colors.primaryDeep }]}>{label}</Text>
    </PressableScale>
  );
}

export function Avatar({
  initials,
  size = 44,
  tone = 'soft',
}: {
  initials: string;
  size?: number;
  tone?: 'soft' | 'brand' | 'neutral';
}) {
  const content = (
    <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: Math.round(size * 0.32), color: tone === 'brand' ? '#fff' : tone === 'neutral' ? colors.textSoft : colors.primary }}>
      {initials}
    </Text>
  );
  if (tone === 'brand') {
    return (
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        {content}
      </LinearGradient>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone === 'neutral' ? '#f0f2f5' : colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
      {content}
    </View>
  );
}

/** Quadrado arredondado com ícone (ou iniciais) — usado em listas e atalhos. */
export function IconTile({
  icon,
  initials,
  size = 40,
  tone = 'soft',
}: {
  icon?: IconName;
  initials?: string;
  size?: number;
  tone?: 'soft' | 'brand' | 'warm' | 'neutral' | 'primary';
}) {
  const radius = Math.round(size * 0.36);
  const fg = tone === 'brand' || tone === 'primary' ? '#fff' : tone === 'warm' ? colors.warn : tone === 'neutral' ? colors.textSoft : colors.primary;
  const inner = icon ? (
    <Ionicons name={icon} size={Math.round(size * 0.48)} color={fg} />
  ) : (
    <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: Math.round(size * 0.32), color: fg }}>{initials}</Text>
  );
  if (tone === 'brand') {
    return (
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
        {inner}
      </LinearGradient>
    );
  }
  const bg = tone === 'warm' ? '#ffebdd' : tone === 'neutral' ? '#f0f2f5' : tone === 'primary' ? colors.primary : colors.primaryWash;
  return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{inner}</View>;
}

export function StatTile({
  value,
  label,
  accent,
  style,
}: {
  value: string;
  label: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stat, style]}>
      <Num size="md" style={accent && { color: colors.primary }}>{value}</Num>
      <Muted style={{ marginTop: 2 }}>{label}</Muted>
    </View>
  );
}

export type StatItem = { value: string | number; label: string; accent?: boolean };

/** Fileira de números com legenda (treinos, séries, carga…). */
export function StatStrip({
  items,
  align = 'start',
  style,
}: {
  items: StatItem[];
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.statStrip, style]}>
      {items.map((it) => (
        <View
          key={it.label}
          style={[styles.statCell, align === 'center' && { alignItems: 'center' }]}
          accessible
          accessibilityLabel={`${it.value} ${it.label}`}
        >
          <Num size="md" style={it.accent && { color: colors.primary }}>{it.value}</Num>
          <Muted style={{ marginTop: 2 }}>{it.label}</Muted>
        </View>
      ))}
    </View>
  );
}

/** Anel de progresso em degradê ciano → azul. */
export function ProgressRing({
  size = 112,
  stroke = 11,
  progress,
  children,
  accessibilityLabel,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinear id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.cyan} />
            <Stop offset="1" stopColor={colors.primary} />
          </SvgLinear>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

/** Barra de progresso horizontal em degradê. */
export function ProgressBar({ progress, height = 8 }: { progress: number; height?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.track, overflow: 'hidden' }}>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${p * 100}%`, height: '100%', borderRadius: height }} />
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
}) {
  return (
    <View style={styles.empty}>
      {icon ? <IconTile icon={icon} size={56} /> : null}
      <Text style={[styles.title, { textAlign: 'center' }]}>{title}</Text>
      {subtitle ? <T role="callout" tone="muted" style={{ textAlign: 'center' }}>{subtitle}</T> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onMenuPress,
  menuBadge = 0,
  right,
  onBack,
  safe,
}: {
  title: string;
  subtitle?: string;
  onMenuPress?: () => void;
  menuBadge?: number;
  right?: ReactNode;
  onBack?: () => void;
  /** Soma a área segura do topo (notch). Use quando o cabeçalho é o primeiro item da tela. */
  safe?: boolean;
}) {
  const badgeLabel = menuBadge > 9 ? '9+' : String(menuBadge);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, safe && { paddingTop: insets.top + styles.header.paddingTop }]}>
      <View style={styles.headerLeft}>
        {onBack ? <IconButton icon="chevron-back" onPress={onBack} accessibilityLabel="Voltar" /> : null}
        {onMenuPress ? (
          <PressableScale
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel={menuBadge > 0 ? `Abrir fila, ${menuBadge} na fila` : 'Abrir fila'}
            hitSlop={8}
            scaleTo={0.92}
            style={styles.menuBtn}
          >
            <Ionicons name="menu" size={22} color={colors.text} />
            {menuBadge > 0 ? (
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </PressableScale>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Display style={styles.headerTitle}>{title}</Display>
          {subtitle ? <T role="callout" tone="muted" style={{ marginTop: 2 }}>{subtitle}</T> : null}
        </View>
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

/** Barra das telas empurradas: voltar, título central e ação opcional. */
export function TopBar({
  title,
  onBack,
  right,
  tone = 'light',
  safe,
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  tone?: 'light' | 'glass';
  /** Soma a área segura do topo. */
  safe?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, safe && { marginTop: insets.top }]}>
      <View style={styles.topSide}>
        {onBack ? <IconButton icon="chevron-back" onPress={onBack} accessibilityLabel="Voltar" tone={tone} /> : null}
      </View>
      {title ? (
        <Text style={styles.topTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={[styles.topSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  urgencyLabel,
  rightAction,
  leading,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  urgencyLabel?: string;
  rightAction?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, pressed && onPress && { backgroundColor: colors.rowPress }]}
    >
      {leading}
      <View style={styles.listRowMain}>
        <View style={styles.listRowTop}>
          <Body style={styles.listRowTitle} numberOfLines={1}>
            {title}
          </Body>
          {trailing}
        </View>
        {subtitle ? (
          <Muted numberOfLines={1} style={styles.listRowSub}>
            {subtitle}
          </Muted>
        ) : null}
        {(meta || urgencyLabel) && (
          <View style={styles.listRowMeta}>
            {meta ? <Muted numberOfLines={1}>{meta}</Muted> : null}
            {urgencyLabel ? <OwnershipHint label={urgencyLabel} /> : null}
          </View>
        )}
      </View>
      {rightAction}
    </Pressable>
  );
}

export function OwnershipHint({ label }: { label: string }) {
  return <Badge label={label} tone="warn" />;
}

export function Segmented({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  subtitleTone,
  right,
  onPress,
  last,
  danger,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  subtitleTone?: 'success' | 'warn';
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  const subColor = subtitleTone === 'success' ? colors.success : subtitleTone === 'warn' ? colors.warn : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.settingsRow, !last && styles.settingsBorder, pressed && onPress ? { backgroundColor: colors.rowPress } : null]}
    >
      <View style={[styles.settingsIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={icon} size={19} color={danger ? colors.dangerText : colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.settingsTitle, danger && { color: colors.dangerText }]}>{title}</Text>
        {subtitle ? <Text style={[styles.settingsSub, { color: subColor }, subtitleTone && { fontFamily: typography.fontFamilySemiBold }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg + 2,
    ...shadows.card,
  },
  hero: {
    borderRadius: radii.hero,
    padding: 22,
    overflow: 'hidden',
    backgroundColor: '#eef3ff',
    ...shadows.hero,
  },
  display: { ...text.display, color: colors.text },
  title: { ...text.title, color: colors.text },
  body: { ...text.body, color: colors.text },
  muted: { ...text.caption, color: colors.textMuted },
  num: { color: colors.text },
  statStrip: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radii.lg - 2, backgroundColor: 'rgba(255,255,255,0.88)', ...shadows.card },
  label: { ...text.captionStrong, color: colors.textMuted },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xl - 2,
    marginBottom: spacing.md,
  },
  section: { ...text.section, color: colors.text },
  sectionAction: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13.5,
    color: colors.primary,
  },
  sectionMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.textMuted,
  },
  btn: {
    minHeight: 54,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  btnCompact: { minHeight: 40, paddingHorizontal: spacing.lg },
  btnPrimary: { backgroundColor: colors.primary, ...shadows.button },
  btnSecondary: { backgroundColor: colors.cardBg, ...shadows.card },
  btnDanger: { backgroundColor: colors.dangerSoft },
  btnSoft: { backgroundColor: colors.primaryWash },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15.5,
  },
  btnTextCompact: { fontSize: 13.5 },
  iconBadge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: '#fff',
  },
  fieldLabel: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    color: colors.text,
  },
  inputWrap: {
    minHeight: 56,
    borderRadius: radii.control,
    borderWidth: 1.5,
    borderColor: '#e3e9f3',
    backgroundColor: colors.cardBg,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    height: 28,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12.5,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    color: colors.textSoft,
  },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.85)',
    ...shadows.card,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    minHeight: 64,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  headerRight: { marginLeft: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  headerTitle: { flexShrink: 1 },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: typography.fontFamilySemiBold,
  },
  group: { borderRadius: radii.xl, backgroundColor: colors.cardBg, overflow: 'hidden', ...shadows.card },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  settingsBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  settingsIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  settingsTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
  settingsSub: { marginTop: 2, fontFamily: typography.fontFamily, fontSize: 12.5 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  topSide: { width: 52 },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.text,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    minHeight: 72,
  },
  listRowMain: { flex: 1, gap: 3 },
  listRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  listRowTitle: { fontFamily: typography.fontFamilySemiBold, flex: 1 },
  listRowSub: { marginTop: 1, fontSize: 13.5, color: colors.textSoft },
  listRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radii.pill,
    padding: 4,
  },
  segment: {
    flex: 1,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentActive: { backgroundColor: colors.primary, ...shadows.button },
  segmentText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13.5,
    color: colors.textMuted,
  },
  segmentTextActive: { color: '#fff', fontFamily: typography.fontFamilyBold },
});
