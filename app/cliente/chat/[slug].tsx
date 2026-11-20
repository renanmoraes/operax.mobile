import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Body, Button, Card, IconButton, IconName, IconTile, Muted, PressableScale, Screen } from '@/src/design-system/ui';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { MicButton, RecordingBar, useVoiceRecorder } from '@/src/features/chat/VoiceRecorder';
import { ChatInput } from '@/src/features/chat/ChatInput';
import { colors, gradients, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { ChatBubble } from '@/src/features/client/ChatBubble';
import { useBooking, useChat, useCompanies, useMarkChatRead, useSendChat } from '@/src/features/client/useClientData';
import { clientDataMode } from '@/src/features/client/dataMode';
import { UserFacingError } from '@/src/features/client/userFacingError';
import type { OutgoingAttachment } from '@/src/features/client/types';
import { openSystemSettings } from '@/src/features/permissions/permissions';
import { formatHour, weekdayShort } from '@/src/shared/format';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';

function AttachOption({ icon, label, tone, onPress }: { icon: IconName; label: string; tone: 'primary' | 'soft' | 'neutral'; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.attachOpt}>
      <IconTile icon={icon} size={60} tone={tone} />
      <Text style={styles.attachLabel}>{label}</Text>
    </PressableScale>
  );
}

export default function ClientChatScreen() {
  const { t } = useTranslation(['client', 'common']);
  const insets = useSafeAreaInsets();
  const { slug, remarcar, pedido } = useLocalSearchParams<{ slug: string; remarcar?: string; pedido?: string }>();
  const { data: chat } = useChat(slug);
  const { data: companies } = useCompanies();
  const { data: booking } = useBooking(remarcar);
  const send = useSendChat(slug);
  const { mutate: markRead } = useMarkChatRead();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [text, setText] = useState(pedido ? t('chat.draftRequest') : remarcar ? t('chat.draftReschedule') : '');
  const [sheet, setSheet] = useState(false);
  const [info, setInfo] = useState(false);
  const [draft, setDraft] = useState<OutgoingAttachment | null>(null);
  const [caption, setCaption] = useState('');
  const [permIssue, setPermIssue] = useState<string | null>(null);
  const [withReschedule, setWithReschedule] = useState(!!remarcar);
  const voice = useVoiceRecorder();
  const [sendError, setSendError] = useState<string | null>(null);
  // O chat do portal recebe só texto por enquanto (fotos, áudio e arquivos chegam só da equipe).
  const textOnly = clientDataMode() === 'live';

  useEffect(() => {
    if (slug) markRead(slug);
  }, [slug, markRead]);

  const company = companies?.find((c) => c.slug === slug);

  async function pickCamera() {
    setSheet(false);
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      setPermIssue(t('chat.cameraDenied'));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!r.canceled) applyAsset(r.assets[0]);
  }

  async function pickGallery() {
    setSheet(false);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!r.canceled) applyAsset(r.assets[0]);
  }

  async function pickDocument() {
    setSheet(false);
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (!r.canceled) {
      const a = r.assets[0];
      setDraft({ kind: 'document', uri: a.uri, name: a.name, size_bytes: a.size ?? 0 });
    }
  }

  function applyAsset(a: ImagePicker.ImagePickerAsset) {
    setDraft(
      a.type === 'video'
        ? { kind: 'video', uri: a.uri, duration_s: Math.round((a.duration ?? 0) / 1000), size_bytes: a.fileSize }
        : { kind: 'image', uri: a.uri, size_bytes: a.fileSize, name: a.fileName ?? undefined },
    );
  }

  async function sendText() {
    if ((!text.trim() && !withReschedule) || send.isPending) return;
    setSendError(null);
    // O campo segue editável enquanto envia: só limpa se a pessoa não escreveu mais nada nesse meio-tempo.
    const submitted = text;
    try {
      await send.mutateAsync({
        text: submitted.trim(),
        reschedule: withReschedule && booking ? { booking_id: booking.id, title: booking.service_name ?? t('reminders.appointment'), original_at: booking.starts_at } : undefined,
      });
      setText((cur) => (cur === submitted ? '' : cur));
      setWithReschedule(false);
    } catch (e) {
      setSendError(e instanceof UserFacingError ? e.message : t('chat.sendFailed'));
    }
  }

  async function startVoice() {
    const result = await voice.start();
    if (result === 'blocked' || result === 'denied') setPermIssue(t('chat.micDenied'));
    else if (result === 'unavailable') setPermIssue(t('chat.micUnavailable'));
  }

  async function sendVoice() {
    const audio = await voice.stop();
    if (audio) await send.mutateAsync({ text: '', attachment: { kind: 'audio', uri: audio.uri, duration_s: audio.durationS } });
  }

  async function sendDraft() {
    if (!draft) return;
    await send.mutateAsync({ text: caption.trim(), attachment: draft });
    setDraft(null);
    setCaption('');
  }

  return (
    <Screen backdrop="chat">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <IconButton icon="chevron-back" tone="soft" accessibilityLabel={t('common:actions.back')} onPress={() => router.back()} />
          <IconTile initials={company?.initials ?? (chat?.tenant_name ?? '').slice(0, 2).toUpperCase()} size={44} tone="brand" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{chat?.tenant_name}</Text>
            <Muted numberOfLines={1}>{chat?.team_label}</Muted>
          </View>
          <IconButton icon="information-circle-outline" tone="soft" accessibilityLabel={t('chat.infoA11y')} onPress={() => setInfo((v) => !v)} />
        </View>

        {info ? (
          <Card style={styles.info}>
            <Text style={styles.infoTitle}>{t('chat.directTitle')}</Text>
            <Muted style={{ marginTop: 4, lineHeight: 19 }}>{textOnly ? t('chat.directBodyText') : t('chat.directBodyMedia')}</Muted>
            {chat?.service_hours_text ? <Body style={{ marginTop: 10, fontSize: 13.5 }}>{t('chat.serviceHours', { hours: chat.service_hours_text })}</Body> : null}
            {chat?.whatsapp_url ? <Button label={t('chat.continueWhatsapp')} variant="soft" compact icon="logo-whatsapp" onPress={() => void Linking.openURL(chat.whatsapp_url!)} style={{ marginTop: 12, alignSelf: 'flex-start' }} /> : null}
          </Card>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dayChip}>
            <Text style={styles.dayChipText}>{t('agenda.today')}</Text>
          </View>
          {chat?.messages.map((m) => (
            <ChatBubble key={m.id} m={m} />
          ))}
        </ScrollView>

        {permIssue ? (
          <View style={styles.perm}>
            <Body style={{ flex: 1, fontSize: 13, color: colors.warnText }}>{permIssue}</Body>
            <Button label={t('chat.settings')} variant="soft" compact onPress={openSystemSettings} />
            <IconButton icon="close" size={36} accessibilityLabel={t('chat.closeNotice')} onPress={() => setPermIssue(null)} />
          </View>
        ) : null}

        {sendError ? (
          <View style={styles.perm}>
            <Body style={{ flex: 1, fontSize: 13, color: colors.warnText }}>{sendError}</Body>
            <IconButton icon="close" size={36} accessibilityLabel={t('chat.closeNotice')} onPress={() => setSendError(null)} />
          </View>
        ) : null}

        {withReschedule && booking ? (
          <View style={styles.rescheduleDraft}>
            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rdTitle}>{t('chat.rescheduleDraft', { service: booking.service_name ?? '' })}</Text>
              <Muted>{t('chat.was', { time: `${weekdayShort(new Date(booking.starts_at))} ${formatHour(booking.starts_at)}` })}</Muted>
            </View>
            <IconButton icon="close" size={34} accessibilityLabel={t('chat.removeRequest')} onPress={() => setWithReschedule(false)} />
          </View>
        ) : null}

        {voice.recording ? (
          <View style={[styles.composer, { paddingHorizontal: 0, paddingTop: 0 }]}>
            <RecordingBar elapsedS={voice.elapsedS} levels={voice.levels} onCancel={() => void voice.cancel()} onSend={() => void sendVoice()} bottomInset={insets.bottom + 14} />
          </View>
        ) : (
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          {textOnly ? null : (
          <PressableScale onPress={() => setSheet((v) => !v)} accessibilityRole="button" accessibilityLabel={t('chat.attach')} accessibilityState={{ expanded: sheet }} scaleTo={0.92} style={[styles.plus, sheet && { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={24} color={sheet ? '#fff' : colors.text} style={{ transform: [{ rotate: sheet ? '45deg' : '0deg' }] }} />
          </PressableScale>
          )}
          <ChatInput value={text} onChangeText={setText} placeholder={t('chat.placeholder')} />
          {text.trim() || withReschedule || textOnly ? (
            <IconButton icon="send" tone="primary" size={44} accessibilityLabel={t('common:actions.send')} onPress={() => void sendText()} />
          ) : (
            <MicButton onPress={() => void startVoice()} />
          )}
        </View>
        )}

        <BottomSheet visible={sheet} onClose={() => setSheet(false)} closeLabel={t('chat.closeAttach')} title={t('chat.sendToTeam')}>
          <View style={styles.attachRow}>
            {Platform.OS !== 'web' ? <AttachOption icon="camera-outline" label={t('chat.camera')} tone="primary" onPress={() => void pickCamera()} /> : null}
            <AttachOption icon="images-outline" label={t('chat.photosVideos')} tone="soft" onPress={() => void pickGallery()} />
            <AttachOption icon="document-text-outline" label={t('chat.document')} tone="neutral" onPress={() => void pickDocument()} />
          </View>
        </BottomSheet>

        {draft ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pageBg }]}>
            <View style={[styles.previewTop, { paddingTop: insets.top + 12 }]}>
              <IconButton icon="close" accessibilityLabel={t('chat.cancelSend')} onPress={() => setDraft(null)} />
              <View style={{ flex: 1 }}>
                <Muted style={{ fontSize: 12.5 }}>{t('chat.sendTo')}</Muted>
                <Text style={styles.headerTitle}>{chat?.tenant_name}</Text>
              </View>
            </View>
            <View style={styles.previewBody}>
              {draft.kind === 'image' ? (
                <Image source={{ uri: draft.uri }} style={styles.previewMedia} contentFit="contain" accessibilityLabel={t('chat.chosenPhoto')} />
              ) : draft.kind === 'video' ? (
                <LinearGradient colors={gradients.media} style={[styles.previewMedia, { alignItems: 'center', justifyContent: 'center' }]}>
                  <View style={styles.bigPlay}>
                    <Ionicons name="play" size={26} color={colors.text} />
                  </View>
                  <Text style={styles.previewNote}>{t('chat.videoDuration', { s: draft.duration_s ?? 0 })}</Text>
                </LinearGradient>
              ) : (
                <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                  <IconTile icon="document-text-outline" size={64} tone="neutral" />
                  <Text style={styles.infoTitle} numberOfLines={2}>{draft.name}</Text>
                  {draft.size_bytes ? <Muted>{`${Math.max(1, Math.round(draft.size_bytes / 1000))} KB`}</Muted> : null}
                </Card>
              )}
            </View>
            <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
              <ChatInput value={caption} onChangeText={setCaption} placeholder={t('chat.captionPlaceholder')} accessibilityLabel={t('chat.caption')} />
              <Button label={t('common:actions.send')} icon="send" compact loading={send.isPending} onPress={() => void sendDraft()} style={{ minHeight: 44 }} />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, ...shadows.card, zIndex: 2 },
  headerTitle: { ...text.section, color: colors.text },
  info: { marginHorizontal: 16, marginTop: 10 },
  infoTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text, textAlign: 'center' },
  messages: { padding: 16, gap: 10 },
  dayChip: { alignSelf: 'center', height: 26, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#e5e9f0', justifyContent: 'center' },
  dayChipText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textSoft },
  perm: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, padding: 10, paddingLeft: 14, borderRadius: radii.lg - 4, backgroundColor: colors.warnSoft },
  rescheduleDraft: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 8, padding: 10, paddingLeft: 14, borderRadius: radii.lg - 4, backgroundColor: colors.primaryTint },
  rdTitle: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.primaryDeep },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, ...shadows.card },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
  attachRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 18 },
  attachOpt: { alignItems: 'center', gap: 8, width: 96 },
  attachLabel: { ...text.tile, color: colors.text, textAlign: 'center' },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  previewBody: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
  previewMedia: { width: '100%', height: '100%', maxHeight: 520, borderRadius: radii.hero, overflow: 'hidden', backgroundColor: colors.primaryTint },
  bigPlay: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  previewNote: { marginTop: 12, color: '#fff', fontFamily: typography.fontFamilySemiBold },
});
