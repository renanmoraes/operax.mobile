import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { Badge, Body, Muted, Screen, Title } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { listBookings } from '@/src/shared/api/bookings.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { agendaEvents } from '@/src/mocks/data';

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function hhmm(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AgendaScreen() {
  const { mode } = useAuth();
  const bounds = dayBounds();
  const query = useQuery({
    queryKey: ['bookings', bounds.from, bounds.to],
    enabled: mode === 'live',
    queryFn: () => listBookings({ from: bounds.from, to: bounds.to, limit: 50 }),
  });

  if (mode === 'live' && query.data && query.data.ok === false) {
    return (
      <Screen>
        <View style={styles.header}>
          <Title>Agenda</Title>
          <Muted>Recurso do plano</Muted>
        </View>
        <View style={{ padding: spacing.xl }}>
          <Body style={{ marginBottom: spacing.sm }}>Agenda indisponível neste tenant</Body>
          <Muted>{query.data.message}</Muted>
        </View>
      </Screen>
    );
  }

  const data =
    mode === 'live' && query.data && query.data.ok
      ? query.data.items.map((b) => ({
          id: b.id,
          title: b.service_name || 'Compromisso',
          contactName: b.client_name || b.provider_name || '—',
          startsAt: hhmm(b.starts_at),
          endsAt: hhmm(b.ends_at),
          status: b.status,
          location: b.location_name || undefined,
        }))
      : agendaEvents.map((e) => ({
          id: e.id,
          title: e.title,
          contactName: e.contactName,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          status: e.status as string,
          location: e.location,
        }));

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Agenda</Title>
        <Muted>{mode === 'live' ? 'Hoje · API' : 'Hoje · mock'}</Muted>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: 40 }}>
            {query.isLoading ? 'Carregando…' : 'Nenhum compromisso hoje.'}
          </Muted>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.timeCol}>
              <Body style={styles.time}>{item.startsAt}</Body>
              <Muted>{item.endsAt}</Muted>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={styles.title}>{item.title}</Body>
              <Muted>{item.contactName}</Muted>
              {item.location ? <Muted>{item.location}</Muted> : null}
              <Badge label={String(item.status)} tone="primary" />
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
  },
  timeCol: { width: 56, alignItems: 'flex-start' },
  time: { fontFamily: typography.fontFamilySemiBold, color: colors.primary },
  title: { fontFamily: typography.fontFamilySemiBold },
});
