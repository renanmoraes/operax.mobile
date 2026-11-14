import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Backdrop, Button, IconButton, IconTile, Muted } from '@/src/design-system/ui';
import { BUBBLE_RADIUS, ChatMediaData, MediaBubble, TextWithMeta } from '@/src/features/chat/MessageParts';
import { AudioBubble } from '@/src/features/chat/AudioBubble';
import { MicButton, RecordingBar, useVoiceRecorder } from '@/src/features/chat/VoiceRecorder';
import { ChatInput } from '@/src/features/chat/ChatInput';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Toast, useToast } from '@/src/design-system/Toast';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { getConversation as getMockConv, getMessages as getMockMessages, type Message } from '@/src/mocks/data';
import { useAuth } from '@/src/features/auth/AuthContext';
import {
  claimConversation,
  closeConversation,
  getConversation,
  getConversationMessages,
  markConversationRead,
  releaseConversation,
  sendMediaMessage,
  sendTextMessage,
} from '@/src/shared/api/conversations.api';
import { mapApiConversation, mapApiMessage } from '@/src/features/inbox/mapConversation';
import { getSocket } from '@/src/shared/realtime/socket';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

type Sheet = 'actions' | 'attach' | 'transfer' | null;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [localMsgs, setLocalMsgs] = useState<Message[]>([]);
  const listRef = useRef<FlatList<Message>>(null);
  const voice = useVoiceRecorder();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { toast, show } = useToast(1800);

  const mockConv = getMockConv(id);
  const mockThread = useMemo(() => getMockMessages(id), [id]);

  const liveQuery = useQuery({
    queryKey: ['conversation', id],
    enabled: mode === 'live' && !!id,
    queryFn: async () => {
      const [conv, page] = await Promise.all([
        getConversation(id),
        getConversationMessages(id, 80),
      ]);
      await markConversationRead(id).catch(() => undefined);
      return {
        conversation: mapApiConversation(conv, user?.id),
        messages: (page.messages ?? []).map((m) => mapApiMessage(m, id)),
        raw: conv,
      };
    },
  });

  useEffect(() => {
    if (mode !== 'live' || !id) return;
    const socket = getSocket();
    if (!socket) return;
    const onMsg = () => liveQuery.refetch();
    socket.emit?.('join', { conversationId: id });
    socket.on('message.received', onMsg);
    socket.on('message.sent', onMsg);
    return () => {
      socket.off('message.received', onMsg);
      socket.off('message.sent', onMsg);
    };
  }, [mode, id, liveQuery]);

  const conversation = mode === 'live' ? liveQuery.data?.conversation : mockConv;
  const thread = mode === 'live' ? liveQuery.data?.messages ?? [] : [...mockThread, ...localMsgs];
  const [ownership, setOwnership] = useState(conversation?.ownership ?? 'queue');

  useEffect(() => {
    if (conversation?.ownership) setOwnership(conversation.ownership);
  }, [conversation?.ownership]);

  const showToast = (msg: string) => show(msg, msg.startsWith('Falha') ? 'error' : 'success');

  const sendMut = useMutation({
    mutationFn: async (text: string) => sendTextMessage(id, text),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      showToast('Mensagem enviada');
    },
    onError: () => showToast('Falha ao enviar'),
  });

  if (!conversation) {
    return (
      <View style={styles.center}>
        <Backdrop variant="chat" />
        <Muted>{liveQuery.isLoading ? 'Carregando…' : 'Conversa não encontrada.'}</Muted>
        {!liveQuery.isLoading ? <Button label="Voltar" variant="soft" compact onPress={() => router.back()} style={{ marginTop: 14 }} /> : null}
      </View>
    );
  }

  const statusLabel =
    ownership === 'mine' ? 'Com você' : ownership === 'queue' ? 'Na fila' : 'Encerrada';

  const runAction = async (action: 'claim' | 'release' | 'close') => {
    if (mode === 'mock') {
      if (action === 'claim') setOwnership('mine');
      if (action === 'release') setOwnership('queue');
      if (action === 'close') setOwnership('closed');
      showToast(action === 'claim' ? 'Atendimento assumido' : 'Atualizado');
      setSheet(null);
      return;
    }
    try {
      if (action === 'claim') await claimConversation(id);
      if (action === 'release') await releaseConversation(id);
      if (action === 'close') await closeConversation(id);
      await liveQuery.refetch();
      showToast('Atualizado');
    } catch {
      showToast('Falha na ação');
    }
    setSheet(null);
  };

  const pickAndSend = async (kind: 'image' | 'document') => {
    setSheet(null);
    if (mode === 'mock') {
      showToast(kind === 'image' ? 'Mídia (demo)' : 'Documento (demo)');
      return;
    }
    try {
      if (kind === 'image') {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.85,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        await sendMediaMessage(id, {
          uri: asset.uri,
          name: asset.fileName || `media.${asset.mimeType?.includes('video') ? 'mp4' : 'jpg'}`,
          type: asset.mimeType || 'image/jpeg',
        });
      } else {
        const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        await sendMediaMessage(id, {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        });
      }
      await liveQuery.refetch();
      showToast('Mídia enviada');
    } catch {
      showToast('Falha no envio de mídia');
    }
  };

  const canCompose = conversation.within24h && ownership === 'mine';

  const appendLocal = (m: Omit<Message, 'id' | 'conversationId' | 'direction' | 'at' | 'status'>) =>
    setLocalMsgs((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversationId: id,
        direction: 'out',
        at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        ...m,
      },
    ]);

  const startVoice = async () => {
    if (!canCompose) return;
    const result = await voice.start();
    if (result !== 'granted') show('Libere o microfone nos ajustes do celular para gravar áudio.', 'error', 'mic-off-outline');
  };

  const sendVoice = async () => {
    const audio = await voice.stop();
    if (!audio) return;
    if (mode === 'mock') {
      appendLocal({ type: 'audio', body: 'Áudio', audioUri: audio.uri, durationS: audio.durationS });
      return;
    }
    try {
      await sendMediaMessage(id, {
        uri: audio.uri,
        name: Platform.OS === 'web' ? 'audio.webm' : 'audio.m4a',
        type: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
      });
      await liveQuery.refetch();
    } catch {
      showToast('Falha no envio do áudio');
    }
  };

  return (
    <View style={styles.root}>
      <Backdrop variant="chat" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" accessibilityLabel="Voltar" onPress={() => router.back()} />
        <Pressable
          style={styles.contactBlock}
          onPress={() => conversation.contactId && router.push(`/contact/${conversation.contactId}`)}
          accessibilityRole="button"
          accessibilityLabel="Ver contato"
        >
          <Avatar initials={initialsOf(conversation.contactName)} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.contactName} numberOfLines={1}>{conversation.contactName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={[styles.statusDot, ownership === 'mine' ? { backgroundColor: colors.success } : ownership === 'queue' ? { backgroundColor: colors.warn } : null]} />
              <Muted numberOfLines={1} style={{ fontSize: 12.5 }}>
                {conversation.queue} · {statusLabel}
              </Muted>
            </View>
          </View>
        </Pressable>
        <IconButton icon="ellipsis-horizontal" accessibilityLabel="Ações do atendimento" onPress={() => setSheet('actions')} />
      </View>

      {!conversation.within24h ? (
        <View style={styles.windowBanner}>
          <Ionicons name="time-outline" size={18} color={colors.warnText} />
          <Text style={styles.windowText}>Fora da janela de 24 h. Responda com um template aprovado.</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/templates', params: { conversationId: id } })}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.link}>Templates</Text>
          </Pressable>
        </View>
      ) : null}

      {ownership === 'queue' ? (
        <View style={styles.claimBanner}>
          <IconTile icon="hand-left-outline" size={38} />
          <Text style={styles.claimText}>Este contato está na fila. Assuma para responder.</Text>
          <Button label="Assumir" compact onPress={() => runAction('claim')} />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, gap: 8, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const out = item.direction === 'out';
          if (item.type === 'image' || item.type === 'video' || item.type === 'document') {
            const media: ChatMediaData =
              item.type === 'document' ? { kind: 'document', name: item.fileName ?? item.body } : { kind: item.type };
            return (
              <View style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <MediaBubble media={media} caption={item.caption} at={item.at} mine={out} status={item.status} />
              </View>
            );
          }
          if (item.type === 'audio') {
            return (
              <View style={{ alignSelf: out ? 'flex-end' : 'flex-start' }}>
                <AudioBubble id={item.id} source={item.audioUri ?? null} durationS={item.durationS} at={item.at} mine={out} status={item.status} />
              </View>
            );
          }
          return (
            <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
              <TextWithMeta at={item.at} mine={out} status={item.status} tone={out ? 'onBubbleMine' : 'onBubbleTheirs'} style={[styles.bubbleText, out && { color: '#fff' }]}>
                {item.body}
              </TextWithMeta>
            </View>
          );
        }}
      />

      {voice.recording ? (
        <View style={[styles.composer, { paddingHorizontal: 0, paddingTop: 0 }]}>
          <RecordingBar elapsedS={voice.elapsedS} levels={voice.levels} onCancel={() => void voice.cancel()} onSend={() => void sendVoice()} bottomInset={Math.max(insets.bottom, 12)} />
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            onPress={() => setSheet('attach')}
            style={styles.attachBtn}
            accessibilityRole="button"
            accessibilityLabel="Anexar mídia"
          >
            <Ionicons name="add" size={24} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/quick-replies', params: { conversationId: id } })}
            style={styles.qrBtn}
            accessibilityRole="button"
            accessibilityLabel="Respostas rápidas"
          >
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
          </Pressable>
          <ChatInput
            value={draft}
            onChangeText={setDraft}
            placeholder={!conversation.within24h ? 'Use um template' : ownership !== 'mine' ? 'Assuma para responder' : 'Mensagem…'}
            editable={canCompose}
          />
          {draft.trim() || !canCompose ? (
            <Pressable
              onPress={() => {
                if (!draft.trim() || !canCompose) return;
                if (mode === 'mock') {
                  appendLocal({ type: 'text', body: draft.trim() });
                  setDraft('');
                  return;
                }
                sendMut.mutate(draft.trim());
              }}
              style={[styles.send, (!canCompose || !draft.trim()) && { opacity: 0.45 }]}
              accessibilityRole="button"
              accessibilityLabel="Enviar"
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <MicButton onPress={() => void startVoice()} />
          )}
        </View>
      )}

      <Toast toast={toast} />

      <BottomSheet visible={sheet === 'actions'} onClose={() => setSheet(null)} title="Posse e atendimento">
        <Button label="Assumir" onPress={() => runAction('claim')} />
        <Button label="Liberar para a fila" variant="secondary" onPress={() => runAction('release')} />
        <Button label="Transferir…" variant="secondary" onPress={() => setSheet('transfer')} />
        <Button label="Encerrar" variant="danger" onPress={() => runAction('close')} />
        {conversation.contactId ? (
          <Button
            label="Ver contato"
            variant="ghost"
            onPress={() => {
              setSheet(null);
              router.push(`/contact/${conversation.contactId}`);
            }}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'transfer'} onClose={() => setSheet(null)} title="Transferir">
        <Muted>No mobile, libere para a fila ou use o web para escolher atendente.</Muted>
        <Button label="Liberar para a fila" onPress={() => runAction('release')} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'attach'} onClose={() => setSheet(null)} title="Anexar mídia">
        <Button label="Foto / Vídeo" variant="secondary" onPress={() => pickAndSend('image')} />
        <Button label="Documento" variant="secondary" onPress={() => pickAndSend('document')} />
        <Button
          label="Áudio (em breve)"
          variant="ghost"
          onPress={() => {
            setSheet(null);
            show('Áudio na próxima versão', 'info');
          }}
        />
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
  contactBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  contactName: { ...text.section, color: colors.text },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9aa6bd' },
  windowBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.warnSoft,
    borderRadius: radii.md + 2,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  windowText: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 18, color: colors.warnText },
  claimBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  claimText: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13.5, lineHeight: 19, color: colors.textSoft },
  link: { color: colors.warnText, fontFamily: typography.fontFamilyBold, fontSize: 13, textDecorationLine: 'underline' },
  bubble: { maxWidth: '82%', borderRadius: BUBBLE_RADIUS, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 7 },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 8,
    ...shadows.card,
  },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 8, ...shadows.button },
  bubbleText: { ...text.body, color: colors.text },
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
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
});
