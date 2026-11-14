import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Backdrop, Badge, Body, Button, IconButton, IconTile, Muted } from '@/src/design-system/ui';
import { colors, radii, shadows, typography, zIndex } from '@/src/design-system/tokens';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { getConversation as getMockConv, getMessages as getMockMessages } from '@/src/mocks/data';
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
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);

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
  const thread = mode === 'live' ? liveQuery.data?.messages ?? [] : mockThread;
  const [ownership, setOwnership] = useState(conversation?.ownership ?? 'queue');

  useEffect(() => {
    if (conversation?.ownership) setOwnership(conversation.ownership);
  }, [conversation?.ownership]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

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
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, gap: 8, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const out = item.direction === 'out';
          return (
            <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
              {item.type !== 'text' ? (
                <Badge label={item.type.toUpperCase()} tone={out ? 'neutral' : 'primary'} />
              ) : null}
              <Text style={[styles.bubbleText, out && { color: '#fff' }]}>{item.body}</Text>
              <Text style={[styles.meta, out && { color: 'rgba(255,255,255,0.72)' }]}>
                {item.at}
                {item.status ? ` · ${STATUS_LABEL[item.status] ?? item.status}` : ''}
              </Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={
            !conversation.within24h
              ? 'Use um template'
              : ownership !== 'mine'
                ? 'Assuma para responder'
                : 'Mensagem…'
          }
          editable={canCompose}
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          onPress={() => {
            if (!draft.trim() || !canCompose) return;
            if (mode === 'mock') {
              showToast('Mensagem enviada');
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
      </View>

      {toast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Ionicons
            name={toast.startsWith('Falha') ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color={toast.startsWith('Falha') ? colors.danger : colors.success}
          />
          <Text style={{ color: colors.text, fontFamily: typography.fontFamilySemiBold, fontSize: 14 }}>{toast}</Text>
        </View>
      ) : null}

      <Modal visible={sheet === 'actions'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Body style={styles.sheetTitle}>Posse e atendimento</Body>
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
        </View>
      </Modal>

      <Modal visible={sheet === 'transfer'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Body style={styles.sheetTitle}>Transferir</Body>
          <Muted>No mobile, libere para a fila ou use o web para escolher atendente.</Muted>
          <Button label="Liberar para a fila" onPress={() => runAction('release')} />
        </View>
      </Modal>

      <Modal visible={sheet === 'attach'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Body style={styles.sheetTitle}>Anexar mídia</Body>
          <Button label="Foto / Vídeo" variant="secondary" onPress={() => pickAndSend('image')} />
          <Button label="Documento" variant="secondary" onPress={() => pickAndSend('document')} />
          <Button
            label="Áudio (em breve)"
            variant="ghost"
            onPress={() => {
              setSheet(null);
              showToast('Áudio na próxima versão');
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'na fila',
  sent: 'enviada',
  delivered: 'entregue',
  read: 'lida',
  failed: 'falhou',
};

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
  contactName: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text, letterSpacing: -0.2 },
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
  bubble: { maxWidth: '82%', borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 8,
    ...shadows.card,
  },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 8, ...shadows.button },
  bubbleText: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 21, color: colors.text },
  meta: { fontFamily: typography.fontFamilyMedium, fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.cardBg,
    ...shadows.nav,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: typography.fontFamily,
    color: colors.text,
    fontSize: 15,
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
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
    zIndex: zIndex.sheet,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.track, marginBottom: 8 },
  sheetTitle: { fontFamily: typography.fontFamilyHeavy, marginBottom: 4, fontSize: 19, letterSpacing: -0.3, color: colors.text },
  toast: {
    position: 'absolute',
    bottom: 104,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    zIndex: zIndex.toast,
    ...shadows.hero,
  },
});
