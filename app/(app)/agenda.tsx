import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { locale } from '@/src/i18n';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, IconButton, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, text, typography } from '@/src/design-system/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { DayEvent, DayTimeline } from '@/src/features/agenda/DayTimeline';
import { toMinutes } from '@/src/features/agenda/timeline';
import { ApiBooking, BookingAction, listAllBookings, runBookingAction, updateBookingPayment } from '@/src/shared/api/bookings.api';
import { BookingDetailSheet } from '@/src/features/agenda/BookingDetailSheet';
import { detailsFromApi, normalizeBookingStatus, STATUS_AFTER } from '@/src/features/agenda/bookingDetails';
import { Toast, useToast } from '@/src/design-system/Toast';
import { useAuth } from '@/src/features/auth/AuthContext';
import { agendaDetails, agendaEvents } from '@/src/mocks/data';
import { longDate } from '@/src/shared/format';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { LoadError, OfflineState } from '@/src/design-system/OfflineState';
import { useOnline } from '@/src/shared/network/network';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { addDaysKey, localDateKey, wallDateKey, wallDateLabel } from '@/src/features/agenda/wallClock';

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
  const can = useCan();
  const canBook = can('bookingCreate');
  const todayKey = localDateKey();
  const [dayKey, setDayKey] = useState(todayKey);
  const isToday = dayKey === todayKey;
  // O servidor recebe o dia (`yyyy-MM-dd`) nos dois limites; o app fica só com o que cai no dia escolhido,
  // lendo o horário como relógio de parede (ver wallClock.ts).
  const online = useOnline();
  const query = useQuery({
    queryKey: ['bookings', dayKey, addDaysKey(dayKey, 1)],
    enabled: mode === 'live',
    queryFn: () => listAllBookings({ from: dayKey, to: addDaysKey(dayKey, 1) }),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<BookingAction | null>(null);
  const { toast, show } = useToast(2200);

  const header = (
    <ScreenHeader
      safe
      title={t('agenda.title')}
      subtitle={isToday ? t('agenda.today', { date: longDate(new Date()).toLowerCase() }) : wallDateLabel(dayKey, locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
      right={
        <View style={styles.controls}>
          <IconButton icon="chevron-back" accessibilityLabel={t('agenda.prevDay')} onPress={() => setDayKey(addDaysKey(dayKey, -1))} />
          {isToday ? null : <IconButton icon="today-outline" accessibilityLabel={t('agenda.backToToday')} onPress={() => setDayKey(todayKey)} />}
          <IconButton icon="chevron-forward" accessibilityLabel={t('agenda.nextDay')} onPress={() => setDayKey(addDaysKey(dayKey, 1))} />
          {canBook ? <IconButton icon="add" accessibilityLabel={t('agenda.addBooking')} onPress={() => router.push('/agendar')} /> : null}
        </View>
      }
    />
  );

  // Mesma forma para o real e o demo: a lista de agendamentos como a API manda.
  const bookings: ApiBooking[] = useMemo(() => {
    const base =
      mode === 'live'
        ? query.data && query.data.ok
          ? query.data.items.filter((b) => wallDateKey(b.starts_at) === dayKey)
          : []
        : (isToday ? agendaEvents : []).map((e) => ({
            id: e.id,
            starts_at: todayAt(e.startsAt),
            ends_at: todayAt(e.endsAt),
            status: e.status,
            service_name: e.title,
            client_name: e.contactName,
            location_name: e.location,
            ...(agendaDetails[e.id] as Partial<ApiBooking>),
          }));
    // `raw_status` guarda a situação como o servidor grava: a agenda normaliza `status` para cores e rótulos, mas as
    // ações (aprovar, dar entrada, cancelar, reagendar) dependem da situação real (ex.: remarcação pendente).
    return base.map((b) => ({ ...b, raw_status: statusOverride[b.id] ?? b.raw_status ?? b.status, status: normalizeBookingStatus(statusOverride[b.id] ?? b.status) }));
  }, [mode, query.data, statusOverride, dayKey, isToday]);

  if (mode === 'live' && !online && !(query.data && query.data.ok)) {
    return (
      <Screen>
        {header}
        <OfflineState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  if (mode === 'live' && query.data && query.data.ok === false) {
    // "Indisponível nesta empresa" é só do plano sem agenda; falha de rede ou do servidor tem texto próprio.
    return (
      <Screen>
        {header}
        {query.data.code === 'plan_locked' ? (
          <EmptyState icon="calendar-outline" title={t('agenda.unavailable')} subtitle={query.data.message} />
        ) : query.data.code === 'offline' ? (
          <OfflineState onRetry={() => void query.refetch()} />
        ) : (
          <LoadError title={query.data.message} onRetry={() => void query.refetch()} />
        )}
      </Screen>
    );
  }

  const now = new Date();
  const events: DayEvent[] = bookings.map(toEvent);
  const upcoming = events.filter((e) => e.endMin > now.getHours() * 60 + now.getMinutes()).length;
  const open = bookings.find((b) => b.id === openId) ?? null;
  const openEvent = events.find((e) => e.id === openId);

  const onAction = async (action: BookingAction, opts?: { payment_type?: 'private' | 'insurance'; plan_type_id?: string; notify_client?: boolean }) => {
    if (!open) return;
    setBusy(action);
    try {
      if (mode === 'live') {
        await runBookingAction(open.id, action, opts);
        await query.refetch();
      }
      // Com o login real, o servidor (já recarregado acima) é quem diz o status: guardar um status local
      // esconderia mudanças feitas depois no web. Só a demonstração, sem servidor, precisa disso.
      if (mode !== 'live') setStatusOverride((prev) => ({ ...prev, [open.id]: STATUS_AFTER[action] }));
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

  const onSavePayment = async (payment: { payment_type: 'private' | 'insurance'; plan_type_id?: string }) => {
    if (!open) return;
    try {
      if (mode === 'live') {
        await updateBookingPayment(open.id, payment);
        await query.refetch();
      }
      show(t('agenda.done.paymentSaved'));
    } catch (e: unknown) {
      const res = (e as { response?: { status?: number; data?: { message?: string | string[] } } })?.response;
      const raw = Array.isArray(res?.data?.message) ? res?.data?.message[0] : res?.data?.message;
      show(typeof raw === 'string' && raw.trim() && (res?.status ?? 500) < 500 ? raw : t('agenda.actionFailed'), 'error');
      throw e;
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
          <EmptyState
            icon="calendar-outline"
            title={isToday ? t('agenda.emptyTitle') : t('agenda.emptyDayTitle')}
            subtitle={t('agenda.emptySub')}
            actionLabel={canBook ? t('agenda.addBooking') : undefined}
            onAction={canBook ? () => router.push('/agendar') : undefined}
          />
        </>
      ) : (
        <DayTimeline
          events={events}
          bottomInset={GLASS_TAB_BAR_SPACE + insets.bottom}
          day={isToday ? 'today' : dayKey < todayKey ? 'past' : 'future'}
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
        dateLabel={open ? wallDateLabel(open.starts_at, locale(), { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
        busy={busy}
        onAction={(a, o) => void onAction(a, o)}
        onSavePayment={onSavePayment}
        onReschedule={() => open && router.push(`/agendar?reschedule=${encodeURIComponent(open.id)}`)}
      />
      <Toast toast={toast} />
    </Screen>
  );
}

/** "14:30" de hoje em ISO (horários do demo). */
function todayAt(hhmm: string): string {
  // Relógio de parede com Z, como a agenda real entrega (ver wallClock.ts).
  return `${localDateKey()}T${hhmm.padStart(5, '0')}:00.000Z`;
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
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusVeil: { position: 'absolute', top: 0, left: 0, right: 0 },
  summary: { ...text.caption, color: colors.textMuted, marginHorizontal: 20, marginTop: -4, fontFamily: typography.fontFamilyMedium },
});
