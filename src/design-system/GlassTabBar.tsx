import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, shadows, typography } from './tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const GLASS_TAB_BAR_SPACE = 112;

const ICON = 22;
const COLLAPSED = 52;
const PAD_LEFT = 15;
const PAD_RIGHT = 18;
const GAP = 8;
/**
 * Abertura lenta e gradual: a pílula nasce como um círculo atrás do ícone e vai se
 * esticando devagar, descobrindo o nome pela borda. Fechar é um pouco mais rápido.
 */
const SMOOTH = Easing.bezier(0.45, 0, 0.15, 1);
const OPEN = { duration: 900, easing: SMOOTH };
const CLOSE = { duration: 460, easing: SMOOTH };
const easeOut = Easing.bezier(...motion.easeOut);

/**
 * Um item da barra. Ao ficar ativo, um círculo azul surge atrás do ícone (que fica branco)
 * e a pílula vai se esticando devagar (~0,9 s), descobrindo o nome pela borda. Ao sair,
 * faz o caminho inverso mais depressa, e pode ser interrompido no meio.
 */
function TabItem({
  focused,
  label,
  badge,
  renderIcon,
  onPress,
  maxWidth,
}: {
  focused: boolean;
  label: string;
  /** Espaço máximo que a aba aberta pode ocupar (telas estreitas). Se o nome não couber inteiro, fica só o ícone. */
  maxWidth?: number;
  /** `true` mostra um ponto; um número mostra o contador (some quando a aba está aberta). */
  badge: boolean | number;
  renderIcon: (color: string) => ReactNode;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(1);
  const [labelW, setLabelW] = useState(0);

  useEffect(() => {
    p.set(reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, focused ? OPEN : CLOSE));
  }, [focused, reduced, p]);

  const full = PAD_LEFT + ICON + GAP + labelW + PAD_RIGHT;
  // Nunca corta o nome: se não cabe inteiro, a pílula fica redonda só com o ícone.
  const fits = maxWidth == null || full <= maxWidth;
  const expanded = fits ? full : COLLAPSED;

  const container = useAnimatedStyle(() => ({
    // primeiro o círculo azul surge atrás do ícone; só então a pílula começa a esticar
    width: labelW ? interpolate(p.value, [0.14, 1], [COLLAPSED, expanded], 'clamp') : COLLAPSED,
    transform: [{ scale: press.value }],
  }));
  const pill = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.16], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(p.value, [0, 0.2], [0.86, 1], 'clamp') }],
  }));
  const content = useAnimatedStyle(() =>
    !fits
      ? { transform: [{ translateX: (COLLAPSED - ICON) / 2 }] }
      : {
          // centralizado quando fechado; alinhado à esquerda (com respiro) quando aberto
          transform: [{ translateX: interpolate(p.value, [0, 1], [(COLLAPSED - ICON) / 2, PAD_LEFT]) }],
        },
  );
  const labelStyle = useAnimatedStyle(() => ({
    // o nome é descoberto pela borda da pílula enquanto ela cresce, ganhando cor aos poucos
    opacity: fits ? interpolate(p.value, [0.28, 0.92], [0, 1], 'clamp') : 0,
    transform: [{ translateX: interpolate(p.value, [0.14, 1], [-4, 0], 'clamp') }],
  }));
  const iconOn = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.18], [0, 1], 'clamp') }));
  const iconOff = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.18], [1, 0], 'clamp') }));
  const dot = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ scale: 1 - 0.4 * p.value }] }));

  const onMeasure = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w && w !== labelW) setLabelW(w);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => press.set(withTiming(0.96, { duration: motion.pressMs, easing: easeOut }))}
      onPressOut={() => press.set(withTiming(1, { duration: motion.pressMs, easing: easeOut }))}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={
        typeof badge === 'number' && badge > 0
          ? `${label}, ${badge} ${badge === 1 ? 'mensagem nova' : 'mensagens novas'}`
          : badge
            ? `${label}, novas mensagens`
            : label
      }
      style={{ flexShrink: 0 }}
    >
      <Animated.View style={[styles.item, container]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, pill]} />
        <Animated.View style={[styles.content, content]}>
          <View style={styles.icon}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, iconOff]}>{renderIcon(colors.textMuted)}</Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, iconOn]}>{renderIcon('#fff')}</Animated.View>
          </View>
          <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
            {label}
          </Animated.Text>
        </Animated.View>
        {typeof badge === 'number' ? (
          badge > 0 ? (
            <Animated.View style={[styles.count, dot]}>
              <Text style={styles.countText}>{badge > 99 ? '99+' : badge}</Text>
            </Animated.View>
          ) : null
        ) : badge ? (
          <Animated.View style={[styles.dot, dot]} />
        ) : null}
      </Animated.View>
      {/* medida invisível do rótulo, para saber até onde a pílula abre */}
      <Text style={[styles.label, styles.measure]} numberOfLines={1} onLayout={onMeasure} accessible={false} importantForAccessibility="no-hide-descendants">
        {label}
      </Text>
    </Pressable>
  );
}

/** Navegação inferior em pílula de vidro flutuante; o item ativo abre numa pílula azul com rótulo. */
export function GlassTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [barW, setBarW] = useState(0);
  const visible = state.routes.filter((route) => {
    const style = descriptors[route.key].options.tabBarItemStyle as { display?: string } | undefined;
    return style?.display !== 'none';
  });
  // Espaço que sobra para a aba aberta depois das fechadas (padding 8 + borda 1 de cada lado, e um respiro entre elas).
  const maxOpen = barW ? barW - 18 - (visible.length - 1) * (COLLAPSED + 2) : undefined;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={styles.bar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.webGlass]} />
        ) : (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        {visible.map((route) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              badge={typeof options.tabBarBadge === 'number' ? options.tabBarBadge : options.tabBarBadge != null}
              renderIcon={(color) => options.tabBarIcon?.({ focused, color, size: ICON })}
              onPress={onPress}
              maxWidth={maxOpen}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  bar: {
    height: 68,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.nav,
  },
  webGlass: {
    backdropFilter: 'blur(18px)',
  },
  tint: { backgroundColor: colors.glass },
  item: {
    height: COLLAPSED,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  content: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  icon: { width: ICON, height: ICON },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: {
    color: '#fff',
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13.5,
  },
  measure: { position: 'absolute', opacity: 0, left: -9999, top: 0 },
  count: {
    position: 'absolute',
    top: 7,
    right: 5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 10.5, lineHeight: 13, fontVariant: ['tabular-nums'] },
  dot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
