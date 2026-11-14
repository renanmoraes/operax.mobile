import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/src/design-system/ui';
import { colors, numbers, shadows, text, typography } from '@/src/design-system/tokens';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { TeamChannel, timeLabel, toneFor } from './model';

/** Grupo: quadrado arredondado na cor tonal do grupo. Direta: círculo com ponto de online. */
export function TeamAvatar({ channel, size = 48 }: { channel: Pick<TeamChannel, 'id' | 'kind' | 'title' | 'online'>; size?: number }) {
  if (channel.kind === 'group') {
    const tone = toneFor(channel.id);
    return (
      <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="people" size={Math.round(size * 0.44)} color={tone.fg} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: Math.round(size * 0.32), color: colors.primary }}>{initialsOf(channel.title)}</Text>
      </View>
      {channel.online ? <View style={[styles.online, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
    </View>
  );
}

/** Número de não lidas em pílula azul (dígitos tabulares; "99+" acima disso). */
export function UnreadPill({ count, style }: { count: number; style?: object }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.pill, style]}>
      <Text style={styles.pillText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export function ChannelRow({ channel, onPress, last }: { channel: TeamChannel; onPress: () => void; last?: boolean }) {
  const unread = channel.unread > 0;
  const time = timeLabel(channel.lastAt);
  const a11y = `${channel.kind === 'group' ? 'Grupo' : 'Conversa com'} ${channel.title}${unread ? `, ${channel.unread} não lidas` : ''}${channel.preview ? `. ${channel.previewAuthor ? `${channel.previewAuthor}: ` : ''}${channel.preview}` : ''}`;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={styles.row}>
      <TeamAvatar channel={channel} />
      <View style={[styles.rowBody, !last && styles.rowDivider]}>
        <View style={styles.rowTop}>
          {channel.pinned ? <Ionicons name="pin" size={12} color={colors.textMuted} style={{ marginRight: 2 }} /> : null}
          <Text style={[styles.title, unread && { fontFamily: typography.fontFamilyBold }]} numberOfLines={1}>{channel.title}</Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {channel.previewAuthor ? <Text style={styles.author}>{`${channel.previewAuthor}: `}</Text> : null}
            {channel.preview || (channel.kind === 'group' ? 'Grupo da equipe' : 'Conversa direta')}
          </Text>
          <UnreadPill count={channel.unread} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  online: { position: 'absolute', right: -1, bottom: -1, backgroundColor: '#22c55e', borderWidth: 2.5, borderColor: '#fff' },
  pill: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  pillText: { ...numbers.xs, fontSize: 12, lineHeight: 15, color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 },
  rowBody: { flex: 1, minWidth: 0, paddingVertical: 13, paddingRight: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...text.bodyStrong, color: colors.text, flexShrink: 1 },
  time: { ...text.caption, color: colors.textMuted, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  timeUnread: { color: colors.primary, fontFamily: typography.fontFamilySemiBold },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  preview: { ...text.callout, color: colors.textMuted, flex: 1, minWidth: 0 },
  previewUnread: { color: colors.text },
  author: { fontFamily: typography.fontFamilySemiBold, color: colors.textSoft },
});
