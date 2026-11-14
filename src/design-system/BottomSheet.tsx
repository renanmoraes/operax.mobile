import { ReactNode, useEffect } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radii, shadows, text, zIndex } from './tokens';

const easeOut = Easing.bezier(...motion.easeOut);

/**
 * Folha que sobe de baixo: fundo escurece, a folha desliza.
 * Toque fora ou no voltar do Android fecha.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  closeLabel = 'Fechar',
  children,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = visible ? withTiming(1, { duration: 280, easing: easeOut }) : 0;
  }, [visible, progress]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * 320 }] }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, panel]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        {title ? (
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        <View style={[{ gap: 10 }, contentStyle]}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    zIndex: zIndex.sheet,
    ...shadows.hero,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.track, marginBottom: 14 },
  title: { ...text.title, color: colors.text, marginBottom: 12 },
});
