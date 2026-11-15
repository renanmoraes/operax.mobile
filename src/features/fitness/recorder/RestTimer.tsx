import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, numbers, radii, text, typography } from '@/src/design-system/tokens';
import { formatClock } from '@/src/shared/format';

const PRESETS = [60, 90, 120];

/**
 * Musculação no app: conta as séries e marca o descanso entre elas. Terminou a série, toca no
 * descanso; quando acaba, o celular vibra e avisa (em voz, se ligada). O Strava só cronometra.
 */
export function RestTimer({ sets, onSets, active, say }: { sets: number; onSets: (n: number) => void; active: boolean; say: (t: string) => void }) {
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(90);
  const [now, setNow] = useState(() => Date.now());
  const warned = useRef(false);
  const { t } = useTranslation('fitness');

  useEffect(() => {
    if (!restEnd) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (!warned.current && restEnd - n <= 0) {
        warned.current = true;
        Vibration.vibrate([0, 350, 180, 350]);
        say(i18n.t('fitness:rest.say', { n: sets + 1 }));
        setRestEnd(null);
      }
    }, 250);
    return () => clearInterval(t);
  }, [restEnd, say, sets]);

  const rest = useCallback(
    (seconds: number) => {
      onSets(sets + 1);
      setRestTotal(seconds);
      warned.current = false;
      const n = Date.now();
      setNow(n);
      setRestEnd(n + seconds * 1000);
    },
    [onSets, sets],
  );

  const left = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;

  if (restEnd) {
    return (
      <View style={[styles.card, styles.resting]}>
        <Text style={styles.restLabel}>{t('rest.title')}</Text>
        <Text style={styles.restClock} accessibilityLabel={t('rest.leftA11y', { count: left })}>{formatClock(left)}</Text>
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${Math.round((1 - left / restTotal) * 100)}%` }]} />
        </View>
        <View style={styles.row}>
          <Pressable onPress={() => setRestEnd((e) => (e ? e + 15_000 : e))} style={styles.ghost} accessibilityRole="button" accessibilityLabel={t('rest.plus15A11y')}>
            <Text style={styles.ghostText}>+15 s</Text>
          </Pressable>
          <Pressable onPress={() => setRestEnd(null)} style={styles.ghost} accessibilityRole="button" accessibilityLabel={t('rest.skipA11y')}>
            <Text style={styles.ghostText}>{t('rest.skip')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>{t('rest.setsDone')}</Text>
          <Text style={styles.count}>{sets}</Text>
        </View>
        {sets > 0 ? (
          <Pressable onPress={() => onSets(sets - 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('rest.undoA11y')} style={styles.undo}>
            <Ionicons name="arrow-undo" size={14} color={colors.textSoft} />
            <Text style={styles.undoText}>{t('rest.undo')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{active ? t('rest.hint') : t('rest.hintPaused')}</Text>
      <View style={styles.row}>
        {PRESETS.map((s) => (
          <Pressable key={s} disabled={!active} onPress={() => rest(s)} accessibilityRole="button" accessibilityLabel={t('rest.presetA11y', { time: formatClock(s) })} style={[styles.preset, !active && { opacity: 0.45 }]}>
            <Ionicons name="timer-outline" size={16} color={colors.primary} />
            <Text style={styles.presetText}>{formatClock(s)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, gap: 10, borderRadius: radii.lg, backgroundColor: '#f6f8fc' },
  resting: { backgroundColor: colors.chromeNavy, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  count: { ...numbers.xl, color: colors.text, marginTop: 2 },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#fff' },
  undoText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textSoft },
  hint: { ...text.caption, color: colors.textSoft },
  preset: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radii.md, backgroundColor: '#fff' },
  presetText: { ...numbers.sm, color: colors.primary },
  restLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8 },
  restClock: { fontFamily: typography.fontFamilySemiBold, fontSize: 56, lineHeight: 62, letterSpacing: -2, color: '#fff', fontVariant: ['tabular-nums'] },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.cyan },
  ghost: { flex: 1, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  ghostText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: '#fff' },
});
