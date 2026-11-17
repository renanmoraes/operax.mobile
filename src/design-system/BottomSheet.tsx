import { ReactNode, useEffect } from 'react';
import i18n from '@/src/i18n';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radii, shadows, text, zIndex } from './tokens';
import { KEYBOARD_BEHAVIOR } from './keyboard';

const easeOut = Easing.bezier(...motion.easeOut);

/**
 * Folha que sobe de baixo: fundo escurece, a folha desliza.
 * Toque fora ou no voltar do Android fecha. Sobe junto com o teclado quando há campos.
 * Conteúdo mais alto que a folha rola por dentro, para o botão do fim não ficar embaixo da barra do sistema.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  closeLabel = i18n.t('actions.close'),
  children,
  contentStyle,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Ações fixas embaixo (ex.: Receber, Agendar): ficam sempre à vista, e só o conteúdo de cima rola. */
  footer?: ReactNode;
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
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.dock} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, panel]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          {title ? (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          <ScrollView style={styles.body} contentContainerStyle={[{ gap: 10 }, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} nestedScrollEnabled>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.overlay },
  dock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    zIndex: zIndex.sheet,
    ...shadows.hero,
  },
  body: { flexGrow: 0, flexShrink: 1 },
  footer: { paddingTop: 12, gap: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.track, marginBottom: 14 },
  title: { ...text.title, color: colors.text, marginBottom: 12 },
});
