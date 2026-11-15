import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, numbers, radii, text, typography } from '@/src/design-system/tokens';
import { formatClock } from '@/src/shared/format';
import { paceVsTarget, stepProgress, stepTitle, targetText, type GuideStep } from '../coach';

/**
 * O treino do professor guiando a gravação: a etapa da vez em destaque, quanto falta, o alvo e a próxima.
 * É o que o Strava não tem: aqui quem monta o treino é o professor, e o app conduz.
 */
export function StepGuideCard({
  steps,
  index,
  doneSeconds,
  doneMeters,
  pace,
  onNext,
  compact,
}: {
  steps: GuideStep[];
  index: number;
  doneSeconds: number;
  doneMeters: number;
  /** Ritmo atual (s/km), para comparar com o alvo de ritmo. */
  pace: number | null;
  onNext: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation('fitness');
  if (index >= steps.length) {
    return (
      <View style={[styles.card, styles.done]}>
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.doneTitle}>{t('guide.done')}</Text>
          <Text style={styles.doneSub}>{t('guide.doneSub')}</Text>
        </View>
      </View>
    );
  }
  const step = steps[index];
  const p = stepProgress(step, doneSeconds, doneMeters);
  const target = targetText(step.target);
  const vs = paceVsTarget(pace, step.target);
  const next = steps[index + 1];
  const left = p.leftMeters != null ? t('guide.leftM', { m: p.leftMeters }) : p.leftSeconds != null ? t('guide.left', { time: formatClock(p.leftSeconds) }) : t('guide.untimed');
  const hot = step.kind === 'interval';

  return (
    <View style={[styles.card, hot && styles.hot]}>
      <View style={styles.row}>
        <Text style={[styles.eyebrow, hot && styles.onHot]}>
          {t('guide.eyebrow', { n: index + 1, total: steps.length }) + (step.round && hot ? t('guide.round', { n: step.round.n, of: step.round.of }) : '')}
        </Text>
        <Pressable onPress={onNext} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('guide.nextA11y')} style={[styles.next, hot && styles.nextHot]}>
          <Text style={[styles.nextText, hot && styles.onHot]}>{t('guide.next')}</Text>
          <Ionicons name="play-skip-forward" size={13} color={hot ? '#fff' : colors.primary} />
        </Pressable>
      </View>
      <Text style={[styles.title, hot && styles.onHot]}>{stepTitle(step)}</Text>
      <View style={styles.row}>
        <Text style={[styles.left, hot && styles.onHot]}>{left}</Text>
        {target ? <Text style={[styles.target, hot && styles.onHotSoft]} numberOfLines={1}>{target}</Text> : null}
      </View>
      <View style={[styles.track, hot && styles.trackHot]}>
        <View style={[styles.bar, { width: `${Math.round(p.fraction * 100)}%` }, hot && styles.barHot]} />
      </View>
      {vs && !compact ? (
        <View style={[styles.vs, vs === 'ok' ? styles.vsOk : styles.vsOff]}>
          <Ionicons name={vs === 'ok' ? 'checkmark' : vs === 'fast' ? 'arrow-down' : 'arrow-up'} size={13} color={vs === 'ok' ? colors.success : colors.warnText} />
          <Text style={[styles.vsText, { color: vs === 'ok' ? colors.success : colors.warnText }]}>{vs === 'ok' ? t('guide.onPace') : vs === 'fast' ? t('guide.tooFast') : t('guide.tooSlow')}</Text>
        </View>
      ) : null}
      {next && !compact ? <Text style={[styles.after, hot && styles.onHotSoft]}>{t('guide.after', { step: stepTitle(next) })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, gap: 8, borderRadius: radii.lg, backgroundColor: colors.primaryWash },
  hot: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, letterSpacing: 0.4, color: colors.primaryDeep, textTransform: 'uppercase' },
  title: { ...text.headline, color: colors.text },
  left: { ...numbers.md, color: colors.text },
  target: { flexShrink: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primaryDeep },
  track: { height: 8, borderRadius: 4, backgroundColor: '#d6e1fb', overflow: 'hidden' },
  trackHot: { backgroundColor: 'rgba(255,255,255,0.25)' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  barHot: { backgroundColor: '#fff' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#fff' },
  nextHot: { backgroundColor: 'rgba(255,255,255,0.18)' },
  nextText: { fontFamily: typography.fontFamilyBold, fontSize: 12, color: colors.primary },
  onHot: { color: '#fff' },
  onHotSoft: { color: 'rgba(255,255,255,0.82)' },
  vs: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 999 },
  vsOk: { backgroundColor: colors.successSoft },
  vsOff: { backgroundColor: colors.warnSoft },
  vsText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  after: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: colors.textMuted },
  done: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.successSoft },
  doneTitle: { ...text.bodyStrong, color: colors.text },
  doneSub: { ...text.caption, color: colors.textSoft },
});
