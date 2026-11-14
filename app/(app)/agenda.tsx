import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, text, typography } from '@/src/design-system/tokens';
import { DayEvent, DayTimeline } from '@/src/features/agenda/DayTimeline';
import { toMinutes } from '@/src/features/agenda/timeline';
import { ApiBooking, BookingAction, listBookings, runBookingAction } from '@/src/shared/api/bookings.api';
import { BookingDetailSheet } from '@/src/features/agenda/BookingDetailSheet';
import { detailsFromApi, STATUS_AFTER } from '@/src/features/agenda/bookingDetails';
import { Toast, useToast } from '@/src/design-system/Toast';
import { useAuth } from '@/src/features/auth/AuthContext';
import { agendaDetails, agendaEvents } from '@/src/mocks/data';
import { longDate } from '@/src/shared/format';

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
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

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Aguardando confirmação',
  cancelled: 'Cancelado',
  completed: 'Realizado',
  done: 'Realizado',
  no_show: 'Faltou',
  rejected: 'Recusado',
};

export default function AgendaScreen() {
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
    <ScreenHeader safe title="Agenda" subtitle={`Hoje, ${longDate(new Date()).toLowerCase()}`} right={<Badge label={mode === 'live' ? 'Ao vivo' : 'Demo'} tone="primary" />} />
  );

  // Mesma forma para o real e o demo: a lista de agendamentos como a API manda.
  const bookings: ApiBooking[] = useMemo(() => {
    const base =
      mode === 'live'
        ? query.data && query.data.ok
          ? query.data.items
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
    return base.map((b) => (statusOverride[b.id] ? { ...b, status: statusOverride[b.id] } : b));
  }, [mode, query.data, statusOverride]);

  if (mode === 'live' && query.data && query.data.ok === false) {
    return (
      <Screen>
        {header}
        <EmptyState icon="calendar-outline" title="Agenda indisponível nesta empresa" subtitle={query.data.message} />
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
      show(DONE_MESSAGE[action], action === 'cancel' || action === 'reject' || action === 'no_show' ? 'info' : 'success');
      setOpenId(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      show(Array.isArray(msg) ? msg[0] : msg || 'Não foi possível concluir. Tente de novo.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      {query.isLoading && mode === 'live' ? (
        <>
          {header}
          <Muted style={{ textAlign: 'center', marginTop: 40 }}>Carregando…</Muted>
        </>
      ) : events.length === 0 ? (
        <>
          {header}
          <EmptyState icon="calendar-outline" title="Nenhum compromisso hoje" subtitle="Quando alguém marcar, aparece aqui." />
        </>
      ) : (
        <DayTimeline
          events={events}
          bottomInset={GLASS_TAB_BAR_SPACE + insets.bottom}
          onPressEvent={setOpenId}
          header={
            <>
              {header}
              <Text style={styles.summary}>{upcoming ? `${upcoming} ${upcoming === 1 ? 'compromisso pela frente' : 'compromissos pela frente'} · ${events.length} no dia` : `${events.length} no dia · todos já passaram`}</Text>
            </>
          }
        />
      )}

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

const DONE_MESSAGE: Record<BookingAction, string> = {
  approve: 'Pedido aprovado',
  reject: 'Pedido recusado',
  check_in: 'Entrada registrada',
  no_show: 'Falta registrada',
  cancel: 'Agendamento cancelado',
};

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
    title: b.service_name || 'Compromisso',
    person: b.client_name || b.provider_name || '—',
    location: b.location_name || undefined,
    startMin,
    endMin: Math.max(startMin + 15, toMinutes(b.ends_at)),
    statusLabel: STATUS_LABEL[st] ?? String(b.status),
    tone: STATUS_TONE[st] ?? 'primary',
  };
}

const styles = StyleSheet.create({
  summary: { ...text.caption, color: colors.textMuted, marginHorizontal: 20, marginTop: -4, fontFamily: typography.fontFamilyMedium },
});
