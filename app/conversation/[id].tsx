import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Backdrop, Button, IconButton, IconTile, Muted } from '@/src/design-system/ui';
import { BUBBLE_RADIUS, ChatMediaData, MediaBubble, TextWithMeta } from '@/src/features/chat/MessageParts';
import { RemoteAudioBubble } from '@/src/features/chat/RemoteAudioBubble';
import { MicButton, RecordingBar, useVoiceRecorder } from '@/src/features/chat/VoiceRecorder';
import { ChatInput, focusAtEnd } from '@/src/features/chat/ChatInput';
import { QuickReplySuggestions } from '@/src/features/chat/QuickReplySuggestions';
import { applyQuickReply, filterQuickReplies, resolveQuickReplyVariables, slashTerm } from '@/src/features/chat/quickReplyMatch';
import { listQuickReplies } from '@/src/shared/api/quick-replies.api';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Toast, useToast } from '@/src/design-system/Toast';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { getConversation as getMockConv, getMessages as getMockMessages, quickReplies as mockQuickReplies, type Message } from '@/src/mocks/data';
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
import { ActionsSheet, ConversationAction } from '@/src/features/conversation-actions/ActionsSheet';
import { BookingSheet } from '@/src/features/conversation-actions/BookingSheet';
import { PixCard } from '@/src/features/conversation-actions/PixCard';
import { PixSheet } from '@/src/features/conversation-actions/PixSheet';
import { QuickRepliesSheet } from '@/src/features/conversation-actions/QuickRepliesSheet';
import { PixData, sendPixMessage } from '@/src/shared/api/conversation-actions.api';
import * as ImagePicker from 'expo-image-picker';
import { SkeletonList } from '@/src/design-system/Skeleton';

type Sheet = 'actions' | 'attach' | 'transfer' | 'quick' | 'pix' | 'booking' | null;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInputInstance>(null);
  const qrTerm = slashTerm(draft);
  const qrQuery = useQuery({
    queryKey: ['quick-replies', 'search', qrTerm],
    enabled: mode === 'live' && qrTerm !== null,
    queryFn: () => listQuickReplies({ search: qrTerm || undefined, limit: 10 }),
    staleTime: 10_000,
  });
  const qrItems = qrTerm === null ? [] : mode === 'live' ? qrQuery.data ?? [] : filterQuickReplies(mockQuickReplies, qrTerm);
  const [localMsgs, setLocalMsgs] = useState<Message[]>([]);
  const listRef = useRef<FlatList<Message>>(null);
  const voice = useVoiceRecorder();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { toast, show } = useToast(2200);
  const switchSheet = (next: Sheet) => {
    setSheet(null);
    setTimeout(() => setSheet(next), 320);
  };

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
  // No modo demo as ações mudam a posse só aqui; no real, a posse vem sempre do servidor.
  const [ownershipOverride, setOwnership] = useState<NonNullable<typeof conversation>['ownership'] | null>(null);
  const ownership = ownershipOverride ?? conversation?.ownership ?? 'queue';

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
    if (liveQuery.isLoading) {
      // Carregando: os balões aparecem como esqueleto, no lugar onde a conversa vai surgir.
      return (
        <View style={styles.root}>
          <Backdrop variant="chat" />
          <SkeletonList variant="bubbles" style={{ paddingTop: insets.top + 80 }} />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Backdrop variant="chat" />
        <Muted>Conversa não encontrada.</Muted>
        <Button label="Voltar" variant="soft" compact onPress={() => router.back()} style={{ marginTop: 14 }} />
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

  const pickAndSend = async (kind: 'image' | 'document' | 'camera') => {
    setSheet(null);
    if (mode === 'mock') {
      showToast(kind === 'document' ? 'Documento (demo)' : 'Mídia (demo)');
      return;
    }
    try {
      if (kind === 'image' || kind === 'camera') {
        if (kind === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            show('Libere a câmera nos ajustes do celular.', 'error', 'camera-outline');
            return;
          }
        }
        const res = kind === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({
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
  const composeBlock = !conversation.within24h ? 'Fora da janela de 24 h: use uma mensagem ativa' : ownership !== 'mine' ? 'Assuma o atendimento para enviar' : undefined;

  const sendPix = async (pix: PixData & { save?: boolean }) => {
    if (mode === 'mock') {
      appendLocal({ type: 'pix', body: 'Chave Pix', pix });
      setSheet(null);
      showToast('Chave Pix enviada');
      return;
    }
    try {
      await sendPixMessage(id, pix);
      setSheet(null);
      await liveQuery.refetch();
      showToast('Chave Pix enviada');
    } catch {
      showToast('Falha ao enviar a chave Pix');
    }
  };

  const guarded = (fn: () => void) => () => {
    if (composeBlock) {
      setSheet(null);
      show(composeBlock, 'info');
      return;
    }
    fn();
  };

  const actions: ConversationAction[] = [
    { key: 'media', label: 'Foto e vídeo', icon: 'images', tone: 'media', blockedReason: composeBlock, onPress: guarded(() => void pickAndSend('image')) },
    { key: 'camera', label: 'Câmera', icon: 'camera', tone: 'camera', blockedReason: composeBlock, onPress: guarded(() => void pickAndSend('camera')) },
    { key: 'document', label: 'Documento', icon: 'document', tone: 'document', blockedReason: composeBlock, onPress: guarded(() => void pickAndSend('document')) },
    { key: 'pix', label: 'Chave Pix', icon: 'diamond', tone: 'pix', blockedReason: composeBlock, onPress: guarded(() => switchSheet('pix')) },
    { key: 'booking', label: 'Agendar horário', icon: 'calendar', tone: 'booking', onPress: () => switchSheet('booking') },
    {
      key: 'template',
      label: 'Mensagem ativa',
      icon: 'document-text',
      tone: 'template',
      onPress: () => {
        setSheet(null);
        router.push({ pathname: '/templates', params: { conversationId: id } });
      },
    },
  ];

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
    // O campo de mensagem sobe junto com o teclado do iPhone (sem esconder o texto e o enviar).
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          if (item.type === 'pix' && item.pix) {
            return (
              <View style={{ alignSelf: out ? 'flex-end' : 'flex-start' }}>
                <PixCard pix={item.pix} at={item.at} mine={out} status={item.status} />
              </View>
            );
          }
          if (item.type === 'audio') {
            return (
              <View style={{ alignSelf: out ? 'flex-end' : 'flex-start' }}>
                <RemoteAudioBubble id={item.id} localUri={item.audioUri} mediaId={item.mediaId} durationS={item.durationS} at={item.at} mine={out} status={item.status} />
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

      {qrTerm !== null && canCompose && !voice.recording ? (
        <QuickReplySuggestions
          term={qrTerm}
          items={qrItems}
          loading={qrQuery.isFetching}
          onPick={(q) => {
            const next = applyQuickReply(draft, resolveQuickReplyVariables(q.body, { name: conversation.contactName }, user?.name ?? ''));
            setDraft(next);
            focusAtEnd(inputRef.current, next);
          }}
        />
      ) : null}

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
            accessibilityLabel="Mais ações: mídia, Pix, agendar"
          >
            <Ionicons name="add" size={24} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => setSheet('quick')}
            style={styles.qrBtn}
            accessibilityRole="button"
            accessibilityLabel="Respostas rápidas e templates"
          >
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
          </Pressable>
          <ChatInput
            inputRef={inputRef}
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

      <ActionsSheet visible={sheet === 'attach'} onClose={() => setSheet(null)} actions={actions} footnote={composeBlock} />

      <QuickRepliesSheet
        visible={sheet === 'quick'}
        onClose={() => setSheet(null)}
        live={mode === 'live'}
        demoItems={mockQuickReplies}
        within24h={conversation.within24h}
        onPick={(q) => {
          setSheet(null);
          const body = resolveQuickReplyVariables(q.body, { name: conversation.contactName }, user?.name ?? '');
          if (!canCompose) {
            show(composeBlock ?? 'Não dá para responder agora', 'info');
            return;
          }
          setDraft((d) => (slashTerm(d) !== null ? applyQuickReply(d, body) : d ? `${d}\n${body}` : body));
        }}
        onTemplates={() => {
          setSheet(null);
          router.push({ pathname: '/templates', params: { conversationId: id } });
        }}
      />

      <PixSheet visible={sheet === 'pix'} onClose={() => setSheet(null)} live={mode === 'live'} onSend={(pix) => void sendPix(pix)} />

      <BookingSheet
        visible={sheet === 'booking'}
        onClose={() => setSheet(null)}
        live={mode === 'live'}
        contactId={conversation.contactId ?? ''}
        contactName={conversation.contactName}
        onBooked={(summary) => {
          setSheet(null);
          show(`Agendado: ${summary}`, 'success', 'calendar-outline');
        }}
        onError={(msg) => show(msg, 'error')}
      />
    </KeyboardAvoidingView>
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
