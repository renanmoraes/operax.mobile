import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, EmptyState, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, radii, typography } from '@/src/design-system/tokens';
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

function hhmm(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger' | 'primary' | 'neutral'> = {
  confirmed: 'success',
  confirmado: 'success',
  pending: 'warn',
  pendente: 'warn',
  cancelled: 'danger',
  cancelado: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Aguardando confirmação',
  cancelled: 'Cancelado',
  completed: 'Realizado',
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
    <View style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Agenda" subtitle={`Hoje, ${longDate(new Date()).toLowerCase()}`} right={<Badge label={mode === 'live' ? 'Ao vivo' : 'Demo'} tone="primary" />} />
    </View>
  );

  if (mode === 'live' && query.data && query.data.ok === false) {
    return (
      <Screen>
        {header}
        <EmptyState icon="calendar-outline" title="Agenda indisponível nesta empresa" subtitle={query.data.message} />
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
      {header}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom, gap: 10 }}
        ListEmptyComponent={
          query.isLoading ? <Muted style={{ textAlign: 'center', marginTop: 40 }}>Carregando…</Muted> : <EmptyState icon="calendar-outline" title="Nenhum compromisso hoje" subtitle="Quando alguém marcar, aparece aqui." />
        }
        renderItem={({ item }) => {
          const status = String(item.status).toLowerCase();
          const tone = STATUS_TONE[status] ?? 'primary';
          return (
            <View style={styles.row}>
              <View style={styles.timeCol}>
                <Text style={styles.time}>{item.startsAt}</Text>
                <Muted style={{ fontSize: 11.5 }}>{item.endsAt}</Muted>
              </View>
              <Card style={[styles.card, tone === 'warn' && styles.cardWarn]}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Muted style={{ marginTop: 3 }} numberOfLines={1}>{item.contactName}</Muted>
                {item.location ? <Muted style={{ marginTop: 2, fontSize: 12 }} numberOfLines={1}>{item.location}</Muted> : null}
                <View style={{ marginTop: 10 }}>
                  <Badge label={STATUS_LABEL[status] ?? String(item.status)} tone={tone} />
                </View>
              </Card>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  timeCol: { width: 52, paddingTop: 16 },
  time: { fontFamily: typography.fontFamilyHeavy, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  card: { flex: 1, padding: 16, borderRadius: radii.lg + 2 },
  cardWarn: { borderWidth: 1.5, borderColor: colors.warn },
  title: { fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
});
