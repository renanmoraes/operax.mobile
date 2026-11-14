import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, shadows, text, typography } from '@/src/design-system/tokens';
import { initialsOf } from '@/src/features/inbox/ConversationCard';

export type MentionItem = { id: string; name: string; sub?: string | null };

const TEAL = '#0f766e';

/** Lista que sobe acima do campo ao digitar "@" (equipe) ou "#" (paciente/cliente). */
export function MentionSuggestions({
  kind,
  query,
  items,
  loading,
  onPick,
}: {
  kind: 'user' | 'contact';
  query: string;
  items: MentionItem[];
  loading?: boolean;
  onPick: (item: MentionItem) => void;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 180, easing: Easing.bezier(...motion.easeOut), reduceMotion: ReduceMotion.Never }));
  }, [p]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 8 }] }));
  const isUser = kind === 'user';
  const tint = isUser ? colors.primary : TEAL;

  return (
    <Animated.View style={[styles.panel, anim]} accessibilityLabel={isUser ? 'Marcar alguém da equipe' : 'Marcar paciente'}>
      <View style={styles.head}>
        <Ionicons name={isUser ? 'at' : 'medkit-outline'} size={14} color={tint} />
        <Text style={styles.headText}>{isUser ? 'Marcar alguém da equipe' : 'Marcar paciente ou cliente'}</Text>
        <Text style={styles.hint}>{isUser ? 'recebe notificação' : 'fica ligado à ficha'}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>{loading ? 'Buscando…' : query ? `Ninguém encontrado para “${query}”` : isUser ? 'Digite o nome de alguém da equipe' : 'Digite o nome do paciente'}</Text>
      ) : (
        <ScrollView style={{ maxHeight: 232 }} keyboardShouldPersistTaps="always">
          {items.map((it, i) => (
            <Pressable
              key={it.id}
              onPress={() => onPick(it)}
              accessibilityRole="button"
              accessibilityLabel={`${isUser ? 'Marcar' : 'Citar paciente'} ${it.name}`}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.rowPress }]}
            >
              <View style={[styles.avatar, { backgroundColor: isUser ? colors.primaryTint : '#dcf6f1' }]}>
                <Text style={[styles.avatarText, { color: tint }]}>{initialsOf(it.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{it.name}</Text>
                {it.sub ? <Text style={styles.sub}>{it.sub}</Text> : null}
              </View>
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
  hint: { ...text.label, color: colors.textMuted },
  empty: { ...text.callout, color: colors.textMuted, paddingHorizontal: 14, paddingBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.fontFamilyBold, fontSize: 12 },
  name: { ...text.calloutStrong, color: colors.text },
  sub: { ...text.caption, color: colors.textMuted },
});
