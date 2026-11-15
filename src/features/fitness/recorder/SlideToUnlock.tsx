import { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Vibration, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/src/design-system/tokens';

const KNOB = 56;
const PAD = 4;
/** Fração do trilho que precisa ser percorrida para destravar. */
const THRESHOLD = 0.85;

/** Trilho com o cadeado: arrastar até o fim destrava; soltar antes volta ao começo. */
export function SlideToUnlock({ label, a11yLabel, onUnlock, style }: { label: string; a11yLabel: string; onUnlock: () => void; style?: StyleProp<ViewStyle> }) {
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const max = Math.max(0, width - KNOB - PAD * 2);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(0, g.dx), max)),
        onPanResponderRelease: (_, g) => {
          if (max > 0 && g.dx >= max * THRESHOLD) {
            Animated.timing(x, { toValue: max, duration: 90, useNativeDriver: true }).start(() => {
              Vibration.vibrate(30);
              onUnlock();
            });
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [x, max, onUnlock],
  );

  const textOpacity = x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  const fill = x.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [KNOB + PAD * 2, Math.max(KNOB + PAD * 2, width)], extrapolate: 'clamp' });

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onUnlock()}
    >
      <Animated.View style={[styles.fill, { width: fill }]} />
      <Animated.Text style={[styles.label, { opacity: textOpacity }]} numberOfLines={1}>
        {label}
      </Animated.Text>
      <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <Ionicons name="lock-closed" size={22} color={colors.chromeNavy} />
      </Animated.View>
      <View style={styles.end} pointerEvents="none">
        <Ionicons name="lock-open-outline" size={20} color="rgba(255,255,255,0.55)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: KNOB + PAD * 2, borderRadius: 999, backgroundColor: 'rgba(5,10,20,0.88)', justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.primary },
  label: { position: 'absolute', left: KNOB + PAD * 2 + 8, right: 48, textAlign: 'center', fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: '#fff' },
  knob: { position: 'absolute', left: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  end: { position: 'absolute', right: 20 },
});

