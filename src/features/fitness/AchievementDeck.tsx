import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { AchievementCardFace, CARD_RADIUS, longDate } from './AchievementCardFace';
import { Burst, DeckAura, FX } from './CelebrationFx';
import { cardPose, dragProgress, settleTarget, sideOf, type DeckDims } from './deckMath';
import type { AchievementCard } from './achievements';

export type DeckHandle = { next: () => void; prev: () => void };

type Shared = {
  /** Índice da carta da frente, com fração durante o arrasto. */
  progress: SharedValue<number>;
  /** O pouco que a carta da frente cede (elástico nas pontas e o empurrãozinho de dica), em pontos. */
  pull: SharedValue<number>;
  /** 0→1: a primeira carta aparece. */
  intro: SharedValue<number>;
  /** 0→1: as cartas de trás abrem em leque. */
  fan: SharedValue<number>;
  /** 0→1 em laço: o reflexo que atravessa a carta da frente. */
  sweep: SharedValue<number>;
};

const DeckCard = memo(function DeckCard({ card, k, w, h, left, top, dims, sv }: { card: AchievementCard; k: number; w: number; h: number; left: number; top: number; dims: DeckDims; sv: Shared }) {
  const side = sideOf(k);
  const { progress, pull, intro, fan, sweep } = sv;
  const pose = useAnimatedStyle(() => {
    const rel = k - progress.value;
    const p = cardPose(rel, side, dims);
    // Quem espera fica escondido atrás da primeira carta até o leque abrir.
    const open = rel > 0 ? 1 - Math.min(1, rel) * (1 - fan.value) : 1;
    // 1 na carta da frente, 0 nas outras: só ela cede ao elástico.
    const front = Math.max(0, 1 - Math.abs(rel) * 2);
    const a = intro.value;
    return {
      opacity: p.opacity * Math.min(1, a * 1.8) * (rel > 0.5 ? fan.value : 1),
      transform: [
        { perspective: 900 },
        { translateX: p.x * open + pull.value * front },
        { translateY: p.y + (1 - a) * 80 },
        { rotateZ: `${p.rot * open + pull.value * front * 0.05}deg` },
        { rotateY: `${(1 - a) * -80}deg` },
        { scale: p.scale * (0.5 + 0.5 * a) },
      ],
    };
  });
  const dim = useAnimatedStyle(() => ({ opacity: cardPose(k - progress.value, side, dims).dim }));
  const shineBox = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(k - progress.value) * 2) }));
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(sweep.value, [0, 0.42, 1], [-w * 0.9, w * 1.3, w * 1.3]) }, { rotateZ: '16deg' }] }));
  const gemW = (40 * w) / 255;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left, top, width: w, height: h }, pose]}>
      <AchievementCardFace card={card} width={w} height={h} />
      <Animated.View style={[styles.clip, shineBox]}>
        <Animated.View style={[styles.shine, shine]}>
          <LinearGradient colors={['#ffffff00', '#ffffff3d', '#ffffff00']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Animated.View>
      {/* Escurece quem espera a vez: a carta e a ponta do selo que passa da moldura. */}
      <Animated.View style={[styles.clip, { backgroundColor: FX.navy }, dim]} />
      <Animated.View style={[{ position: 'absolute', top: -13, left: w / 2 - gemW / 2, width: gemW, height: 13, overflow: 'hidden' }, dim]}>
        <Svg width={gemW} height={gemW * 0.85} viewBox="0 0 40 34">
          <Polygon points="10,1 30,1 39,17 30,33 10,33 1,17" fill={FX.navy} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
});

/**
 * Baralho das conquistas. A carta da frente fica em evidência, com brilho; as próximas esperam atrás, de lado e
 * escurecidas. Passar o dedo para a esquerda joga a carta para fora e traz a seguinte para a frente; para a
 * direita, a anterior volta. Tocar também avança. Nas pontas a carta só cede um pouco.
 */
export const AchievementDeck = forwardRef<DeckHandle, { cards: AchievementCard[]; onIndex?: (i: number) => void }>(function AchievementDeck({ cards, onIndex }, ref) {
  const { t } = useTranslation('fitness');
  const reduce = useReducedMotion();
  const count = cards.length;
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [index, setIndex] = useState(0);
  const current = useRef(0);

  const progress = useSharedValue(0);
  const pull = useSharedValue(0);
  const intro = useSharedValue(0);
  const fan = useSharedValue(0);
  const sweep = useSharedValue(0);
  const sv = useMemo<Shared>(() => ({ progress, pull, intro, fan, sweep }), [progress, pull, intro, fan, sweep]);
  /** Carta em que o baralho está parado ou para a qual já vai (a animação pode ainda estar no meio). */
  const target = useSharedValue(0);
  /** Onde o baralho estava quando o dedo encostou e o que o dedo já tinha andado até o gesto valer. */
  const base = useSharedValue(0);
  const startDx = useSharedValue(0);

  const layout = useMemo(() => {
    if (!box) return null;
    let w = Math.min(310, Math.round(box.w * 0.7));
    let h = Math.round(w * 1.5);
    const maxH = box.h - 46;
    if (h > maxH) {
      h = Math.max(240, Math.round(maxH));
      w = Math.min(w, Math.round(h / 1.36));
    }
    const cy = box.h / 2 - 8;
    const dims: DeckDims = { exitX: -(box.w / 2 + w / 2 + 30), sideX: w * 0.6 };
    return { w, h, cy, left: (box.w - w) / 2, top: cy - h / 2, dims };
  }, [box]);
  const ready = !!layout;
  const travel = layout ? -layout.dims.exitX : 1;

  // Entrada: a primeira carta surge virando, o leque abre atrás dela e, se houver mais, ela dá um empurrãozinho de dica.
  useEffect(() => {
    if (!ready) return;
    if (reduce) {
      intro.value = 1;
      fan.value = 1;
      return;
    }
    intro.value = withDelay(280, withTiming(1, { duration: 760, easing: Easing.out(Easing.back(1.6)) }));
    fan.value = withDelay(900, withSpring(1, { damping: 13, stiffness: 110 }));
    sweep.value = withDelay(1100, withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.quad) }), -1, false));
    if (count > 1) pull.value = withDelay(2800, withSequence(withTiming(-30, { duration: 260, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 150 })));
  }, [ready, reduce, count, intro, fan, sweep, pull]);

  const commit = useCallback(
    (i: number) => {
      if (current.current === i) return;
      current.current = i;
      setIndex(i);
      onIndex?.(i);
    },
    [onIndex],
  );

  const goTo = useCallback(
    (to: number) => {
      if (to < 0 || to > count - 1) return;
      cancelAnimation(pull);
      pull.value = withSpring(0);
      target.value = to;
      progress.value = withTiming(to, { duration: reduce ? 160 : 520, easing: Easing.bezier(0.3, 0.75, 0.2, 1) });
      commit(to);
    },
    [count, reduce, progress, pull, target, commit],
  );
  const step = useCallback((by: number) => goTo(current.current + by), [goTo]);
  useImperativeHandle(ref, () => ({ next: () => step(1), prev: () => step(-1) }), [step]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-24, 24])
      .onStart((e) => {
        cancelAnimation(progress);
        cancelAnimation(pull);
        pull.value = 0;
        base.value = progress.value;
        startDx.value = e.translationX;
      })
      .onUpdate((e) => {
        const d = dragProgress(base.value, target.value, e.translationX - startDx.value, travel, count);
        progress.value = d.progress;
        pull.value = d.pull;
      })
      .onEnd((e) => {
        const v = -e.velocityX / travel;
        const to = settleTarget(target.value, progress.value - base.value, v, count);
        target.value = to;
        progress.value = withSpring(to, { damping: 22, stiffness: 190, mass: 0.9, velocity: v });
        pull.value = withSpring(0, { damping: 16, stiffness: 220 });
        runOnJS(commit)(to);
      });
    const tap = Gesture.Tap()
      .maxDuration(260)
      .onEnd((_e, ok) => {
        if (ok) runOnJS(step)(1);
      });
    return Gesture.Race(pan, tap);
  }, [progress, pull, base, target, startDx, travel, count, commit, step]);

  // Só as cartas perto da frente ficam montadas. Na ordem inversa: a de índice menor é desenhada por cima,
  // então quem sai e quem está na frente sempre cobrem as que esperam.
  const visible = useMemo(() => {
    const from = Math.max(0, index - 2);
    const to = Math.min(count - 1, index + 3);
    return Array.from({ length: to - from + 1 }, (_, i) => to - i);
  }, [index, count]);

  const front = cards[Math.min(index, count - 1)];
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.root}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('ach.cards.deckA11y', { n: index + 1, total: count, name: front.name })}
        accessibilityValue={{ text: [front.description, front.exact ? longDate(front.earned_at!) : t('ach.cards.edition', { year: front.editionYear ?? 0 })].filter(Boolean).join('. ') }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        {layout && box ? (
          <>
            <DeckAura cx={box.w / 2} cy={layout.cy} size={Math.round(Math.min(box.w * 1.55, layout.h * 1.75))} />
            <View pointerEvents="none" style={[styles.ring, { width: layout.w + 70, left: (box.w - layout.w - 70) / 2, top: layout.top + layout.h - 20 }]} />
            <View pointerEvents="none" style={[styles.ring, styles.ring2, { width: layout.w + 130, left: (box.w - layout.w - 130) / 2, top: layout.top + layout.h - 24 }]} />
            {visible.map((k) => (
              <DeckCard key={cards[k].key} card={cards[k]} k={k} w={layout.w} h={layout.h} left={layout.left} top={layout.top} dims={layout.dims} sv={sv} />
            ))}
            <Burst x={box.w / 2} y={layout.cy - layout.h * 0.2} />
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  clip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  shine: { position: 'absolute', top: -40, bottom: -40, width: 80 },
  ring: { position: 'absolute', height: 36, borderRadius: 999, borderWidth: 1.5, borderColor: `${FX.cyan}55` },
  ring2: { height: 48, borderWidth: 1, borderColor: `${FX.cyan}2b` },
});
