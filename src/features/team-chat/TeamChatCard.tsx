import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { TeamAvatar, UnreadPill } from './parts';
import { timeLabel } from './model';
import { useTeamChat } from './TeamChatContext';

/**
 * Entrada do chat interno no Mais. Com mensagens novas, mostra quem escreveu (avatares
 * empilhados), o total e a última mensagem; o contador dá um leve pulo quando chega mais.
 */
export function TeamChatCard({ onPress }: { onPress: () => void }) {
  const { channels, unread } = useTeamChat();
  const reduced = useReducedMotion();
  const withNew = channels.filter((c) => c.unread > 0);
  const latest = [...withNew].sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))[0];
  const stack = (withNew.length ? withNew : channels).slice(0, 3);

  const bump = useSharedValue(1);
  useEffect(() => {
    if (unread > 0 && !reduced) bump.value = withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, { damping: 12, stiffness: 260 }));
  }, [unread, reduced, bump]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const summary = unread > 0
    ? `${unread} ${unread === 1 ? 'mensagem nova' : 'mensagens novas'} em ${withNew.length} ${withNew.length === 1 ? 'conversa' : 'conversas'}`
    : `${channels.length} ${channels.length === 1 ? 'conversa' : 'conversas'} · tudo lido`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat da equipe. ${summary}${latest ? `. Última: ${latest.title}, ${latest.preview ?? ''}` : ''}`}
      style={[styles.card, unread > 0 && styles.cardHot]}
    >
      <View style={styles.top}>
        <View style={styles.icon}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Chat da equipe</Text>
          <Text style={[styles.summary, unread > 0 && { color: colors.primary }]} numberOfLines={1}>{summary}</Text>
        </View>
        {unread > 0 ? (
          <Animated.View style={bumpStyle}>
            <UnreadPill count={unread} />
          </Animated.View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        )}
      </View>

      {latest ? (
        <View style={styles.latest}>
          <View style={styles.stack}>
            {stack.map((c, i) => (
              <View key={c.id} style={[styles.stackItem, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}>
                <TeamAvatar channel={c} size={30} />
              </View>
            ))}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.latestHead}>
              <Text style={styles.latestTitle} numberOfLines={1}>{latest.title}</Text>
              <Text style={styles.latestTime}>{timeLabel(latest.lastAt)}</Text>
            </View>
            <Text style={styles.latestBody} numberOfLines={1}>
              {latest.previewAuthor ? <Text style={styles.latestAuthor}>{`${latest.previewAuthor}: `}</Text> : null}
              {latest.preview}
            </Text>
          </View>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 14, gap: 12, ...shadows.card },
  cardHot: { borderWidth: 1.5, borderColor: colors.primaryTint },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  title: { ...text.bodyStrong, color: colors.text },
  summary: { ...text.caption, color: colors.textMuted, marginTop: 1, fontFamily: typography.fontFamilyMedium },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryWash, borderRadius: 16, padding: 10 },
  stack: { flexDirection: 'row' },
  stackItem: { borderRadius: 16, borderWidth: 2, borderColor: colors.primaryWash },
  latestHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  latestTitle: { ...text.captionStrong, color: colors.text, flexShrink: 1 },
  latestTime: { ...text.label, color: colors.primary, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  latestBody: { ...text.caption, color: colors.textSoft, marginTop: 1 },
  latestAuthor: { fontFamily: typography.fontFamilySemiBold, color: colors.text },
});
