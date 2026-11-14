import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Toast, useToast } from '@/src/design-system/Toast';
import { Backdrop, Button, IconButton, Muted } from '@/src/design-system/ui';
import { colors, radii, shadows, text } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AudioBubble } from '@/src/features/chat/AudioBubble';
import { ChatInput } from '@/src/features/chat/ChatInput';
import { BUBBLE_RADIUS, ChatMediaData, MediaBubble, TextWithMeta } from '@/src/features/chat/MessageParts';
import { MicButton, RecordingBar, useVoiceRecorder } from '@/src/features/chat/VoiceRecorder';
import { assetUri, openViewer } from '@/src/features/media/viewer';
import { demoTeamChat } from '@/src/features/team-chat/demoStore';
import { firstName, mapApiMessage, TeamMessage, toneFor } from '@/src/features/team-chat/model';
import { TeamAvatar } from '@/src/features/team-chat/parts';
import { useTeamChat } from '@/src/features/team-chat/TeamChatContext';
import { API_URL } from '@/src/shared/config';
import { listTeamMessages, sendTeamMedia, sendTeamMessage } from '@/src/shared/api/team-chat.api';

/** Conversa do chat interno (grupo ou direta) com texto, foto, PDF e áudio. */
export default function TeamChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const { channels, setOpenChannel, markRead } = useTeamChat();
  const qc = useQueryClient();
  const live = mode === 'live';
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const listRef = useRef<FlatList<TeamMessage>>(null);
  const voice = useVoiceRecorder();
  const { toast, show } = useToast(1800);

  const channel = channels.find((c) => c.id === id);

  // Esta conversa está aberta: não avisa sobre ela e zera as não lidas.
  useEffect(() => {
    setOpenChannel(id ?? null);
    return () => setOpenChannel(null);
  }, [id, setOpenChannel]);

  useSyncExternalStore(demoTeamChat.subscribe, demoTeamChat.version, demoTeamChat.version);
  const query = useQuery({
    queryKey: ['team-chat', 'messages', id],
    enabled: live && !!id,
    refetchInterval: 4000,
    queryFn: async () => (await listTeamMessages(id)).map((m) => mapApiMessage(m, user?.id, API_URL)),
  });
  const thread = live ? query.data ?? [] : demoTeamChat.messages(id);

  // Mensagem nova chegando com a conversa aberta já conta como lida.
  const lastId = thread[thread.length - 1]?.id;
  useEffect(() => {
    if (live && lastId && id) markRead(id);
  }, [live, lastId, id, markRead]);

  const refreshLive = () => {
    void qc.invalidateQueries({ queryKey: ['team-chat', 'messages', id] });
    void qc.invalidateQueries({ queryKey: ['team-chat', 'channels'] });
  };

  const sendMut = useMutation({
    mutationFn: (body: string) => sendTeamMessage(id, body),
    onSuccess: () => {
      setDraft('');
      refreshLive();
    },
    onError: () => show('Falha ao enviar', 'error'),
  });

  const sendText = () => {
    const body = draft.trim();
    if (!body) return;
    if (!live) {
      demoTeamChat.send(id, { type: 'text', body });
      setDraft('');
      return;
    }
    sendMut.mutate(body);
  };

  const pick = async (kind: 'image' | 'document') => {
    setAttachOpen(false);
    try {
      let file: { uri: string; name: string; type: string } | null = null;
      if (kind === 'image') {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        const a = res.canceled ? null : res.assets?.[0];
        if (a) file = { uri: a.uri, name: a.fileName || 'foto.jpg', type: a.mimeType || 'image/jpeg' };
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
        const a = res.canceled ? null : res.assets?.[0];
        if (a) file = { uri: a.uri, name: a.name, type: a.mimeType || 'application/pdf' };
      }
      if (!file) return;
      if (!live) {
        demoTeamChat.send(id, file.type.startsWith('image/') ? { type: 'image', body: '', mediaUri: file.uri } : { type: 'document', body: '', mediaUri: file.uri, fileName: file.name });
        return;
      }
      await sendTeamMedia(id, file);
      refreshLive();
    } catch {
      show('Falha no envio do arquivo', 'error');
    }
  };

  const startVoice = async () => {
    const result = await voice.start();
    if (result !== 'granted') show('Libere o microfone nos ajustes do celular para gravar áudio.', 'error', 'mic-off-outline');
  };

  const sendVoice = async () => {
    const audio = await voice.stop();
    if (!audio) return;
    if (!live) {
      demoTeamChat.send(id, { type: 'audio', body: 'Áudio', mediaUri: audio.uri, durationS: audio.durationS });
      return;
    }
    try {
      await sendTeamMedia(id, {
        uri: audio.uri,
        name: Platform.OS === 'web' ? 'audio.webm' : 'audio.m4a',
        type: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
      });
      refreshLive();
    } catch {
      show('Falha no envio do áudio', 'error');
    }
  };

  if (!channel && !query.isLoading) {
    return (
      <View style={styles.center}>
        <Backdrop variant="chat" />
        <Muted>Conversa não encontrada.</Muted>
        <Button label="Voltar" variant="soft" compact onPress={() => router.back()} style={{ marginTop: 14 }} />
      </View>
    );
  }

  const isGroup = channel?.kind === 'group';
  const subtitle = isGroup ? 'Grupo da equipe' : channel?.online ? 'Online agora' : 'Equipe';

  const fileUri = (m: TeamMessage) => m.mediaUri ?? (m.asset ? assetUri(m.asset) : undefined);

  const renderItem = ({ item, index }: { item: TeamMessage; index: number }) => {
    const prev = thread[index - 1];
    const firstOfRun = !prev || prev.senderId !== item.senderId;
    const showName = isGroup && !item.mine && firstOfRun;
    const align = { alignSelf: item.mine ? ('flex-end' as const) : ('flex-start' as const) };
    const name = showName ? (
      <Text style={[styles.sender, { color: toneFor(item.senderId).fg }]} numberOfLines={1}>{item.senderName}</Text>
    ) : null;

    let bubble: ReactNode;
    if (item.type === 'image' || item.type === 'video' || item.type === 'document') {
      const uri = fileUri(item);
      const media: ChatMediaData = item.type === 'document' ? { kind: 'document', name: item.fileName || 'Documento', uri, sizeBytes: item.sizeBytes } : { kind: item.type, uri };
      const onOpen = uri
        ? () => (item.type === 'image' ? openViewer({ kind: 'image', uri, title: `Foto de ${item.mine ? 'você' : firstName(item.senderName)}` }) : item.type === 'document' ? openViewer({ kind: 'pdf', uri, title: item.fileName }) : undefined)
        : undefined;
      bubble = <MediaBubble media={media} caption={item.body || undefined} at={item.at} mine={item.mine} onOpen={onOpen} />;
    } else if (item.type === 'audio') {
      bubble = <AudioBubble id={item.id} source={item.mediaUri ?? null} durationS={item.durationS} at={item.at} mine={item.mine} />;
    } else {
      bubble = (
        <View style={[styles.bubble, item.mine ? styles.bubbleOut : styles.bubbleIn, !firstOfRun && (item.mine ? { borderTopRightRadius: 8 } : { borderTopLeftRadius: 8 })]}>
          <TextWithMeta at={item.at} mine={item.mine} tone={item.mine ? 'onBubbleMine' : 'onBubbleTheirs'} style={[styles.bubbleText, item.mine && { color: '#fff' }]}>
            {item.body}
          </TextWithMeta>
        </View>
      );
    }
    return (
      <View style={[align, { maxWidth: '82%', marginTop: firstOfRun && index > 0 ? 8 : 0 }]}>
        {name}
        {bubble}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Backdrop variant="chat" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" accessibilityLabel="Voltar" onPress={() => router.back()} />
        {channel ? <TeamAvatar channel={channel} size={42} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{channel?.title ?? 'Carregando…'}</Text>
          <View style={styles.subRow}>
            {!isGroup && channel?.online ? <View style={styles.onlineDot} /> : null}
            <Muted numberOfLines={1} style={{ fontSize: 12.5 }}>{subtitle}</Muted>
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={thread}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 4 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
            <Text style={styles.emptyText}>{query.isLoading ? 'Carregando mensagens…' : 'Comece a conversa com a equipe.'}</Text>
          </View>
        }
      />

      {voice.recording ? (
        <View style={[styles.composer, { paddingHorizontal: 0, paddingTop: 0 }]}>
          <RecordingBar elapsedS={voice.elapsedS} levels={voice.levels} onCancel={() => void voice.cancel()} onSend={() => void sendVoice()} bottomInset={Math.max(insets.bottom, 12)} />
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable onPress={() => setAttachOpen(true)} style={styles.attachBtn} accessibilityRole="button" accessibilityLabel="Anexar foto ou documento">
            <Ionicons name="add" size={24} color={colors.primary} />
          </Pressable>
          <ChatInput value={draft} onChangeText={setDraft} placeholder={isGroup ? `Mensagem para ${channel?.title ?? 'o grupo'}` : 'Mensagem…'} />
          {draft.trim() ? (
            <Pressable onPress={sendText} style={[styles.send, sendMut.isPending && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Enviar">
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <MicButton onPress={() => void startVoice()} />
          )}
        </View>
      )}

      <Toast toast={toast} />

      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Enviar para a equipe">
        <Button label="Foto da galeria" variant="secondary" onPress={() => void pick('image')} />
        <Button label="Documento ou PDF" variant="secondary" onPress={() => void pick('document')} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBg },
  topBar: {
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
    ...shadows.card,
  },
  title: { ...text.section, color: colors.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  sender: { ...text.label, marginBottom: 3, marginLeft: 12 },
  bubble: { borderRadius: BUBBLE_RADIUS, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 7 },
  bubbleIn: { backgroundColor: colors.cardBg, borderBottomLeftRadius: 8, ...shadows.card },
  bubbleOut: { backgroundColor: colors.primary, borderBottomRightRadius: 8, ...shadows.button },
  bubbleText: { ...text.body, color: colors.text },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { ...text.callout, color: colors.textMuted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.cardBg,
    ...shadows.nav,
  },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  send: { backgroundColor: colors.primary, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', ...shadows.button },
});
