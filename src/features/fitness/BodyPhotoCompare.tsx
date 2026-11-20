import { useNavigation } from 'expo-router';
import i18n from '@/src/i18n';
import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { Rise, Segmented } from '@/src/design-system/ui';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { monthShort } from '@/src/shared/format';
import type { BodyAssessment } from './types';
import { daysBetween } from './bodyEvolution';

const SILHOUETTE = 'M76 90Q100 80 124 90L146 102Q154 106 152 118L144 190Q142 200 135 198L136 228Q138 242 132 254L127 340H107L102 260H98L93 340H73L68 254Q62 242 64 228L65 198Q58 200 56 190L48 118Q46 106 54 102Z';
const HANDLE = 52;
type CompareView = 'before' | 'split' | 'after';

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${monthShort(d)}`;
};

function Photo({ c, tone, width }: { c: BodyAssessment; tone: 'before' | 'after'; width: number }) {
  if (c.photo_uri) return <Image source={{ uri: c.photo_uri }} style={{ width, height: '100%' }} contentFit="cover" />;
  return (
    <LinearGradient colors={tone === 'before' ? ['#d3dae6', '#8e9bb2'] : ['#afc6ff', '#4c74e8']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={{ width, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Svg width={210} height={340} viewBox="0 0 200 340">
        <Circle cx={100} cy={48} r={25} fill="rgba(255,255,255,0.22)" />
        <Path d={SILHOUETTE} fill="rgba(255,255,255,0.22)" />
      </Svg>
    </LinearGradient>
  );
}

/** Antes e depois com a divisória arrastável. Só aparece quando há foto. */
export function BodyPhotoCompare({ before, after, onDragging }: { before: BodyAssessment; after: BodyAssessment; onDragging: (on: boolean) => void }) {
  const navigation = useNavigation();
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<CompareView>('split');
  const pos = useSharedValue(0.5);
  const startPos = useSharedValue(0.5);
  const widthSV = useSharedValue(0);
  const active = useSharedValue(0);

  // Dedo na foto: o "voltar" com o dedo do iPhone fica desligado até soltar.
  const lockBack = useCallback((locked: boolean) => navigation.setOptions({ gestureEnabled: !locked }), [navigation]);
  const onDragStart = useCallback(() => {
    onDragging(true);
    setView('split');
  }, [onDragging]);
  const onDragEnd = useCallback(() => {
    onDragging(false);
    lockBack(false);
  }, [lockBack, onDragging]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onTouchesDown(() => {
        runOnJS(lockBack)(true);
        active.set(withTiming(1, { duration: 140 }));
      })
      .onStart(() => {
        startPos.set(pos.value);
        runOnJS(onDragStart)();
      })
      .onUpdate((e) => {
        const w = widthSV.value || 1;
        pos.set(Math.max(0, Math.min(1, startPos.value + e.translationX / w)));
      })
      .onFinalize(() => {
        active.set(withTiming(0, { duration: 180 }));
        runOnJS(onDragEnd)();
      });
    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e) => {
        const w = widthSV.value || 1;
        pos.set(withTiming(Math.max(0, Math.min(1, e.x / w)), { duration: 320, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
        runOnJS(setView)('split');
      });
    return Gesture.Race(pan, tap);
  }, [active, lockBack, onDragEnd, onDragStart, pos, startPos, widthSV]);

  const showView = (v: CompareView) => {
    setView(v);
    pos.set(withTiming(v === 'before' ? 1 : v === 'after' ? 0 : 0.5, { duration: 520, easing: Easing.bezier(0.45, 0, 0.15, 1) }));
  };

  const beforeClip = useAnimatedStyle(() => ({ width: pos.value * widthSV.value }));
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * widthSV.value - 1.5 }] }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(8, Math.min(widthSV.value - HANDLE - 8, pos.value * widthSV.value - HANDLE / 2)) }, { scale: 1 + 0.12 * active.value }],
  }));
  const beforeTag = useAnimatedStyle(() => ({ opacity: interpolate(pos.value, [0, 0.18], [0, 1], 'clamp') }));
  const afterTag = useAnimatedStyle(() => ({ opacity: interpolate(pos.value, [0.82, 1], [1, 0], 'clamp') }));

  return (
    <>
      <Rise>
        <GestureDetector gesture={gesture}>
          <View
            style={styles.compare}
            onLayout={(e: LayoutChangeEvent) => {
              setWidth(e.nativeEvent.layout.width);
              widthSV.set(e.nativeEvent.layout.width);
            }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={i18n.t('fitness:body.compareA11y')}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              pos.set(withTiming(Math.max(0, Math.min(1, pos.value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))), { duration: 200 }));
            }}
          >
            {width ? (
              <>
                <View style={StyleSheet.absoluteFill}>
                  <Photo c={after} tone="after" width={width} />
                </View>
                <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, beforeClip]}>
                  <Photo c={before} tone="before" width={width} />
                </Animated.View>
                <Animated.View pointerEvents="none" style={[styles.handleLine, lineStyle]} />
                <Animated.View pointerEvents="none" style={[styles.handle, handleStyle]}>
                  <Ionicons name="chevron-back" size={18} color={colors.primary} />
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </Animated.View>
              </>
            ) : null}
            <Animated.View pointerEvents="none" style={[styles.tag, { left: 16 }, beforeTag]}>
              <Text style={styles.tagText}>{i18n.t('fitness:body.beforeDate', { date: shortDate(before.assessed_on) })}</Text>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.tag, { right: 16 }, afterTag]}>
              <Text style={styles.tagText}>{i18n.t('fitness:body.afterDate', { date: shortDate(after.assessed_on) })}</Text>
            </Animated.View>
            <View pointerEvents="none" style={styles.journey}>
              <Text style={styles.journeyText}>{i18n.t('fitness:body.journey', { count: daysBetween(before.assessed_on, after.assessed_on) })}</Text>
            </View>
          </View>
        </GestureDetector>
      </Rise>
      <Segmented
        style={{ marginTop: 14 }}
        value={view}
        onChange={(k) => showView(k as CompareView)}
        options={[
          { key: 'before', label: i18n.t('fitness:body.before') },
          { key: 'split', label: i18n.t('fitness:body.split') },
          { key: 'after', label: i18n.t('fitness:body.after') },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  compare: { height: 380, borderRadius: radii.hero, overflow: 'hidden', backgroundColor: '#dce6fa', ...shadows.hero },
  handleLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#fff', shadowColor: '#0c1836', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  handle: { position: 'absolute', left: 0, top: '50%', marginTop: -HANDLE / 2, width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...shadows.hero },
  tag: { position: 'absolute', top: 16, height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  tagText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: colors.text },
  journey: { position: 'absolute', bottom: 16, alignSelf: 'center', height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center' },
  journeyText: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.primary },
});
