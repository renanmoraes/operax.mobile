import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { locale } from '@/src/i18n';
import { useMemo, useRef, useState } from 'react';
import { FlatList, type FlatListProps, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInputInstance, View, AppState, useWindowDimensions } from 'react-native';
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
import { firstUnreadId } from '@/src/features/chat/unreadJump';
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
import { useConversationRoom, useSocketEvents } from '@/src/shared/realtime/socket';
import * as DocumentPicker from 'expo-document-picker';
import { ActionsSheet, ConversationAction } from '@/src/features/conversation-actions/ActionsSheet';
import { BookingSheet } from '@/src/features/conversation-actions/BookingSheet';
import { PixCard } from '@/src/features/conversation-actions/PixCard';
import { PixSheet } from '@/src/features/conversation-actions/PixSheet';
import { QuickRepliesSheet } from '@/src/features/conversation-actions/QuickRepliesSheet';
import { PixData, sendPixMessage } from '@/src/shared/api/conversation-actions.api';
import * as ImagePicker from 'expo-image-picker';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import type { PermKey } from '@/src/features/auth/permissions';
import { ChannelChip, channelName, isMarketplaceChannel, useInboxConnections } from '@/src/features/attendance/channels';
import { DEMO_HUB_CONTEXT, getHubConversationContext, type HubConversationContext } from '@/src/shared/api/hub.api';
import { TransferSheet } from '@/src/features/attendance/TransferSheet';
import { AiSummaryButton, AiSummarySheet, ReplySuggestions, useAiEnabled } from '@/src/features/attendance/AiAssist';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';

// Marketplace só recebe texto: anexo, Pix e mensagem ativa não saem pelo canal (agendar não envia nada, fica).
const HUB_ACTIONS = new Set(['booking']);

type Sheet = 'actions' | 'attach' | 'transfer' | 'quick' | 'pix' | 'booking' | 'summary' | null;

export default function ConversationScreenGuarded() {
  const { t } = useTranslation(['inbox', 'common']);
  return (
    <RequirePermission need="inbox" title={t('inbox.title')}>
      <ConversationScreen />
    </RequirePermission>
  );
}

type ViewableInfo = Parameters<NonNullable<FlatListProps<Message>['onViewableItemsChanged']>>[0];

function ConversationScreen() {
  const { t } = useTranslation(['inbox', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const can = useCan();
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
  const { t: ta } = useTranslation('attendance');
  const aiOn = useAiEnabled();
  const connections = useInboxConnections();
  const switchSheet = (next: Sheet) => {
    setSheet(null);
    setTimeout(() => setSheet(next), 320);
  };

  const mockConv = getMockConv(id);
  const mockThread = useMemo(() => getMockMessages(id), [id]);

  const liveQuery = useQuery({
    queryKey: ['conversation', id],
    enabled: mode === 'live' && !!id,
    // Reserva se o tempo real cair.
    refetchInterval: 15_000,
    queryFn: async () => {
      const [conv, page] = await Promise.all([
        getConversation(id),
        getConversationMessages(id, 80),
      ]);
      // Só conta como lida com o app na frente (um evento em segundo plano não pode zerar o que ninguém viu).
      if (AppState.currentState === 'active') await markConversationRead(id).catch(() => undefined);
      return {
        conversation: mapApiConversation(conv, user?.id),
        messages: (page.messages ?? []).map((m) => mapApiMessage(m, id)),
        raw: conv,
      };
    },
  });

  // Ao vivo: mensagem nova, status (enviada/entregue/lida), posse ou encerramento desta conversa.
  useConversationRoom(id, mode === 'live');
  const onConversationEvent = (payload: unknown) => {
    const cid = (payload as { conversationId?: string; conversation_id?: string } | undefined)?.conversationId ?? (payload as { conversation_id?: string } | undefined)?.conversation_id;
    if (!cid || cid === id) {
      void liveQuery.refetch();
      void qc.invalidateQueries({ queryKey: ['hub-context', id] });
    }
  };
  useSocketEvents(
    {
      'message.received': onConversationEvent,
      'message.sent': onConversationEvent,
      'message.updated': onConversationEvent,
      'conversation.updated': onConversationEvent,
      'conversation.closed': onConversationEvent,
      'assignment.claimed': onConversationEvent,
      'assignment.released': onConversationEvent,
      // Resumo novo da IA pronto.
      'conversation.summary': onConversationEvent,
    },
    mode === 'live' && !!id,
  );

  // Telas estreitas: avatar menor e menos folga, para o nome e o status do contato terem espaço ao lado dos botões.
  const { width: screenW } = useWindowDimensions();
  const narrow = screenW < 400;

  const conversation = mode === 'live' ? liveQuery.data?.conversation : mockConv;
  const allMessages = mode === 'live' ? liveQuery.data?.messages ?? [] : [...mockThread, ...localMsgs];
  // A linha do tempo do contato junta as conversas dele (outros números e canais). Aqui vale a conversa aberta; as outras
  // aparecem só se pedir, com o selo de onde vieram, para o mesmo aviso de um canal não parecer mensagem repetida.
  const [showOthers, setShowOthers] = useState(false);
  const otherCount = allMessages.filter((m) => m.otherConversation).length;
  const thread = showOthers ? allMessages : allMessages.filter((m) => !m.otherConversation);
  // Não lidas ao abrir: a conversa aberta sozinha não traz a contagem, então vale a da lista (que o app já tem ao tocar na
  // conversa), guardada uma vez por conversa (a releitura de 15 s já viria zerada). As não lidas são as últimas mensagens:
  // chegar ao fim conta como vistas. O botão leva à primeira; depois disso vira a seta para a última mensagem.
  const [opened, setOpened] = useState<{ id: string; unread: number; seen: boolean } | null>(null);
  if (conversation && opened?.id !== id) {
    const fromList = qc
      .getQueriesData<{ live?: { id: string; unread?: number }[] }>({ queryKey: ['inbox'] })
      .flatMap(([, data]) => data?.live ?? [])
      .find((c) => c.id === id)?.unread;
    setOpened({ id, unread: fromList ?? conversation.unread ?? 0, seen: false });
  }
  const unreadAtOpen = opened?.id === id ? opened.unread : 0;
  const firstUnread = useMemo(() => firstUnreadId(thread, unreadAtOpen), [thread, unreadAtOpen]);
  // A lista diz qual é a última mensagem visível (também depois da rolagem automática, que não gera evento de rolagem).
  const [lastVisible, setLastVisible] = useState<number | null>(null);
  const [viewability] = useState(() => ({ itemVisiblePercentThreshold: 30 }));
  const [onViewable] = useState(() => ({ viewableItems }: ViewableInfo) => {
    const idx = viewableItems.reduce((max, v) => Math.max(max, v.index ?? -1), -1);
    if (idx >= 0) setLastVisible(idx);
  });
  const atEnd = lastVisible !== null && lastVisible >= thread.length - 1;
  const markSeen = () => setOpened((o) => (o && !o.seen ? { ...o, seen: true } : o));
  if (atEnd && opened && !opened.seen) setOpened({ ...opened, seen: true });
  const pendingUnread = firstUnread && opened && !opened.seen ? unreadAtOpen : 0;
  const jumpTo = () => {
    const idx = pendingUnread ? thread.findIndex((m) => m.id === firstUnread) : -1;
    if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.15, animated: true });
    else listRef.current?.scrollToEnd({ animated: true });
    markSeen();
  };

  // No modo demo as ações mudam a posse só aqui; no real, a posse vem sempre do servidor.
  const [ownershipOverride, setOwnership] = useState<NonNullable<typeof conversation>['ownership'] | null>(null);
  const ownership = ownershipOverride ?? conversation?.ownership ?? 'queue';

  const showToast = (msg: string, tone: 'success' | 'error' = 'success') => show(msg, tone);

  const sendMut = useMutation({
    mutationFn: async (text: string) => sendTextMessage(id, text),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      showToast(t('conversation.sent'));
    },
    onError: () => showToast(t('conversation.sendFailed'), 'error'),
  });

  // Marketplace (Hub Comercial): por qual loja a resposta sai, os pedidos da conversa e se o canal ainda deixa responder.
  const isHub = isMarketplaceChannel(conversation?.channel);
  const hubQuery = useQuery({
    queryKey: ['hub-context', id],
    enabled: mode === 'live' && isHub && !!id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => getHubConversationContext(id),
  });
  const hubContext: HubConversationContext | null = !isHub ? null : mode === 'live' ? hubQuery.data ?? null : DEMO_HUB_CONTEXT;
  const hubClosed = !!hubContext?.closed_remotely;

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
        <Muted>{t('conversation.notFound')}</Muted>
        <Button label={t('common:actions.back')} variant="soft" compact onPress={() => router.back()} style={{ marginTop: 14 }} />
      </View>
    );
  }

  const connId = connections.idOf(conversation);
  const connection = connId ? connections.byId.get(connId) ?? null : null;
  const lastInboundId = [...thread].reverse().find((m) => m.direction === 'in')?.id ?? null;

  const statusLabel =
    ownership === 'mine'
      ? t('conversation.status.mine')
      : ownership === 'queue'
        ? t('conversation.status.queue')
        : ownership === 'other'
          ? t('conversation.status.other')
          : t('conversation.status.closed');

  const runAction = async (action: 'claim' | 'release' | 'close') => {
    if (mode === 'mock') {
      if (action === 'claim') setOwnership('mine');
      if (action === 'release') setOwnership('queue');
      if (action === 'close') setOwnership('closed');
      showToast(action === 'claim' ? t('conversation.claimed') : t('conversation.updated'));
      setSheet(null);
      return;
    }
    try {
      if (action === 'claim') await claimConversation(id);
      if (action === 'release') await releaseConversation(id);
      if (action === 'close') await closeConversation(id);
      await liveQuery.refetch();
      showToast(t('conversation.updated'));
    } catch {
      showToast(t('conversation.actionFailed'), 'error');
    }
    setSheet(null);
  };

  const pickAndSend = async (kind: 'image' | 'document' | 'camera') => {
    setSheet(null);
    if (mode === 'mock') {
      showToast(kind === 'document' ? t('conversation.demoDocument') : t('conversation.demoMedia'));
      return;
    }
    try {
      if (kind === 'image' || kind === 'camera') {
        if (kind === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            show(t('conversation.allowCamera'), 'error', 'camera-outline');
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
      showToast(t('conversation.mediaSent'));
    } catch {
      showToast(t('conversation.mediaFailed'), 'error');
    }
  };

  // Perfil sem permissão de enviar: conversa só para leitura (o campo de mensagem nem aparece).
  const canSend = can('sendMessage');
  const hubName = isHub ? channelName(conversation.channel) : '';
  const canCompose = canSend && conversation.within24h && ownership === 'mine' && !hubClosed;
  const composeBlock = hubClosed
    ? t('conversation.hub.closed', { channel: hubName })
    : !conversation.within24h
      ? t('conversation.blocked24h')
      : ownership !== 'mine'
        ? t('conversation.blockedClaim')
        : undefined;
  // Transferir abre a folha com atendente e/ou fila: basta poder uma das duas (fila: mandar para fila + ver filas).
  const canTransfer = can('transfer') || (can('transferQueue') && can('queuesRead'));
  const ownershipActions = { claim: can('claim'), release: can('release'), transfer: canTransfer, close: can('close') };
  const hasOwnershipAction = Object.values(ownershipActions).some(Boolean) || (!!conversation.contactId && can('contacts'));

  const sendPix = async (pix: PixData & { save?: boolean }) => {
    if (mode === 'mock') {
      appendLocal({ type: 'pix', body: t('mapper.pixKey'), pix });
      setSheet(null);
      showToast(t('conversation.pixSent'));
      return;
    }
    try {
      await sendPixMessage(id, pix);
      setSheet(null);
      await liveQuery.refetch();
      showToast(t('conversation.pixSent'));
    } catch {
      showToast(t('conversation.pixFailed'), 'error');
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

  const allActions: (ConversationAction & { perm: PermKey })[] = [
    { key: 'media', label: t('conversation.action.media'), icon: 'images', tone: 'media', perm: 'sendMedia', blockedReason: composeBlock, onPress: guarded(() => void pickAndSend('image')) },
    { key: 'camera', label: t('conversation.action.camera'), icon: 'camera', tone: 'camera', perm: 'sendMedia', blockedReason: composeBlock, onPress: guarded(() => void pickAndSend('camera')) },
    { key: 'document', label: t('conversation.action.document'), icon: 'document', tone: 'document', perm: 'sendMedia', blockedReason: composeBlock, onPress: guarded(() => void pickAndSend('document')) },
    { key: 'pix', label: t('conversation.action.pix'), icon: 'diamond', tone: 'pix', perm: 'sendMessage', blockedReason: composeBlock, onPress: guarded(() => switchSheet('pix')) },
    { key: 'booking', label: t('conversation.action.booking'), icon: 'calendar', tone: 'booking', perm: 'bookingCreate', onPress: () => switchSheet('booking') },
    {
      key: 'template',
      label: t('conversation.action.template'),
      icon: 'document-text',
      tone: 'template',
      perm: 'templates',
      onPress: () => {
        setSheet(null);
        router.push({ pathname: '/templates', params: { conversationId: id } });
      },
    },
  ];
  const actions: ConversationAction[] = allActions.filter((a) => can(a.perm) && (!isHub || HUB_ACTIONS.has(a.key)));
  const hubKindLabel: Record<HubConversationContext['thread_kind'], string> = {
    buyer_chat: t('conversation.hub.kind.buyer_chat'),
    post_sale: t('conversation.hub.kind.post_sale'),
    product_question: t('conversation.hub.kind.product_question'),
    support_ticket: t('conversation.hub.kind.support_ticket'),
  };
  const hubOrders = hubContext?.orders ?? null;
  const hubOrderText =
    hubOrders === null
      ? null
      : hubOrders.length === 0
        ? t('conversation.hub.noOrder')
        : hubOrders.length === 1
          ? t('conversation.hub.order', { number: hubOrders[0].external_order_number ?? hubOrders[0].external_order_id })
          : t('conversation.hub.orders', { count: hubOrders.length });
  const hubDetail = hubContext ? [hubKindLabel[hubContext.thread_kind], hubOrderText].filter(Boolean).join(' · ') : null;

  const appendLocal = (m: Omit<Message, 'id' | 'conversationId' | 'direction' | 'at' | 'status'>) =>
    setLocalMsgs((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversationId: id,
        direction: 'out',
        at: new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        ...m,
      },
    ]);

  const startVoice = async () => {
    if (!canCompose) return;
    const result = await voice.start();
    if (result !== 'granted') show(t('conversation.allowMic'), 'error', 'mic-off-outline');
  };

  const sendVoice = async () => {
    const audio = await voice.stop();
    if (!audio) return;
    if (mode === 'mock') {
      appendLocal({ type: 'audio', body: t('conversation.audio'), audioUri: audio.uri, durationS: audio.durationS });
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
      showToast(t('conversation.audioFailed'), 'error');
    }
  };

  // Uma mensagem. As de outro número ou canal do contato (quando mostradas) levam o selo de onde vieram.
  const renderBody = ({ item }: { item: Message }) => {
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
  };
  const renderMessage = ({ item }: { item: Message }) => {
    const body = renderBody({ item });
    // Linha que marca onde começam as não lidas, para quem chega por aqui saber de onde ler.
    const el = item.id === firstUnread ? (
      <View style={{ gap: 8 }}>
        <View style={styles.unreadDivider} accessibilityRole="header">
          <View style={styles.unreadLine} />
          <Text style={styles.unreadDividerText}>{t('conversation.unreadDivider', { count: unreadAtOpen })}</Text>
          <View style={styles.unreadLine} />
        </View>
        {body}
      </View>
    ) : body;
    if (!item.otherConversation) return el;
    const conn = item.otherConversation.connectionId ? connections.byId.get(item.otherConversation.connectionId) ?? null : null;
    return (
      <View style={{ gap: 4, alignItems: item.direction === 'out' ? 'flex-end' : 'flex-start' }}>
        <ChannelChip connection={conn} channel={item.otherConversation.channel} size="xs" />
        {el}
      </View>
    );
  };

  return (
    // O campo de mensagem sobe junto com o teclado do iPhone (sem esconder o texto e o enviar).
    <KeyboardAvoidingView style={styles.root} behavior={KEYBOARD_BEHAVIOR}>
      <Backdrop variant="chat" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }, narrow && { paddingHorizontal: 8, gap: 4 }]}>
        <IconButton icon="chevron-back" accessibilityLabel={t('common:actions.back')} onPress={() => router.back()} />
        <Pressable
          style={[styles.contactBlock, narrow && { gap: 8 }]}
          onPress={() => conversation.contactId && router.push(`/contact/${conversation.contactId}`)}
          accessibilityRole="button"
          accessibilityLabel={t('conversation.viewContact')}
        >
          <Avatar initials={initialsOf(conversation.contactName)} size={narrow ? 36 : 42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.contactName} numberOfLines={1}>{conversation.contactName}</Text>
            {/* Em tela estreita o canal, o ponto e o status quebram para a linha de baixo em vez de se atropelar. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 3, marginTop: 2 }}>
              {/* Vários números: por qual deles o cliente está falando (a resposta sai por ele). */}
              {isHub ? (
                <ChannelChip channel={conversation.channel} size="xs" />
              ) : connections.multi && connection ? (
                <ChannelChip connection={connection} size="xs" />
              ) : null}
              <View style={[styles.statusDot, ownership === 'mine' ? { backgroundColor: colors.success } : ownership === 'queue' ? { backgroundColor: colors.warn } : null]} />
              <Muted numberOfLines={1} style={{ fontSize: 12.5, flexShrink: 1 }}>
                {conversation.queue} · {statusLabel}
              </Muted>
            </View>
          </View>
        </Pressable>
        {aiOn ? <AiSummaryButton onPress={() => setSheet('summary')} /> : null}
        {hasOwnershipAction ? <IconButton icon="ellipsis-horizontal" accessibilityLabel={t('conversation.moreActions')} onPress={() => setSheet('actions')} /> : null}
      </View>

      {!conversation.within24h ? (
        <View style={styles.windowBanner}>
          <Ionicons name="time-outline" size={18} color={colors.warnText} />
          <Text style={styles.windowText}>{t('conversation.windowBanner')}</Text>
          {can('templates') ? (
          <Pressable
            onPress={() => router.push({ pathname: '/templates', params: { conversationId: id } })}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.link}>{t('conversation.templatesLink')}</Text>
          </Pressable>
          ) : null}
        </View>
      ) : null}

      {isHub && hubContext ? (
        <View style={[styles.hubStrip, hubClosed && styles.hubStripClosed]} accessibilityRole="summary">
          <View style={[styles.hubIcon, hubClosed && { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name={hubClosed ? 'lock-closed-outline' : 'storefront-outline'} size={17} color={hubClosed ? colors.dangerText : colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.hubTitle, hubClosed && { color: colors.dangerText }]} numberOfLines={hubClosed ? 3 : 1}>
              {hubClosed
                ? t('conversation.hub.closed', { channel: hubName })
                : hubContext.account_name
                  ? t('conversation.hub.replyingVia', { channel: hubName, account: hubContext.account_name })
                  : t('conversation.hub.replyingViaChannel', { channel: hubName })}
            </Text>
            {hubDetail ? (
              <Text style={styles.hubDetail} numberOfLines={1}>
                {hubDetail}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {ownership === 'queue' && ownershipActions.claim && canSend ? (
        <View style={styles.claimBanner}>
          <IconTile icon="hand-left-outline" size={38} />
          <Text style={styles.claimText}>{t('conversation.claimBanner')}</Text>
          <Button label={t('conversation.claim')} compact onPress={() => runAction('claim')} />
        </View>
      ) : null}

      <View style={styles.listWrap}>
      <FlatList
        ref={listRef}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        onScrollToIndexFailed={(info) => {
          // Item ainda não medido: chega perto pela altura média e tenta de novo.
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.15, animated: true }), 120);
        }}
        data={thread}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          otherCount > 0 ? (
            <Pressable onPress={() => setShowOthers((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showOthers }} style={styles.othersToggle}>
              <Ionicons name={showOthers ? 'eye-off-outline' : 'git-network-outline'} size={15} color={colors.textSoft} />
              <Text style={styles.othersText}>{showOthers ? t('conversation.hideOthers') : t('conversation.showOthers', { count: otherCount })}</Text>
            </Pressable>
          ) : undefined
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, gap: 8, paddingBottom: 16 }}
        renderItem={renderMessage}
      />
      {lastVisible !== null && !atEnd ? (
        <Pressable
          onPress={jumpTo}
          style={[styles.jump, pendingUnread > 0 && styles.jumpUnread]}
          accessibilityRole="button"
          accessibilityLabel={pendingUnread > 0 ? t('conversation.unreadJump', { count: pendingUnread }) : t('conversation.jumpLatest')}
          hitSlop={8}
        >
          {pendingUnread > 0 ? <Text style={styles.jumpText}>{t('conversation.unreadJump', { count: pendingUnread })}</Text> : null}
          <Ionicons name="chevron-down" size={18} color={pendingUnread > 0 ? '#fff' : colors.primary} />
        </Pressable>
      ) : null}
      </View>

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

      {aiOn && canCompose && qrTerm === null && !voice.recording ? (
        <ReplySuggestions
          conversationId={id}
          lastInboundId={lastInboundId}
          draft={draft}
          onUse={(text) => {
            setDraft(text);
            focusAtEnd(inputRef.current, text);
          }}
        />
      ) : null}

      {!canSend ? (
        <View style={[styles.readOnly, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Ionicons name="eye-outline" size={18} color={colors.textSoft} />
          <Text style={styles.readOnlyText}>{t('conversation.readOnly')}</Text>
        </View>
      ) : voice.recording ? (
        <View style={[styles.composer, { paddingHorizontal: 0, paddingTop: 0 }]}>
          <RecordingBar elapsedS={voice.elapsedS} levels={voice.levels} onCancel={() => void voice.cancel()} onSend={() => void sendVoice()} bottomInset={Math.max(insets.bottom, 12)} />
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {actions.length ? (
          <Pressable
            onPress={() => setSheet('attach')}
            style={styles.attachBtn}
            accessibilityRole="button"
            accessibilityLabel={isHub ? t('conversation.hub.attachA11y') : t('conversation.attachA11y')}
          >
            <Ionicons name="add" size={24} color={colors.primary} />
          </Pressable>
          ) : null}
          {can('quickReplies') ? (
          <Pressable
            onPress={() => setSheet('quick')}
            style={styles.qrBtn}
            accessibilityRole="button"
            accessibilityLabel={t('conversation.quickA11y')}
          >
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
          </Pressable>
          ) : null}
          <ChatInput
            inputRef={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              hubClosed
                ? t('conversation.hub.placeholderClosed')
                : !conversation.within24h
                  ? t('conversation.placeholderTemplate')
                  : ownership !== 'mine'
                    ? t('conversation.placeholderClaim')
                    : t('conversation.placeholderMessage')
            }
            editable={canCompose}
          />
          {draft.trim() || !canCompose || !can('sendMedia') || isHub ? (
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
              accessibilityLabel={t('common:actions.send')}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          ) : (
            <MicButton onPress={() => void startVoice()} />
          )}
        </View>
      )}

      <Toast toast={toast} />

      <BottomSheet visible={sheet === 'actions'} onClose={() => setSheet(null)} title={t('conversation.ownershipTitle')}>
        {ownershipActions.claim ? <Button label={t('conversation.claim')} onPress={() => runAction('claim')} /> : null}
        {ownershipActions.release ? <Button label={t('conversation.release')} variant="secondary" onPress={() => runAction('release')} /> : null}
        {ownershipActions.transfer ? <Button label={t('conversation.transfer')} variant="secondary" onPress={() => setSheet('transfer')} /> : null}
        {ownershipActions.close ? <Button label={t('conversation.close')} variant="danger" onPress={() => runAction('close')} /> : null}
        {conversation.contactId && can('contacts') ? (
          <Button
            label={t('conversation.viewContact')}
            variant="ghost"
            onPress={() => {
              setSheet(null);
              router.push(`/contact/${conversation.contactId}`);
            }}
          />
        ) : null}
      </BottomSheet>

      <TransferSheet
        visible={sheet === 'transfer'}
        onClose={() => setSheet(null)}
        conversationId={id}
        within24h={conversation.within24h}
        canRelease={ownershipActions.release && ownership === 'mine'}
        onRelease={() => void runAction('release')}
        onTransferred={(name, to) => {
          setSheet(null);
          if (mode === 'mock') setOwnership(to === 'agent' ? 'other' : 'queue');
          else void liveQuery.refetch();
          show(ta('transfer.done', { name }), 'success', 'swap-horizontal');
        }}
        onError={(msg) => show(msg, 'error')}
      />

      <AiSummarySheet visible={sheet === 'summary'} onClose={() => setSheet(null)} conversationId={id} raw={liveQuery.data?.raw} onChanged={() => void liveQuery.refetch()} />

      <ActionsSheet
        visible={sheet === 'attach'}
        onClose={() => setSheet(null)}
        actions={actions}
        footnote={composeBlock ?? (isHub ? t('conversation.hub.textOnly', { channel: hubName }) : undefined)}
      />

      <QuickRepliesSheet
        visible={sheet === 'quick'}
        onClose={() => setSheet(null)}
        live={mode === 'live'}
        demoItems={mockQuickReplies}
        within24h={conversation.within24h}
        showTemplates={!isHub && can('templates')}
        onPick={(q) => {
          setSheet(null);
          const body = resolveQuickReplyVariables(q.body, { name: conversation.contactName }, user?.name ?? '');
          if (!canCompose) {
            show(composeBlock ?? t('conversation.cannotReply'), 'info');
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
          show(t('conversation.booked', { summary }), 'success', 'calendar-outline');
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
  othersToggle: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#eef1f6', marginBottom: 6 },
  othersText: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: colors.textSoft },
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
  listWrap: { flex: 1 },
  jump: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cardBg,
    ...shadows.card,
  },
  jumpUnread: { backgroundColor: colors.primary, paddingHorizontal: 14 },
  jumpText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: '#fff' },
  unreadDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  unreadLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.primary, opacity: 0.35 },
  unreadDividerText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.primary },
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
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  readOnlyText: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13.5, lineHeight: 19, color: colors.textSoft },
  hubStrip: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.card,
  },
  hubStripClosed: { backgroundColor: colors.dangerSoft, shadowOpacity: 0, elevation: 0 },
  hubIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  hubTitle: { fontFamily: typography.fontFamilyBold, fontSize: 13.5, lineHeight: 18, color: colors.text },
  hubDetail: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, lineHeight: 17, color: colors.textSoft, marginTop: 1 },
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
