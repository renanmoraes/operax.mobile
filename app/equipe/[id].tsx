import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Toast, useToast } from '@/src/design-system/Toast';
import { Backdrop, Button, IconButton, Muted } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AudioBubble } from '@/src/features/chat/AudioBubble';
import { ChatInput, focusAtEnd } from '@/src/features/chat/ChatInput';
import { BUBBLE_RADIUS, ChatMediaData, MediaBubble, TextWithMeta } from '@/src/features/chat/MessageParts';
import { MicButton, RecordingBar, useVoiceRecorder } from '@/src/features/chat/VoiceRecorder';
import { assetUri, openDocument, openViewer } from '@/src/features/media/viewer';
import { demoTeamChat } from '@/src/features/team-chat/demoStore';
import { firstName, mapApiMessage, TeamMessage, toneFor } from '@/src/features/team-chat/model';
import { TeamAvatar } from '@/src/features/team-chat/parts';
import { useTeamChat } from '@/src/features/team-chat/TeamChatContext';
import { API_URL } from '@/src/shared/config';
import { listTeamMessages, searchTeamUsers, sendTeamMedia, sendTeamMessage } from '@/src/shared/api/team-chat.api';
import { listContacts } from '@/src/shared/api/contacts.api';
import { mergeThread, retainWindow } from '@/src/features/team-chat/thread';
import { applyPick, compactName, ContactRef, detectPicker, MentionUser, mentionsInBody, splitMentions } from '@/src/features/team-chat/mentions';
import { MentionItem, MentionSuggestions } from '@/src/features/team-chat/MentionSuggestions';
import { phoneLabel } from '@/src/features/agenda/bookingDetails';
import { contacts as mockContacts, teamUsers } from '@/src/mocks/data';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';

const PAGE = 60;

/** Conversa do chat interno (grupo ou direta) com texto, foto, PDF e áudio. */
export default function TeamChatConversationScreenGuarded() {
  const { t } = useTranslation(['team', 'common']);
  return (
    <RequirePermission need="teamChat" title={t('list.title')}>
      <TeamChatConversationScreen />
    </RequirePermission>
  );
}

function TeamChatConversationScreen() {
  const { t } = useTranslation(['team', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const can = useCan();
  const canSend = can('teamChatSend');
  const canMedia = can('teamChatMedia');
  const { channels, setOpenChannel, markRead } = useTeamChat();
  const qc = useQueryClient();
  const live = mode === 'live';
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const listRef = useRef<FlatList<TeamMessage>>(null);
  const scrolledTo = useRef<string | null>(null);
  const voice = useVoiceRecorder();
  const { toast, show } = useToast(1800);

  const channel = channels.find((c) => c.id === id);

  // Esta conversa está aberta e NA TELA: não avisa sobre ela e zera as não lidas. Foto ou PDF aberto por
  // cima (visualizador) tira o foco: a conversa deixa de contar como vista até voltar.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    setOpenChannel(id ?? null);
    return () => setOpenChannel(null);
  }, [id, setOpenChannel, focused]);

  useSyncExternalStore(demoTeamChat.subscribe, demoTeamChat.version, demoTeamChat.version);
  // Mensagens mais antigas que a página atual: carregadas sob demanda e mantidas ao atualizar.
  const [older, setOlder] = useState<TeamMessage[]>([]);
  const query = useQuery({
    queryKey: ['team-chat', 'messages', id],
    enabled: live && !!id,
    // O tempo real atualiza na hora; isto é só reserva se a conexão cair.
    refetchInterval: 15_000,
    queryFn: async () => {
      const page = (await listTeamMessages(id, PAGE)).map((m) => mapApiMessage(m, user?.id, API_URL));
      // Com histórico aberto, a janela das mais novas também fica guardada (a que sai dela não some).
      setOlder((prev) => retainWindow(prev, page));
      return page;
    },
  });
  const [olderDone, setOlderDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const latest = useMemo(() => query.data ?? [], [query.data]);
  const thread = live ? mergeThread(older, latest) : demoTeamChat.messages(id);
  const canLoadOlder = live && !olderDone && (older.length > 0 || latest.length >= PAGE);
  const loadOlder = async () => {
    const first = thread[0];
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = (await listTeamMessages(id, PAGE, first.id)).map((m) => mapApiMessage(m, user?.id, API_URL));
      // Guarda junto a janela atual já na primeira página antiga, para nada se perder no próximo polling.
      setOlder((prev) => retainWindow([...page.filter((m) => !prev.some((p) => p.id === m.id)), ...prev], latest));
      if (page.length < PAGE) setOlderDone(true);
    } catch {
      show(t('chat.loadOlderFailed'), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  // Mensagem nova chegando com a conversa aberta já conta como lida.
  const lastId = thread[thread.length - 1]?.id;
  useEffect(() => {
    if (live && focused && lastId && id) markRead(id);
  }, [live, focused, lastId, id, markRead]);

  const refreshLive = () => {
    void qc.invalidateQueries({ queryKey: ['team-chat', 'messages', id] });
    void qc.invalidateQueries({ queryKey: ['team-chat', 'channels'] });
  };

  // Marcações: "@" busca a equipe (quem é marcado recebe notificação), "#" busca pacientes.
  const picker = detectPicker(draft);
  const [pendingUsers, setPendingUsers] = useState<MentionUser[]>([]);
  const [pendingRefs, setPendingRefs] = useState<ContactRef[]>([]);
  const pickQuery = picker.kind === 'none' ? '' : picker.query;
  const usersQ = useQuery({
    queryKey: ['team-chat', 'mention-users', pickQuery],
    enabled: live && picker.kind === 'user',
    queryFn: () => searchTeamUsers(pickQuery),
    staleTime: 30_000,
  });
  const contactsQ = useQuery({
    queryKey: ['team-chat', 'mention-contacts', pickQuery],
    enabled: live && picker.kind === 'contact',
    queryFn: () => listContacts({ search: pickQuery || undefined, limit: 8 }),
    staleTime: 30_000,
  });
  const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const suggestions: MentionItem[] =
    picker.kind === 'user'
      ? (live ? usersQ.data ?? [] : teamUsers.filter((u) => fold(u.name).includes(fold(pickQuery)))).map((u) => ({ id: u.id, name: u.name, sub: u.email }))
      : picker.kind === 'contact'
        ? live
          ? (contactsQ.data?.items ?? []).map((c) => ({ id: c.id, name: c.name || t('chat.contactFallback'), sub: phoneLabel(c.phone_e164) }))
          : mockContacts.filter((c) => fold(c.name).includes(fold(pickQuery))).slice(0, 8).map((c) => ({ id: c.id, name: c.name, sub: phoneLabel(c.phone) }))
        : [];

  const inputRef = useRef<TextInputInstance>(null);
  const pickMention = (item: MentionItem) => {
    if (picker.kind === 'none') return;
    const next = applyPick(draft, picker, item.name);
    setDraft(next);
    focusAtEnd(inputRef.current, next);
    if (picker.kind === 'user') setPendingUsers((prev) => (prev.some((u) => u.id === item.id) ? prev : [...prev, { id: item.id, name: item.name }]));
    else setPendingRefs((prev) => [...prev.filter((r) => r.contact_id !== item.id), { contact_id: item.id, label: compactName(item.name) }]);
  };

  const sendMut = useMutation({
    mutationFn: ({ body, extras }: { body: string; extras: ReturnType<typeof mentionsInBody>; users: typeof pendingUsers; refs: typeof pendingRefs }) => sendTeamMessage(id, body, extras),
    onSuccess: () => refreshLive(),
    onError: (_e, vars) => {
      // Devolve o texto ao campo só se a pessoa não começou outra mensagem, junto com as marcações
      // (@pessoa, #paciente): sem elas o reenvio sairia sem notificar quem foi marcado.
      setDraft((current) => {
        if (current) return current;
        setPendingUsers(vars.users);
        setPendingRefs(vars.refs);
        return vars.body;
      });
      show(t('chat.sendFailed'), 'error');
    },
  });

  const sendText = () => {
    const body = draft.trim();
    // Um envio por vez: tocar de novo enquanto envia não duplica a mensagem para o canal.
    if (!body || sendMut.isPending) return;
    const extras = mentionsInBody(body, pendingUsers, pendingRefs);
    if (!live) {
      demoTeamChat.send(id, { type: 'text', body });
      setDraft('');
      setPendingUsers([]);
      setPendingRefs([]);
      if (extras.mentions.length) {
        const names = pendingUsers.filter((u) => extras.mentions.includes(u.id)).map((u) => firstName(u.name));
        show(t('chat.notify', { count: names.length, names: names.join(', ') }), 'success', 'notifications-outline');
      }
      return;
    }
    // O campo esvazia já no envio: o que for digitado enquanto envia não é apagado depois.
    const users = pendingUsers;
    const refs = pendingRefs;
    setDraft('');
    setPendingUsers([]);
    setPendingRefs([]);
    sendMut.mutate({ body, extras, users, refs });
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
      show(t('chat.fileFailed'), 'error');
    }
  };

  const startVoice = async () => {
    const result = await voice.start();
    if (result !== 'granted') show(t('chat.micBlocked'), 'error', 'mic-off-outline');
  };

  const sendVoice = async () => {
    const audio = await voice.stop();
    if (!audio) return;
    if (!live) {
      demoTeamChat.send(id, { type: 'audio', body: t('preview.audio'), mediaUri: audio.uri, durationS: audio.durationS });
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
      show(t('chat.audioFailed'), 'error');
    }
  };

  if (!channel && !query.isLoading) {
    return (
      <View style={styles.center}>
        <Backdrop variant="chat" />
        <Muted>{t('chat.notFound')}</Muted>
        <Button label={t('common:actions.back')} variant="soft" compact onPress={() => router.back()} style={{ marginTop: 14 }} />
      </View>
    );
  }

  const isGroup = channel?.kind === 'group';
  const subtitle = isGroup ? t('chat.groupSubtitle') : channel?.online ? t('chat.onlineNow') : t('chat.teamSubtitle');

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
      const media: ChatMediaData = item.type === 'document' ? { kind: 'document', name: item.fileName || t('chat.document'), uri, sizeBytes: item.sizeBytes } : { kind: item.type, uri };
      const onOpen = uri
        ? () => (item.type === 'image' ? openViewer({ kind: 'image', uri, title: item.mine ? t('chat.photoFromYou') : t('chat.photoFrom', { name: firstName(item.senderName) }) }) : item.type === 'document' ? void openDocument(uri, item.fileName || 'documento') : void Linking.openURL(uri))
        : undefined;
      bubble = <MediaBubble media={media} caption={item.body || undefined} at={item.at} mine={item.mine} onOpen={onOpen} />;
    } else if (item.type === 'audio') {
      bubble = <AudioBubble id={item.id} source={item.mediaUri ?? null} durationS={item.durationS} at={item.at} mine={item.mine} />;
    } else {
      bubble = (
        <View style={[styles.bubble, item.mine ? styles.bubbleOut : styles.bubbleIn, !firstOfRun && (item.mine ? { borderTopRightRadius: 8 } : { borderTopLeftRadius: 8 })]}>
          <TextWithMeta at={item.at} mine={item.mine} tone={item.mine ? 'onBubbleMine' : 'onBubbleTheirs'} style={[styles.bubbleText, item.mine && { color: '#fff' }]}>
            {splitMentions(item.body).map((part, i) =>
              part.kind === 'plain' ? (
                part.text
              ) : (
                <Text key={i} style={[styles.mention, part.kind === 'contact' && styles.mentionContact, item.mine && styles.mentionMine]}>
                  {part.text}
                </Text>
              ),
            )}
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
    // O campo de mensagem sobe junto com o teclado do iPhone (sem esconder o texto e o enviar).
    <KeyboardAvoidingView style={styles.root} behavior={KEYBOARD_BEHAVIOR}>
      <Backdrop variant="chat" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" accessibilityLabel={t('common:actions.back')} onPress={() => router.back()} />
        {channel ? <TeamAvatar channel={channel} size={42} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{channel?.title ?? t('chat.loading')}</Text>
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
        onContentSizeChange={() => {
          // Só desce quando chega mensagem nova (carregar as antigas não pula para o fim).
          if (lastId && lastId !== scrolledTo.current) {
            scrolledTo.current = lastId;
            listRef.current?.scrollToEnd({ animated: true });
          }
        }}
        ListHeaderComponent={
          canLoadOlder ? (
            <Pressable onPress={() => void loadOlder()} disabled={loadingOlder} accessibilityRole="button" style={styles.older}>
              <Text style={styles.olderText}>{loadingOlder ? t('chat.loading') : t('chat.loadOlder')}</Text>
            </Pressable>
          ) : undefined
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 4 }}
        renderItem={renderItem}
        ListEmptyComponent={
          query.isLoading ? (
            <SkeletonList variant="bubbles" style={{ padding: 0 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
              <Text style={styles.emptyText}>{t('chat.startConversation')}</Text>
            </View>
          )
        }
      />

      {picker.kind !== 'none' && !voice.recording ? (
        <MentionSuggestions kind={picker.kind} query={pickQuery} items={suggestions} loading={usersQ.isFetching || contactsQ.isFetching} onPick={pickMention} />
      ) : null}

      {!canSend ? (
        <View style={[styles.readOnly, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Ionicons name="eye-outline" size={18} color={colors.textSoft} />
          <Text style={styles.readOnlyText}>{t('chat.readOnly')}</Text>
        </View>
      ) : voice.recording ? (
        <View style={[styles.composer, { paddingHorizontal: 0, paddingTop: 0 }]}>
          <RecordingBar elapsedS={voice.elapsedS} levels={voice.levels} onCancel={() => void voice.cancel()} onSend={() => void sendVoice()} bottomInset={Math.max(insets.bottom, 12)} />
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {canMedia ? (
            <Pressable onPress={() => setAttachOpen(true)} style={styles.attachBtn} accessibilityRole="button" accessibilityLabel={t('chat.attach')}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </Pressable>
          ) : null}
          <ChatInput inputRef={inputRef} value={draft} onChangeText={setDraft} placeholder={isGroup ? (channel?.title ? t('chat.messageTo', { name: channel.title }) : t('chat.messageToGroup')) : t('chat.messagePlaceholder')} />
          {draft.trim() || !canMedia ? (
            <Pressable onPress={sendText} disabled={sendMut.isPending} style={[styles.send, sendMut.isPending && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={t('common:actions.send')} accessibilityState={{ disabled: sendMut.isPending }}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <MicButton onPress={() => void startVoice()} />
          )}
        </View>
      )}

      <Toast toast={toast} />

      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)} title={t('chat.sendTitle')}>
        <Button label={t('chat.galleryPhoto')} variant="secondary" onPress={() => void pick('image')} />
        <Button label={t('chat.docOrPdf')} variant="secondary" onPress={() => void pick('document')} />
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  readOnlyText: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13.5, lineHeight: 19, color: colors.textSoft },
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
  mention: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  mentionContact: { color: '#0f766e' },
  mentionMine: { color: '#fff', textDecorationLine: 'underline' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  older: { alignSelf: 'center', paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', marginBottom: 10 },
  olderText: { ...text.captionStrong, color: colors.primary },
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
