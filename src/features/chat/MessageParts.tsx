import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, text } from '@/src/design-system/tokens';

/**
 * Peças das mensagens de chat no padrão do WhatsApp:
 * mídia ocupa a bolha inteira (borda de 3 px), hora e tiques por cima da foto,
 * documento com prévia da página em cima e faixa com nome e tamanho embaixo.
 * Usado no chat do cliente e na conversa da equipe.
 */

export const MEDIA_WIDTH = 264;
export const BUBBLE_RADIUS = 20;
const INSET = 3;
const INNER_RADIUS = BUBBLE_RADIUS - INSET;

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | undefined;

export type ChatMediaData =
  | { kind: 'image'; uri?: string; width?: number; height?: number }
  | { kind: 'video'; uri?: string; durationS?: number; title?: string; width?: number; height?: number }
  | { kind: 'document'; uri?: string; name: string; sizeBytes?: number; pages?: number };

export function sizeLabel(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

export function durationLabel(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function extOf(name: string) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : 'arquivo';
}

/** Altura pela proporção real; sem medida, retrato 4:5 como foto de celular. Limita entre 3:4 deitado e 4:3 em pé. */
function mediaHeight(width?: number, height?: number) {
  const ratio = width && height ? height / width : 1.25;
  return Math.round(MEDIA_WIDTH * Math.min(1.33, Math.max(0.75, ratio)));
}

/** Hora + tiques de leitura. `overlay` = branco, para ficar por cima da foto. */
export function MessageMeta({ at, mine, status, tone }: { at: string; mine: boolean; status?: MessageStatus; tone: 'onBubbleMine' | 'onBubbleTheirs' | 'overlay' }) {
  const color = tone === 'overlay' ? '#fff' : tone === 'onBubbleMine' ? 'rgba(255,255,255,0.78)' : colors.textMuted;
  const read = status === 'read';
  const tickColor = tone === 'overlay' ? (read ? colors.cyan : '#fff') : tone === 'onBubbleMine' ? (read ? colors.cyan : 'rgba(255,255,255,0.78)') : read ? colors.primary : colors.textMuted;
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaText, { color }]}>{at}</Text>
      {mine ? (
        <Ionicons
          name={status === 'sending' ? 'time-outline' : status === 'failed' ? 'alert-circle' : status === 'sent' ? 'checkmark' : 'checkmark-done'}
          size={15}
          color={status === 'failed' ? colors.danger : tickColor}
          accessibilityLabel={read ? 'Lida' : status === 'sending' ? 'Enviando' : status === 'failed' ? 'Falhou' : 'Entregue'}
        />
      ) : null}
    </View>
  );
}

function OverlayMeta({ children, left }: { children: ReactNode; left?: ReactNode }) {
  return (
    <LinearGradient colors={['rgba(5,10,20,0)', 'rgba(5,10,20,0.55)']} style={styles.scrim} pointerEvents="none">
      <View style={{ flex: 1 }}>{left}</View>
      {children}
    </LinearGradient>
  );
}

/** Foto ou vídeo ocupando a bolha toda. */
function VisualMedia({ media, meta }: { media: Extract<ChatMediaData, { kind: 'image' | 'video' }>; meta: ReactNode | null }) {
  const h = mediaHeight(media.width, media.height);
  const isVideo = media.kind === 'video';
  return (
    <View style={[styles.visual, { height: h }]}>
      {media.uri && !isVideo ? (
        <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Foto" />
      ) : (
        <LinearGradient colors={isVideo ? gradients.media : gradients.photo} style={[StyleSheet.absoluteFill, styles.center]}>
          {!isVideo ? <Ionicons name="image-outline" size={34} color="rgba(255,255,255,0.75)" /> : null}
        </LinearGradient>
      )}
      {isVideo ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <View style={styles.play}>
            <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
          </View>
        </View>
      ) : null}
      {isVideo && media.title ? (
        <View style={styles.videoTitleWrap} pointerEvents="none">
          <Text style={styles.videoTitle} numberOfLines={1}>{media.title}</Text>
        </View>
      ) : null}
      {meta || (isVideo && media.durationS != null) ? (
        <OverlayMeta
          left={
            isVideo && media.durationS != null ? (
              <View style={styles.meta}>
                <Ionicons name="videocam" size={14} color="#fff" />
                <Text style={[styles.metaText, { color: '#fff' }]}>{durationLabel(media.durationS)}</Text>
              </View>
            ) : null
          }
        >
          {meta}
        </OverlayMeta>
      ) : null}
    </View>
  );
}

/** Documento: prévia da página em cima, faixa com nome e detalhes embaixo. */
function DocumentMedia({ media, mine }: { media: Extract<ChatMediaData, { kind: 'document' }>; mine: boolean }) {
  const ext = extOf(media.name);
  const details = [media.pages ? `${media.pages} ${media.pages === 1 ? 'página' : 'páginas'}` : null, media.sizeBytes ? sizeLabel(media.sizeBytes) : null, ext].filter(Boolean).join(' · ');
  return (
    <View style={{ width: MEDIA_WIDTH }}>
      <View style={styles.page} accessible={false}>
        <View style={styles.sheet}>
          {[0.92, 0.7, 0.84, 0.6, 0.88, 0.74, 0.5].map((w, i) => (
            <View key={i} style={[styles.line, { width: `${w * 100}%` }, i === 0 && styles.lineStrong]} />
          ))}
        </View>
      </View>
      <View style={[styles.docBar, { backgroundColor: mine ? 'rgba(0,0,0,0.16)' : '#f3f5f9' }]}>
        <View style={styles.docIcon}>
          <Text style={styles.docIconText}>{ext === 'arquivo' ? 'DOC' : ext.toUpperCase().slice(0, 4)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.docName, mine && { color: '#fff' }]} numberOfLines={2}>{media.name}</Text>
          <Text style={[styles.docMeta, mine && { color: 'rgba(255,255,255,0.78)' }]} numberOfLines={1}>{details}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Bolha de mídia completa: mídia sem sobra, legenda opcional e hora no lugar certo.
 * Sem legenda, a hora vai por cima da foto/vídeo; com legenda (ou documento), dentro da bolha.
 */
export function MediaBubble({
  media,
  caption,
  at,
  mine,
  status,
  onOpen,
}: {
  media: ChatMediaData;
  caption?: string;
  at: string;
  mine: boolean;
  status?: MessageStatus;
  onOpen?: () => void;
}) {
  const visual = media.kind !== 'document';
  const hasCaption = !!caption?.trim();
  const metaInside = <MessageMeta at={at} mine={mine} status={status} tone={mine ? 'onBubbleMine' : 'onBubbleTheirs'} />;
  const label =
    media.kind === 'image' ? 'Foto' : media.kind === 'video' ? `Vídeo${media.title ? ` ${media.title}` : ''}${media.durationS != null ? `, ${durationLabel(media.durationS)}` : ''}` : `Documento ${media.name}`;

  const body = (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      {visual ? (
        <VisualMedia media={media} meta={hasCaption ? null : <MessageMeta at={at} mine={mine} status={status} tone="overlay" />} />
      ) : (
        <DocumentMedia media={media} mine={mine} />
      )}
      {hasCaption ? <Text style={[styles.caption, mine && { color: '#fff' }]}>{caption}</Text> : null}
      {!visual || hasCaption ? <View style={styles.metaInside}>{metaInside}</View> : null}
    </View>
  );

  return onOpen ? (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Abrir ${label}`} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: INSET, borderRadius: BUBBLE_RADIUS, overflow: 'hidden' },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: '#fff', borderBottomLeftRadius: 8 },
  center: { alignItems: 'center', justifyContent: 'center' },
  visual: { width: MEDIA_WIDTH, borderRadius: INNER_RADIUS, overflow: 'hidden', backgroundColor: '#dfe6f3' },
  play: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(5,10,20,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  videoTitleWrap: { position: 'absolute', left: 12, right: 12, top: 10 },
  videoTitle: { ...text.captionStrong, color: '#fff', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingBottom: 7 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...text.label, fontFamily: 'Inter_500Medium', fontVariant: ['tabular-nums'] },
  metaInside: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingTop: 2, paddingBottom: 4 },
  caption: { ...text.body, color: colors.text, paddingHorizontal: 9, paddingTop: 7, width: MEDIA_WIDTH },
  page: { height: 112, borderTopLeftRadius: INNER_RADIUS, borderTopRightRadius: INNER_RADIUS, backgroundColor: '#e9edf4', overflow: 'hidden', alignItems: 'center', paddingTop: 14 },
  sheet: { width: '78%', flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 12, gap: 7, shadowColor: '#0c1222', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  line: { height: 4, borderRadius: 2, backgroundColor: '#e3e8f0' },
  lineStrong: { height: 6, backgroundColor: '#cfd7e4', marginBottom: 2 },
  docBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomLeftRadius: INNER_RADIUS, borderBottomRightRadius: INNER_RADIUS },
  docIcon: { width: 36, height: 42, borderRadius: 7, backgroundColor: '#e5484d', alignItems: 'center', justifyContent: 'center' },
  docIconText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#fff', letterSpacing: 0.3 },
  docName: { ...text.calloutStrong, color: colors.text },
  docMeta: { ...text.caption, marginTop: 1, color: colors.textMuted },
});
