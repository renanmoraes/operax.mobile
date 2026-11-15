import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { Avatar, Muted, PressableScale, Segmented } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useCan } from '@/src/features/auth/useCan';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { timeAgo } from '@/src/shared/format';
import { getMyAvailability, getTeamPresence, setMyAvailability, type Availability, type TeamMember } from '@/src/shared/api/attendance.api';
import { PRESENCE_COLOR, presenceOf, sortByPresence } from './presence';

export { PRESENCE_COLOR, presenceOf, sortByPresence };

/**
 * Quem da equipe está atendendo agora: o mesmo painel do Operax web, no bolso do supervisor.
 * "Atendendo" exige as duas coisas: marcado como disponível E com o Operax aberto (web ou app).
 * Marcado como disponível com tudo fechado vira um aviso: a fila pode estar mandando conversa para ninguém.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Equipe de exemplo do modo demonstração. */
export const DEMO_TEAM: TeamMember[] = [
  { id: 'demo-u2', name: 'Carla Souza', role_name: 'Atendente', availability_status: 'online', availability_updated_at: minutesAgo(42), active_conversation_count: 3, connected: true },
  { id: 'demo-u3', name: 'Diego Lima', role_name: 'Atendente', availability_status: 'busy', availability_updated_at: minutesAgo(12), active_conversation_count: 5, connected: true },
  { id: 'demo-u4', name: 'Patrícia Rocha', role_name: 'Supervisora', availability_status: 'online', availability_updated_at: minutesAgo(180), active_conversation_count: 1, connected: false },
  { id: 'demo-u5', name: 'Bruno Alves', role_name: 'Atendente', availability_status: 'offline', availability_updated_at: minutesAgo(600), active_conversation_count: 0, connected: false },
];

/** Equipe com presença, atualizada a cada minuto (e na hora em que a folha abre). */
export function useTeamPresence(enabled = true) {
  const { mode } = useAuth();
  const can = useCan();
  const allowed = can('teamPresence');
  const q = useQuery({
    queryKey: ['team-presence'],
    enabled: enabled && allowed && mode === 'live',
    refetchInterval: 60_000,
    staleTime: 20_000,
    queryFn: getTeamPresence,
  });
  const team = mode === 'live' ? q.data ?? [] : allowed ? DEMO_TEAM : [];
  return { team, allowed, loading: mode === 'live' && q.isLoading, refetch: q.refetch };
}

/** Pílula do topo do atendimento: "3 online"; abre o painel. */
export function PresenceButton() {
  const { t } = useTranslation('attendance');
  const { user } = useAuth();
  const { team, allowed } = useTeamPresence();
  const [open, setOpen] = useState(false);
  if (!allowed) return null;
  const online = team.filter((m) => m.id !== user?.id && presenceOf(m) === 'online').length;
  return (
    <>
      <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('presence.openA11y', { count: online })} hitSlop={6} style={styles.pill}>
        <View style={styles.faces}>
          {sortByPresence(team.filter((m) => m.id !== user?.id))
            .slice(0, 3)
            .map((m, i) => (
              <View key={m.id} style={[styles.face, { marginLeft: i ? -8 : 0, zIndex: 3 - i }]}>
                <Text style={styles.faceText}>{initialsOf(m.name)}</Text>
                <View style={[styles.faceDot, { backgroundColor: PRESENCE_COLOR[presenceOf(m)] }]} />
              </View>
            ))}
        </View>
        <Text style={styles.pillText}>{t('presence.onlineCount', { count: online })}</Text>
      </PressableScale>
      <TeamPresenceSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function TeamPresenceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation('attendance');
  const { user } = useAuth();
  const { team } = useTeamPresence(visible);
  const others = sortByPresence(team.filter((m) => m.id !== user?.id));
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('presence.title')}>
      <MyAvailability />
      <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 4 }}>
        {others.length === 0 ? <Muted style={{ textAlign: 'center', paddingVertical: 16 }}>{t('presence.empty')}</Muted> : null}
        {others.map((m) => (
          <MemberRow key={m.id} m={m} />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

function MemberRow({ m }: { m: TeamMember }) {
  const { t } = useTranslation('attendance');
  const state = presenceOf(m);
  const label = t(`presence.${state}`);
  const since = m.availability_updated_at ? timeAgo(m.availability_updated_at) : null;
  const count = m.active_conversation_count ?? 0;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${m.name}, ${label}${count ? `, ${t('transfer.chats', { count })}` : ''}`}>
      <View>
        <Avatar initials={initialsOf(m.name)} size={40} tone={state === 'online' ? 'soft' : 'neutral'} />
        <View style={[styles.rowDot, { backgroundColor: PRESENCE_COLOR[state] }]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowName, state === 'closed' && { color: colors.textMuted }]} numberOfLines={1}>
          {m.name}
        </Text>
        <Text style={[styles.rowMeta, state === 'stale' && { color: '#b45309' }]} numberOfLines={2}>
          {label}
          {since && state !== 'stale' ? ` · ${since}` : ''}
          {m.role_name ? ` · ${m.role_name}` : ''}
        </Text>
      </View>
      {count > 0 ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Disponível / Ocupado / Indisponível: o mesmo botão do topo do web. */
export function MyAvailability() {
  const { t } = useTranslation('attendance');
  const { mode } = useAuth();
  const qc = useQueryClient();
  const live = mode === 'live';
  const [demo, setDemo] = useState<Availability>('online');
  const q = useQuery({ queryKey: ['my-availability'], enabled: live, staleTime: 30_000, queryFn: getMyAvailability });
  const current: Availability = live ? q.data?.status ?? 'online' : demo;

  const m = useMutation({
    mutationFn: async (status: Availability) => (live ? setMyAvailability(status) : { status }),
    onSuccess: (r) => {
      if (live) {
        qc.setQueryData(['my-availability'], (old: object | undefined) => ({ ...(old ?? {}), status: r.status }));
        void qc.invalidateQueries({ queryKey: ['team-presence'] });
      } else setDemo(r.status);
    },
    onError: () => void showDialog({ title: t('presence.mine'), message: t('presence.changeFailed'), tone: 'warn' }),
  });

  const choose = async (key: string) => {
    const status = key as Availability;
    if (status === current || m.isPending) return;
    if (status === 'offline') {
      const n = q.data?.active_conversation_count ?? 0;
      const ok = await confirmDialog({
        title: t('presence.offlineTitle'),
        message: n > 0 ? t('presence.offlineBody', { count: n }) : t('presence.offlineBodyNone'),
        confirmLabel: t('presence.offlineGo'),
        tone: 'warn',
        icon: 'moon-outline',
      });
      if (!ok) return;
    }
    m.mutate(status);
  };

  return (
    <View style={styles.mine}>
      <View style={styles.mineHead}>
        <View style={[styles.mineDot, { backgroundColor: current === 'online' ? colors.success : current === 'busy' ? '#d97706' : '#94a3b8' }]} />
        <Text style={styles.mineTitle}>{t('presence.mine')}</Text>
      </View>
      <Segmented
        value={current}
        onChange={(k) => void choose(k)}
        options={[
          { key: 'online', label: t('presence.setOnline') },
          { key: 'busy', label: t('presence.setBusy') },
          { key: 'offline', label: t('presence.setOffline') },
        ]}
      />
      <Muted style={{ fontSize: 12, lineHeight: 17 }}>{t('presence.mineHint')}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingLeft: 4, paddingRight: 11, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  faces: { flexDirection: 'row' },
  face: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  faceText: { fontFamily: typography.fontFamilyBold, fontSize: 9, color: colors.primary },
  faceDot: { position: 'absolute', right: -2, bottom: -2, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  pillText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: colors.text },
  mine: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: '#f6f8fc', marginBottom: 6 },
  mineHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mineDot: { width: 9, height: 9, borderRadius: 5 },
  mineTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rowDot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: '#fff' },
  rowName: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  rowMeta: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  count: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: typography.fontFamilyBold, fontSize: 12, color: colors.primary },
});
