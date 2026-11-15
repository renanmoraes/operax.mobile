import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Avatar, Button, Muted, Segmented } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useCan } from '@/src/features/auth/useCan';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { transferConversation, transferConversationToQueue } from '@/src/shared/api/conversations.api';
import { listQueues, listTransferTargets, type Queue, type TeamMember, type TransferTarget } from '@/src/shared/api/attendance.api';
import { PRESENCE_COLOR, presenceOf, sortByPresence } from './presence';
import { useTeamPresence } from './TeamPresence';

/**
 * Transferir do celular, com o mesmo poder do web: para um atendente (vendo quem está online e quantas
 * conversas cada um já tem) ou para uma fila. A janela de 24 h fechada só deixa mandar para fila
 * (o atendente novo não poderia responder).
 */

const DEMO_QUEUES: Queue[] = [
  { id: 'demo-q-vendas', name: 'Vendas', is_default: true },
  { id: 'demo-q-suporte', name: 'Suporte' },
  { id: 'demo-q-financeiro', name: 'Financeiro' },
];

type Tab = 'agent' | 'queue';

export function TransferSheet({
  visible,
  onClose,
  conversationId,
  within24h,
  canRelease,
  onRelease,
  onTransferred,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  within24h: boolean;
  canRelease: boolean;
  onRelease: () => void;
  /** Deu certo: `name` é a pessoa ou a fila que recebeu. */
  onTransferred: (name: string, to: Tab) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation(['attendance', 'common']);
  const { mode, user } = useAuth();
  const can = useCan();
  const live = mode === 'live';
  // Transferir para atendente só pede `conversations:transfer`. A presença (online, carga) é um extra de
  // quem pode vê-la; sem ela, a lista vem da busca da equipe ou do cadastro, sem os indicadores.
  const withPresence = can('teamPresence');
  const listSource: 'search' | 'users' | null = withPresence ? null : can('teamChat') ? 'search' : can('usersRead') ? 'users' : null;
  const canAgent = can('transfer') && (withPresence || listSource !== null);
  const canQueue = can('transferQueue') && can('queuesRead');
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? (canAgent && within24h ? 'agent' : 'queue');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Confirmação dentro da folha (um diálogo por cima de outra folha some atrás dela em alguns aparelhos).
  const [confirm, setConfirm] = useState<{ to: Tab; id: string; name: string } | null>(null);

  const { team, loading: presenceLoading } = useTeamPresence(visible && canAgent && withPresence);
  const agents = sortByPresence(team.filter((m) => m.id !== user?.id));
  const plainQ = useQuery({
    queryKey: ['transfer-targets', listSource],
    enabled: visible && live && canAgent && !withPresence && listSource !== null,
    staleTime: 5 * 60_000,
    queryFn: () => listTransferTargets(listSource!),
  });
  const plain = (plainQ.data ?? []).filter((m) => m.id !== user?.id);
  const teamLoading = withPresence ? presenceLoading : live && plainQ.isLoading;
  const agentCount = withPresence ? agents.length : plain.length;
  const queuesQ = useQuery({ queryKey: ['queues'], enabled: visible && live && canQueue, staleTime: 5 * 60_000, queryFn: listQueues });
  const queues = live ? queuesQ.data ?? [] : DEMO_QUEUES;

  const close = () => {
    setConfirm(null);
    onClose();
  };

  const run = async () => {
    if (!confirm) return;
    const { to, id: targetId, name } = confirm;
    setBusyId(targetId);
    try {
      if (live) {
        if (to === 'agent') await transferConversation(conversationId, targetId);
        else await transferConversationToQueue(conversationId, targetId);
      }
      setConfirm(null);
      onTransferred(name, to);
    } catch (e) {
      const res = (e as { response?: { status?: number; data?: { message?: unknown } } })?.response;
      const raw = res?.data?.message;
      const reason = (res?.status ?? 500) < 500 ? (Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '') : '';
      setConfirm(null);
      onError(reason ? t('transfer.failed', { reason }) : t('transfer.failedGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string }[] = [];
  if (canAgent) tabs.push({ key: 'agent', label: t('transfer.toAgent') });
  if (canQueue) tabs.push({ key: 'queue', label: t('transfer.toQueue') });

  return (
    <BottomSheet visible={visible} onClose={close} title={confirm ? undefined : t('transfer.title')}>
      {confirm ? (
        <View style={styles.confirm}>
          <View style={styles.confirmIcon}>
            <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
          </View>
          <Text style={styles.confirmTitle}>{confirm.to === 'agent' ? t('transfer.confirmAgent', { name: confirm.name }) : t('transfer.confirmQueue', { name: confirm.name })}</Text>
          <Muted style={{ textAlign: 'center', lineHeight: 19 }}>
            {confirm.to === 'agent' ? t('transfer.confirmAgentBody', { name: confirm.name }) : t('transfer.confirmQueueBody')}
          </Muted>
          <Button label={t('transfer.go')} icon="swap-horizontal" loading={!!busyId} onPress={() => void run()} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          <Button label={t('common:actions.back')} variant="ghost" disabled={!!busyId} onPress={() => setConfirm(null)} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}

      {confirm ? null : tabs.length > 1 ? <Segmented value={tab} onChange={(k) => setPicked(k as Tab)} options={tabs} /> : null}

      {!confirm && tab === 'agent' && canAgent ? (
        !within24h ? (
          <Notice icon="time-outline" text={t('transfer.windowClosed')} />
        ) : (
          <>
            <Muted style={styles.hint}>{withPresence ? t('transfer.agentsHint') : t('transfer.agentsHintPlain')}</Muted>
            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 6 }}>
              {teamLoading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} /> : null}
              {!teamLoading && agentCount === 0 ? <Muted style={styles.empty}>{t('transfer.noAgents')}</Muted> : null}
              {withPresence
                ? agents.map((m) => <AgentRow key={m.id} m={m} onPress={() => setConfirm({ to: 'agent', id: m.id, name: m.name })} />)
                : plain.map((m) => <PlainAgentRow key={m.id} m={m} onPress={() => setConfirm({ to: 'agent', id: m.id, name: m.name })} />)}
            </ScrollView>
          </>
        )
      ) : null}

      {!confirm && tab === 'queue' && canQueue ? (
        <>
          <Muted style={styles.hint}>{t('transfer.queuesHint')}</Muted>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 6 }}>
            {live && queuesQ.isLoading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} /> : null}
            {!(live && queuesQ.isLoading) && queues.length === 0 ? <Muted style={styles.empty}>{t('transfer.noQueues')}</Muted> : null}
            {queues.map((q) => (
              <Pressable
                key={q.id}
                onPress={() => setConfirm({ to: 'queue', id: q.id, name: q.name })}
                accessibilityRole="button"
                accessibilityLabel={q.name}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.queueIcon}>
                  <Ionicons name="layers-outline" size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{q.name}</Text>
                  {q.sector ? <Text style={styles.meta} numberOfLines={1}>{q.sector}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {canRelease && !confirm ? <Button label={t('transfer.release')} variant="ghost" onPress={onRelease} /> : null}
    </BottomSheet>
  );
}

function AgentRow({ m, onPress }: { m: TeamMember; onPress: () => void }) {
  const { t } = useTranslation('attendance');
  const state = presenceOf(m);
  // Com o Operax fechado a pessoa não vê a conversa chegar: não dá para escolher.
  const off = !m.connected;
  const count = m.active_conversation_count ?? 0;
  return (
    <Pressable
      disabled={off}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={`${m.name}, ${t(`presence.${state}`)}, ${t('transfer.chats', { count })}`}
      style={({ pressed }) => [styles.row, off && { opacity: 0.5 }, pressed && styles.pressed]}
    >
      <View>
        <Avatar initials={initialsOf(m.name)} size={40} tone={off ? 'neutral' : 'soft'} />
        <View style={[styles.dot, { backgroundColor: PRESENCE_COLOR[state] }]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {t(`presence.${state}`)} · {t('transfer.chats', { count })}
        </Text>
      </View>
      {off ? null : <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />}
    </Pressable>
  );
}

/** Atendente sem os dados de presença: dá para escolher qualquer um da equipe. */
function PlainAgentRow({ m, onPress }: { m: TransferTarget; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={m.name} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar initials={initialsOf(m.name)} size={40} tone="soft" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
        {m.email ? <Text style={styles.meta} numberOfLines={1}>{m.email}</Text> : null}
      </View>
      <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
    </Pressable>
  );
}

function Notice({ icon, text }: { icon: 'time-outline'; text: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={18} color={colors.warnText} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, lineHeight: 18 },
  empty: { textAlign: 'center', paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.md, backgroundColor: '#f6f8fc' },
  pressed: { backgroundColor: colors.primaryWash },
  dot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: '#f6f8fc' },
  name: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  meta: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  queueIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  confirm: { alignItems: 'center', gap: 8, paddingTop: 6 },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  confirmTitle: { fontFamily: typography.fontFamilyBold, fontSize: 19, color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radii.md, backgroundColor: colors.warnSoft },
  noticeText: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 18, color: colors.warnText },
});
