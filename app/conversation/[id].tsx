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
import { Badge, Body, Button, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing, typography, zIndex } from '@/src/design-system/tokens';
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
        <Muted>{liveQuery.isLoading ? 'Carregando…' : 'Conversa não encontrada.'}</Muted>
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
      <View style={styles.topBar}>
        <Pressable
          style={styles.contactBlock}
          onPress={() => conversation.contactId && router.push(`/contact/${conversation.contactId}`)}
          accessibilityRole="button"
          accessibilityLabel="Ver contato"
        >
          <Body style={styles.contactName}>{conversation.contactName}</Body>
          <Muted>
            {conversation.queue} · {statusLabel}
          </Muted>
        </Pressable>
        <Pressable
          onPress={() => setSheet('actions')}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Ações do atendimento"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!conversation.within24h ? (
        <View style={styles.windowBanner}>
          <Body style={{ color: '#fff', fontSize: 13, flex: 1 }}>
            Fora da janela 24h — use um template aprovado.
          </Body>
          <Pressable onPress={() => router.push({ pathname: '/templates', params: { conversationId: id } })}>
            <Text style={styles.link}>Templates</Text>
          </Pressable>
        </View>
      ) : null}

      {ownership === 'queue' ? (
        <View style={styles.claimBanner}>
          <Muted style={{ flex: 1 }}>Assuma para responder este contato.</Muted>
          <Button label="Assumir" onPress={() => runAction('claim')} style={styles.claimBtn} />
        </View>
      ) : null}

      <FlatList
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const out = item.direction === 'out';
          return (
            <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
              {item.type !== 'text' ? (
                <Badge label={item.type.toUpperCase()} tone={out ? 'neutral' : 'primary'} />
              ) : null}
              <Text style={[styles.bubbleText, out && { color: '#fff' }]}>{item.body}</Text>
              <Text style={[styles.meta, out && { color: '#d7e2ff' }]}>
                {item.at}
                {item.status ? ` · ${item.status}` : ''}
              </Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={() => setSheet('attach')}
          style={styles.attachBtn}
          accessibilityRole="button"
          accessibilityLabel="Anexar mídia"
        >
          <Ionicons name="add" size={24} color={colors.text} />
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
        <View style={styles.toast}>
          <Text style={{ color: '#fff', fontFamily: typography.fontFamilyMedium }}>{toast}</Text>
        </View>
      ) : null}

      <Modal visible={sheet === 'actions'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
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
          <Body style={styles.sheetTitle}>Transferir</Body>
          <Muted>No mobile, libere para a fila ou use o web para escolher atendente.</Muted>
          <Button label="Liberar para a fila" onPress={() => runAction('release')} />
        </View>
      </Modal>

      <Modal visible={sheet === 'attach'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactBlock: { flex: 1, gap: 2 },
  contactName: { fontFamily: typography.fontFamilySemiBold, fontSize: 17 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pageBg,
  },
  windowBanner: {
    backgroundColor: colors.warn,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  claimBanner: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  claimBtn: { minHeight: 40, paddingHorizontal: spacing.md },
  link: { color: '#fff', fontFamily: typography.fontFamilySemiBold, textDecorationLine: 'underline' },
  bubble: { maxWidth: '82%', borderRadius: radii.lg, padding: spacing.md, gap: 4 },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBg,
  },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleText: { fontFamily: typography.fontFamily, fontSize: typography.body, color: colors.text },
  meta: { fontFamily: typography.fontFamily, fontSize: 11, color: colors.textMuted },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pageBg,
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
    minHeight: 40,
    maxHeight: 100,
    borderRadius: radii.control,
    backgroundColor: colors.pageBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontFamily: typography.fontFamily,
    color: colors.text,
    fontSize: typography.body,
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: spacing.lg,
    gap: spacing.sm,
    zIndex: zIndex.sheet,
  },
  sheetTitle: { fontFamily: typography.fontFamilySemiBold, marginBottom: 4, fontSize: 17 },
  toast: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: colors.chromeNavy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: zIndex.toast,
  },
});
