import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radii, typography } from '@/src/design-system/tokens';
import { formatHour } from '@/src/shared/format';
import type { ChatAttachment, ChatMessage } from './types';

function sizeLabel(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1000)} KB`;
}

function duration(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function Attachment({ a, mine }: { a: ChatAttachment; mine: boolean }) {
  if (a.kind === 'image') {
    return a.uri ? (
      <Image source={{ uri: a.uri }} style={styles.media} contentFit="cover" accessibilityLabel="Foto enviada" />
    ) : (
      <LinearGradient colors={gradients.photo} style={styles.media}>
        <View style={styles.mediaTag}>
          <Text style={styles.mediaTagText}>Foto</Text>
        </View>
      </LinearGradient>
    );
  }
  if (a.kind === 'video') {
    return (
      <Pressable onPress={() => (a.uri ? void Linking.openURL(a.uri) : undefined)} accessibilityRole="button" accessibilityLabel={`Vídeo ${a.title ?? ''} de ${duration(a.duration_s)}`}>
        <LinearGradient colors={gradients.media} style={styles.media}>
          <View style={styles.play}>
            <Ionicons name="play" size={18} color={colors.text} />
          </View>
          {a.title ? <Text style={styles.videoTitle}>{a.title}</Text> : null}
          <View style={styles.duration}>
            <Text style={styles.durationText}>{duration(a.duration_s)}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }
  if (a.kind === 'document') {
    return (
      <View style={[styles.doc, mine && { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
        <View style={styles.pdf}>
          <Ionicons name="document-text-outline" size={18} color={colors.dangerText} />
          <Text style={styles.pdfText}>PDF</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.docName, mine && { color: '#fff' }]} numberOfLines={1}>{a.name}</Text>
          <Text style={[styles.docMeta, mine && { color: 'rgba(255,255,255,0.8)' }]}>{`${a.pages ? `${a.pages} páginas · ` : ''}${sizeLabel(a.size_bytes)}`}</Text>
        </View>
        {a.uri ? (
          <Pressable onPress={() => void Linking.openURL(a.uri)} accessibilityRole="button" accessibilityLabel={`Abrir ${a.name}`} style={styles.docBtn}>
            <Ionicons name="download-outline" size={16} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    );
  }
  return null;
}

export function ChatBubble({ m }: { m: ChatMessage }) {
  const mine = m.from === 'me';
  const isMedia = m.attachment && m.attachment.kind !== 'document';
  return (
    <View style={[styles.wrap, { alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
      {!mine && m.author_name ? <Text style={styles.author}>{m.author_name}</Text> : null}
      {m.reschedule ? (
        <View style={[styles.reschedule]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
            <Text style={styles.rescheduleLabel}>Pedido de outro horário</Text>
          </View>
          <Text style={styles.rescheduleTitle}>{m.reschedule.title}</Text>
          <Text style={styles.rescheduleMeta}>{`Era: ${formatHour(m.reschedule.original_at)}`}</Text>
          {m.text ? <Text style={[styles.text, { marginTop: 10 }]}>{m.text}</Text> : null}
        </View>
      ) : (
        <View
          style={[
            styles.bubble,
            mine ? styles.mine : styles.theirs,
            isMedia && { padding: 5 },
            m.attachment?.kind === 'document' && { padding: 6 },
          ]}
        >
          {m.attachment ? <Attachment a={m.attachment} mine={mine} /> : null}
          {m.text ? <Text style={[styles.text, mine && { color: '#fff' }, m.attachment && { paddingHorizontal: 9, paddingTop: 8, paddingBottom: 5 }]}>{m.text}</Text> : null}
        </View>
      )}
      <View style={[styles.meta, mine && { justifyContent: 'flex-end' }]}>
        <Text style={styles.time}>{formatHour(m.at)}</Text>
        {mine ? (
          <Ionicons
            name={m.status === 'sending' ? 'time-outline' : 'checkmark-done'}
            size={15}
            color={m.status === 'read' ? colors.primary : '#8c99b0'}
            accessibilityLabel={m.status === 'read' ? 'Lida' : m.status === 'sending' ? 'Enviando' : 'Entregue'}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '80%' },
  author: { marginLeft: 12, marginBottom: 4, fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted },
  bubble: { paddingVertical: 11, paddingHorizontal: 14 },
  mine: { backgroundColor: colors.primary, borderRadius: 22, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: '#fff', borderRadius: 22, borderBottomLeftRadius: 8 },
  text: { fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 21, color: colors.text },
  media: { width: 226, height: 150, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mediaTag: { position: 'absolute', left: 10, top: 10, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' },
  mediaTagText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textSoft },
  play: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  videoTitle: { position: 'absolute', left: 12, bottom: 10, color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  duration: { position: 'absolute', right: 10, bottom: 8, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center' },
  durationText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 11.5 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, width: 246 },
  pdf: { width: 44, height: 52, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  pdfText: { fontFamily: typography.fontFamilyHeavy, fontSize: 10, color: colors.dangerText },
  docName: { fontFamily: typography.fontFamilyBold, fontSize: 13.5, color: colors.text },
  docMeta: { marginTop: 2, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textMuted },
  docBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
  reschedule: { padding: 14, borderRadius: radii.lg, borderBottomRightRadius: 8, backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: 'rgba(30,78,216,0.25)' },
  rescheduleLabel: { fontFamily: typography.fontFamilyBold, fontSize: 12, color: colors.primary },
  rescheduleTitle: { marginTop: 8, fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
  rescheduleMeta: { marginTop: 2, fontFamily: typography.fontFamily, fontSize: 13, color: colors.textMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginHorizontal: 12 },
  time: { fontFamily: typography.fontFamily, fontSize: 11.5, color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
