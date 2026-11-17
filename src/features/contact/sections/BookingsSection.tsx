import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { wallClock, wallDateLabel } from '@/src/features/agenda/wallClock';
import { locale } from '@/src/i18n';
import { listBookings, type ApiBooking } from '@/src/shared/api/bookings.api';
import { GroupLabel, QueryState, RowCard } from '../parts';

const TONE: Record<string, 'success' | 'warn' | 'danger' | 'neutral' | 'primary'> = {
  confirmed: 'success', pending: 'warn', cancelled: 'danger', rejected: 'danger', no_show: 'danger', completed: 'neutral', done: 'neutral', checked_in: 'primary', in_progress: 'primary',
};
const KNOWN = ['confirmed', 'pending', 'cancelled', 'completed', 'done', 'no_show', 'rejected', 'checked_in', 'in_progress', 'waitlisted', 'offered', 'expired'] as const;

export function BookingsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation(['contact', 'agenda']);
  const q = useQuery({
    queryKey: ['contact', contactId, 'bookings'],
    queryFn: async () => {
      const r = await listBookings({ contact_id: contactId, limit: 100 });
      if (!r.ok) throw new Error(r.message);
      return r.items;
    },
  });
  const items = q.data ?? [];
  // Horário de agenda é relógio de parede: compara os textos, sem converter pelo fuso do aparelho.
  const nowWall = new Date();
  const todayKey = `${nowWall.getFullYear()}-${String(nowWall.getMonth() + 1).padStart(2, '0')}-${String(nowWall.getDate()).padStart(2, '0')}`;
  const upcoming = items.filter((b) => b.starts_at.slice(0, 10) >= todayKey).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = items.filter((b) => b.starts_at.slice(0, 10) < todayKey).sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const card = (b: ApiBooking) => {
    const status = (b.raw_status ?? b.status) as string;
    const known = (KNOWN as readonly string[]).includes(status) ? (status as (typeof KNOWN)[number]) : null;
    const date = wallDateLabel(b.starts_at, locale(), { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
    return (
      <RowCard
        key={b.id}
        title={b.service_name ?? t('contact:section.agendamentos')}
        lines={[t('contact:bookings.at', { date, time: wallClock(b.starts_at) }), b.provider_name ? t('contact:bookings.withProvider', { name: b.provider_name }) : null, b.location_name]}
        right={<Badge label={known ? t(`agenda:agenda.status.${known}`) : t('agenda:agenda.statusOther')} tone={TONE[status] ?? 'neutral'} />}
      />
    );
  };

  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="calendar-outline" emptyTitle={t('contact:bookings.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {upcoming.length ? <GroupLabel>{t('contact:bookings.upcoming')}</GroupLabel> : null}
        {upcoming.map(card)}
        {past.length ? <GroupLabel>{t('contact:bookings.past')}</GroupLabel> : null}
        {past.map(card)}
      </View>
    </QueryState>
  );
}
