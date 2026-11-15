import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, shadows, text, typography } from '@/src/design-system/tokens';
import { firstName, IncomingNotice } from './model';
import { TeamAvatar } from './parts';
import { useTeamChat } from './TeamChatContext';

const SHOW_MS = 5200;
const SPRING = { damping: 24, stiffness: 240, mass: 0.9 };
const easeOut = Easing.bezier(...motion.easeOut);

/**
 * Aviso de mensagem do chat interno: desce do topo em vidro, some sozinho em ~5 s,
 * some ao arrastar para cima e, ao tocar, abre a conversa. Fica fora quando a pessoa
 * já está na própria conversa.
 */
export function IncomingBanner() {
  const { t } = useTranslation('team');
  const { notice, dismissNotice } = useTeamChat();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const pathname = usePathname();
  // O que está na tela: o aviso atual (se não for da conversa aberta) ou o que está saindo.
  const displayed = notice && pathname !== `/equipe/${notice.channelId}` ? notice : null;
  const [exiting, setExiting] = useState<IncomingNotice | null>(null);
  const shown = displayed ?? exiting;
  const y = useSharedValue(-160);
  const drag = useSharedValue(0);

  const hide = useCallback(() => {
    if (!displayed) return;
    setExiting(displayed);
    dismissNotice();
    y.set(reduced ? -160 : withTiming(-160, { duration: 200, easing: easeOut }));
    setTimeout(() => setExiting(null), reduced ? 0 : 210);
  }, [displayed, dismissNotice, reduced, y]);

  // Entra com mola e some sozinho depois de alguns segundos (o efeito limpa o tempo ao trocar).
  useEffect(() => {
    if (!displayed) return;
    drag.set(0);
    y.set(reduced ? 0 : withSpring(0, SPRING));
    const t = setTimeout(hide, SHOW_MS);
    return () => clearTimeout(t);
  }, [displayed, hide, reduced, drag, y]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          drag.set(Math.min(e.translationY, 0) + Math.max(e.translationY, 0) * 0.15);
        })
        .onEnd((e) => {
          if (e.translationY < -24 || e.velocityY < -400) runOnJS(hide)();
          else drag.set(withSpring(0, SPRING));
        }),
    [drag, hide],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value + drag.value }],
  }));

  if (!shown) return null;
  const who = shown.kind === 'group' && shown.senderName ? `${firstName(shown.senderName)}: ` : '';

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, { top: insets.top + 8 }, style]} accessibilityLiveRegion="polite">
        <View style={styles.card}>
          {Platform.OS === 'web' ? (
            <View style={[StyleSheet.absoluteFill, styles.webGlass]} />
          ) : (
            <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
          <Pressable
            onPress={() => {
              hide();
              router.push(`/equipe/${shown.channelId}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={t(shown.kind === 'group' ? 'banner.a11yGroup' : 'banner.a11yDirect', { title: shown.channelTitle, body: shown.body })}
            style={styles.main}
          >
            <TeamAvatar
              channel={{
                id: shown.channelId,
                kind: shown.kind,
                title: shown.channelTitle,
              }}
              size={40}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.head}>
                <Text style={styles.title} numberOfLines={1}>
                  {shown.channelTitle}
                </Text>
                <Text style={styles.tag}>{t('banner.tag')}</Text>
              </View>
              <Text style={styles.body} numberOfLines={2}>
                {who ? <Text style={styles.who}>{who}</Text> : null}
                {shown.body}
              </Text>
            </View>
          </Pressable>
          <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('banner.dismiss')} style={styles.close}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.grabber} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 80,
    alignItems: 'center',
  },
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingRight: 10,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.hero,
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  webGlass: { backdropFilter: 'blur(20px)' } as object,
  tint: { backgroundColor: 'rgba(255,255,255,0.86)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...text.calloutStrong, color: colors.text, flexShrink: 1 },
  tag: { ...text.label, color: colors.primary, marginLeft: 'auto' },
  body: { ...text.callout, color: colors.textSoft, marginTop: 2 },
  who: { fontFamily: typography.fontFamilySemiBold, color: colors.text },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,18,34,0.05)',
  },
  grabber: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(12,18,34,0.14)',
    marginTop: 6,
  },
});
