import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, shadows, text, zIndex } from './tokens';
import type { IconName } from './ui';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastState = { message: string; tone: ToastTone; icon?: IconName } | null;

/** Guarda o aviso atual e some com ele sozinho depois de `ms`. */
export function useToast(ms = 2200) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: ToastTone = 'success', icon?: IconName) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone, icon });
      timer.current = setTimeout(() => setToast(null), ms);
    },
    [ms],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, show };
}

const TONE: Record<ToastTone, { icon: IconName; color: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success },
  error: { icon: 'alert-circle', color: colors.danger },
  info: { icon: 'information-circle', color: colors.primary },
};

const easeOut = Easing.bezier(...motion.easeOut);

/** Aviso curto em pílula branca. `top` posiciona no alto; sem ele fica acima da barra de baixo. */
export function Toast({ toast, top, bottom = 104 }: { toast: ToastState; top?: number; bottom?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = toast ? withTiming(1, { duration: 200, easing: easeOut }) : 0;
  }, [toast, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * (top != null ? -8 : 8) }, { scale: 0.96 + p.value * 0.04 }],
  }));

  if (!toast) return null;
  const tone = TONE[toast.tone];
  return (
    <Animated.View
      style={[styles.toast, top != null ? { top } : { bottom }, anim]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
    >
      <Ionicons name={toast.icon ?? tone.icon} size={17} color={tone.color} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    zIndex: zIndex.toast,
    ...shadows.hero,
  },
  text: { ...text.calloutStrong, color: colors.text },
});
