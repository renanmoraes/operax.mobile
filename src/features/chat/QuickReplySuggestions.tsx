import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, shadows, text } from '@/src/design-system/tokens';
import type { QuickReplyLike } from './quickReplyMatch';

const easeOut = Easing.bezier(...motion.easeOut);

/**
 * Lista que sobe acima do campo quando a mensagem termina em "/": filtra os atalhos
 * enquanto se digita e, ao tocar, coloca o texto pronto no campo para revisar e enviar.
 */
export function QuickReplySuggestions({
  term,
  items,
  loading,
  onPick,
}: {
  term: string;
  items: QuickReplyLike[];
  loading?: boolean;
  onPick: (q: QuickReplyLike) => void;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 180, easing: easeOut });
  }, [p]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 8 }] }));

  return (
    <Animated.View style={[styles.panel, anim]} accessibilityLabel="Respostas rápidas">
      <View style={styles.head}>
        <Ionicons name="flash" size={14} color={colors.primary} />
        <Text style={styles.headText}>{term ? `Atalhos com “${term}”` : 'Respostas rápidas'}</Text>
        <Text style={styles.headHint}>toque para usar</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>{loading ? 'Buscando…' : `Nenhum atalho para /${term}`}</Text>
      ) : (
        <ScrollView style={{ maxHeight: 236 }} keyboardShouldPersistTaps="always">
          {items.map((q, i) => (
            <Pressable
              key={q.id}
              onPress={() => onPick(q)}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${q.title}, atalho /${q.slug}`}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.primaryWash }]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.slug}>{`/${q.slug}`}</Text>
                <Text style={styles.title} numberOfLines={1}>{q.title}</Text>
              </View>
              <Text style={styles.body} numberOfLines={2}>{q.body}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 12, marginBottom: 8, borderRadius: 20, backgroundColor: colors.cardBg, overflow: 'hidden', ...shadows.hero },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  headText: { ...text.captionStrong, color: colors.text, flex: 1 },
  headHint: { ...text.label, color: colors.textMuted },
  empty: { ...text.callout, color: colors.textMuted, paddingHorizontal: 14, paddingBottom: 14 },
  row: { paddingHorizontal: 14, paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slug: { ...text.captionStrong, color: colors.primary, backgroundColor: colors.primaryWash, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  title: { ...text.calloutStrong, color: colors.text, flex: 1 },
  body: { ...text.caption, color: colors.textSoft, marginTop: 4 },
});
