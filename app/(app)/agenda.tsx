import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/src/i18n';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, text, typography } from '@/src/design-system/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { DayEvent, DayTimeline } from '@/src/features/agenda/DayTimeline';
import { toMinutes } from '@/src/features/agenda/timeline';
import { ApiBooking, BookingAction, listBookings, runBookingAction } from '@/src/shared/api/bookings.api';
import { BookingDetailSheet } from '@/src/features/agenda/BookingDetailSheet';
import { detailsFromApi, normalizeBookingStatus, STATUS_AFTER } from '@/src/features/agenda/bookingDetails';
import { Toast, useToast } from '@/src/design-system/Toast';
import { useAuth } from '@/src/features/auth/AuthContext';
import { agendaDetails, agendaEvents } from '@/src/mocks/data';
import { longDate, isoDate } from '@/src/shared/format';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { RequirePermission } from '@/src/features/auth/useCan';

/**
 * Mesmo formato do Operax web: o backend recebe o dia (`yyyy-MM-dd`) nos dois limites
 * (mandar data e hora no `to` quebra a consulta). Pede de ontem a amanhã para cobrir o fuso
 * e o app fica só com o que cai hoje no horário local.
 */
function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return {
    from: isoDate(new Date(start.getTime() - 86_400_000)),
    to: isoDate(end),
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

const STATUS_TONE: Record<string, DayEvent['tone']> = {
  confirmed: 'success',
  confirmado: 'success',
  pending: 'warn',
  pendente: 'warn',
  cancelled: 'danger',
  cancelado: 'danger',
  done: 'neutral',
  completed: 'neutral',
  no_show: 'danger',
  rejected: 'danger',
};

const STATUS_LABEL_KEYS = ['confirmed', 'pending', 'cancelled', 'completed', 'done', 'no_show', 'rejected', 'checked_in', 'in_progress', 'waitlisted', 'offered', 'expired'] as const;
type StatusLabelKey = (typeof STATUS_LABEL_KEYS)[number];
const statusLabel = (st: string): string =>
  (STATUS_LABEL_KEYS as readonly string[]).includes(st) ? i18n.t(`agenda:agenda.status.${st as StatusLabelKey}`) : i18n.t('agenda:agenda.statusOther');

export default function AgendaScreenGuarded() {
  const { t } = useTranslation('agenda');
  return (
    <RequirePermission need="agenda" title={t('agenda.title')}>
      <AgendaScreen />
    </RequirePermission>
  );
}

function AgendaScreen() {
  const { t } = useTranslation('agenda');
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const bounds = dayBounds();
  const query = useQuery({
    queryKey: ['bookings', bounds.from, bounds.to],
    enabled: mode === 'live',
    queryFn: () => listBookings({ from: bounds.from, to: bounds.to, limit: 50 }),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<BookingAction | null>(null);
  const { toast, show } = useToast(2200);

  const header = (
    <ScreenHeader safe title={t('agenda.title')} subtitle={t('agenda.today', { date: longDate(new Date()).toLowerCase() })} right={<Badge label={mode === 'live' ? t('agenda.live') : t('agenda.demo')} tone="primary" />} />
  );

  // Mesma forma para o real e o demo: a lista de agendamentos como a API manda.
  const bookings: ApiBooking[] = useMemo(() => {
    const base =
      mode === 'live'
        ? query.data && query.data.ok
          ? query.data.items.filter((b) => {
              const startsMs = new Date(b.starts_at).getTime();
              return startsMs >= bounds.startMs && startsMs < bounds.endMs;
            })
          : []
        : agendaEvents.map((e) => ({
            id: e.id,
            starts_at: todayAt(e.startsAt),
            ends_at: todayAt(e.endsAt),
            status: e.status,
            service_name: e.title,
            client_name: e.contactName,
            location_name: e.location,
            ...(agendaDetails[e.id] as Partial<ApiBooking>),
          }));
    return base.map((b) => ({ ...b, status: normalizeBookingStatus(statusOverride[b.id] ?? b.status) }));
  }, [mode, query.data, statusOverride, bounds.startMs, bounds.endMs]);

  if (mode === 'live' && query.data && query.data.ok === false) {
    return (
      <Screen>
        {header}
        <EmptyState icon="calendar-outline" title={t('agenda.unavailable')} subtitle={query.data.message} />
      </Screen>
    );
  }

  const now = new Date();
  const events: DayEvent[] = bookings.map(toEvent);
  const upcoming = events.filter((e) => e.endMin > now.getHours() * 60 + now.getMinutes()).length;
  const open = bookings.find((b) => b.id === openId) ?? null;
  const openEvent = events.find((e) => e.id === openId);

  const onAction = async (action: BookingAction, opts?: { payment_type?: 'private' }) => {
    if (!open) return;
    setBusy(action);
    try {
      if (mode === 'live') {
        await runBookingAction(open.id, action, opts);
        await query.refetch();
      }
      setStatusOverride((prev) => ({ ...prev, [open.id]: STATUS_AFTER[action] }));
      show(i18n.t(`agenda:agenda.done.${action}`), action === 'cancel' || action === 'reject' || action === 'no_show' ? 'info' : 'success');
      setOpenId(null);
    } catch (e: unknown) {
      // Texto do servidor só quando é um aviso (4xx) escrito; erro de servidor ou rede usa o texto do app.
      const res = (e as { response?: { status?: number; data?: { message?: string | string[] } } })?.response;
      const raw = Array.isArray(res?.data?.message) ? res?.data?.message[0] : res?.data?.message;
      show(typeof raw === 'string' && raw.trim() && (res?.status ?? 500) < 500 ? raw : t('agenda.actionFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      {query.isLoading && mode === 'live' ? (
        <>
          {header}
          <SkeletonList variant="agenda" count={5} />
        </>
      ) : events.length === 0 ? (
        <>
          {header}
          <EmptyState icon="calendar-outline" title={t('agenda.emptyTitle')} subtitle={t('agenda.emptySub')} />
        </>
      ) : (
        <DayTimeline
          events={events}
          bottomInset={GLASS_TAB_BAR_SPACE + insets.bottom}
          onPressEvent={setOpenId}
          header={
            <>
              {header}
              <Text style={styles.summary}>{upcoming ? t('agenda.summary.upcoming', { count: upcoming, total: events.length }) : t('agenda.summary.allPast', { total: events.length })}</Text>
            </>
          }
        />
      )}
      {/* A linha do tempo rola por baixo da barra de status: um véu no topo evita horários em cima do relógio. */}
      <LinearGradient pointerEvents="none" colors={[colors.pageBg, colors.pageBg, 'rgba(244,247,252,0)']} locations={[0, 0.7, 1]} style={[styles.statusVeil, { height: insets.top + 18 }]} />

      <BookingDetailSheet
        visible={!!open}
        onClose={() => setOpenId(null)}
        details={open ? detailsFromApi(open) : null}
        startMin={openEvent?.startMin ?? 0}
        endMin={openEvent?.endMin ?? 0}
        dateLabel={open ? longDate(new Date(open.starts_at)) : ''}
        busy={busy}
        onAction={(a, o) => void onAction(a, o)}
      />
      <Toast toast={toast} />
    </Screen>
  );
}

/** "14:30" de hoje em ISO (horários do demo). */
function todayAt(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function toEvent(b: ApiBooking): DayEvent {
  const st = String(b.status).toLowerCase();
  const startMin = toMinutes(b.starts_at);
  return {
    id: b.id,
    title: b.service_name || i18n.t('agenda:agenda.defaultTitle'),
    person: b.client_name || b.provider_name || '—',
    location: b.location_name || undefined,
    startMin,
    endMin: Math.max(startMin + 15, toMinutes(b.ends_at)),
    statusLabel: statusLabel(st),
    tone: STATUS_TONE[st] ?? 'primary',
  };
}

const styles = StyleSheet.create({
  statusVeil: { position: 'absolute', top: 0, left: 0, right: 0 },
  summary: { ...text.caption, color: colors.textMuted, marginHorizontal: 20, marginTop: -4, fontFamily: typography.fontFamilyMedium },
});
