import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import { formatHour } from '@/src/shared/format';
import { BUBBLE_RADIUS, ChatMediaData, MediaBubble, MessageMeta, TextWithMeta } from '@/src/features/chat/MessageParts';
import { AudioBubble } from '@/src/features/chat/AudioBubble';
import { assetUri, openViewer } from '@/src/features/media/viewer';
import type { ChatAttachment, ChatMessage } from './types';

/** Endereço do arquivo: o link real ou, no demo, o arquivo embutido no app. */
function fileUri(a: ChatAttachment): string | undefined {
  if (a.uri) return a.uri;
  return 'asset' in a && a.asset ? assetUri(a.asset) : undefined;
}

function toMedia(a: ChatAttachment): ChatMediaData | null {
  if (a.kind === 'image') return { kind: 'image', uri: fileUri(a), width: a.width, height: a.height };
  if (a.kind === 'video') return { kind: 'video', uri: a.uri || undefined, durationS: a.duration_s, title: a.title };
  if (a.kind === 'document') return { kind: 'document', uri: fileUri(a), name: a.name, sizeBytes: a.size_bytes, pages: a.pages };
  return null;
}

export function ChatBubble({ m }: { m: ChatMessage }) {
  const mine = m.from === 'me';
  const at = formatHour(m.at);
  const media = m.attachment ? toMedia(m.attachment) : null;
  const uri = m.attachment ? fileUri(m.attachment) : undefined;
  const open = () => {
    if (!uri || !m.attachment) return;
    if (m.attachment.kind === 'image') openViewer({ kind: 'image', uri, title: m.author_name ? `Foto de ${m.author_name}` : 'Sua foto' });
    else if (m.attachment.kind === 'document') openViewer({ kind: 'pdf', uri, title: m.attachment.name });
    else void Linking.openURL(uri);
  };

  return (
    <View style={[styles.wrap, { alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
      {!mine && m.author_name ? <Text style={styles.author}>{m.author_name}</Text> : null}
      {m.reschedule ? (
        <View style={styles.reschedule}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
            <Text style={styles.rescheduleLabel}>Pedido de outro horário</Text>
          </View>
          <Text style={styles.rescheduleTitle}>{m.reschedule.title}</Text>
          <Text style={styles.rescheduleMeta}>{`Era: ${formatHour(m.reschedule.original_at)}`}</Text>
          {m.text ? <Text style={[styles.text, { marginTop: 10 }]}>{m.text}</Text> : null}
          <View style={styles.metaInside}>
            <MessageMeta at={at} mine={mine} status={m.status} tone="onBubbleTheirs" />
          </View>
        </View>
      ) : m.attachment?.kind === 'audio' ? (
        <AudioBubble
          id={m.id}
          source={m.attachment.asset ?? (m.attachment.uri || null)}
          durationS={m.attachment.duration_s}
          at={at}
          mine={mine}
          status={m.status}
        />
      ) : media ? (
        <MediaBubble media={media} caption={m.text} at={at} mine={mine} status={m.status} onOpen={uri ? open : undefined} />
      ) : (
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          <TextWithMeta at={at} mine={mine} status={m.status} tone={mine ? 'onBubbleMine' : 'onBubbleTheirs'} style={[styles.text, mine && { color: '#fff' }]}>
            {m.text}
          </TextWithMeta>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%' },
  author: { marginLeft: 12, marginBottom: 4, ...text.captionStrong, color: colors.textMuted },
  bubble: { paddingTop: 8, paddingBottom: 7, paddingHorizontal: 12, borderRadius: BUBBLE_RADIUS },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: '#fff', borderBottomLeftRadius: 8 },
  text: { ...text.body, color: colors.text },
  metaInside: { alignSelf: 'flex-end', marginTop: 2 },
  reschedule: { padding: 14, paddingBottom: 8, borderRadius: radii.lg, borderBottomRightRadius: 8, backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: 'rgba(30,78,216,0.25)' },
  rescheduleLabel: { fontFamily: typography.fontFamilyBold, fontSize: 12, color: colors.primary },
  rescheduleTitle: { marginTop: 8, ...text.bodyStrong, color: colors.text },
  rescheduleMeta: { marginTop: 2, ...text.caption, color: colors.textMuted },
});
