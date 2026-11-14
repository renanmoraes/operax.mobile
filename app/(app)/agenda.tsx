import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, text, typography } from '@/src/design-system/tokens';
import { DayEvent, DayTimeline } from '@/src/features/agenda/DayTimeline';
import { toMinutes } from '@/src/features/agenda/timeline';
import { listBookings } from '@/src/shared/api/bookings.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { agendaEvents } from '@/src/mocks/data';
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
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Aguardando confirmação',
  cancelled: 'Cancelado',
  completed: 'Realizado',
  done: 'Realizado',
  no_show: 'Faltou',
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

  const header = (
    <ScreenHeader safe title="Agenda" subtitle={`Hoje, ${longDate(new Date()).toLowerCase()}`} right={<Badge label={mode === 'live' ? 'Ao vivo' : 'Demo'} tone="primary" />} />
  );

  if (mode === 'live' && query.data && query.data.ok === false) {
    return (
      <Screen>
        {header}
        <EmptyState icon="calendar-outline" title="Agenda indisponível nesta empresa" subtitle={query.data.message} />
      </Screen>
    );
  }

  const now = new Date();
  const events: DayEvent[] =
    mode === 'live' && query.data && query.data.ok
      ? query.data.items.map((b) => toEvent(b.id, b.service_name || 'Compromisso', b.client_name || b.provider_name || '—', b.starts_at, b.ends_at, b.status, b.location_name || undefined))
      : agendaEvents.map((e) => toEvent(e.id, e.title, e.contactName, e.startsAt, e.endsAt, e.status, e.location));
  const upcoming = events.filter((e) => e.endMin > now.getHours() * 60 + now.getMinutes()).length;

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
          header={
            <>
              {header}
              <Text style={styles.summary}>{upcoming ? `${upcoming} ${upcoming === 1 ? 'compromisso pela frente' : 'compromissos pela frente'} · ${events.length} no dia` : `${events.length} no dia · todos já passaram`}</Text>
            </>
          }
        />
      )}
    </Screen>
  );
}

function toEvent(id: string, title: string, person: string, start: string, end: string, status: string, location?: string): DayEvent {
  const st = String(status).toLowerCase();
  const startMin = toMinutes(start);
  return {
    id,
    title,
    person,
    location,
    startMin,
    endMin: Math.max(startMin + 15, toMinutes(end)),
    statusLabel: STATUS_LABEL[st] ?? String(status),
    tone: STATUS_TONE[st] ?? 'primary',
  };
}

const styles = StyleSheet.create({
  summary: { ...text.caption, color: colors.textMuted, marginHorizontal: 20, marginTop: -4, fontFamily: typography.fontFamilyMedium },
});
