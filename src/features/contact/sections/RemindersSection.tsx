import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listContactReminders } from '@/src/shared/api/contact-extras.api';
import { stampLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const TONE = { active: 'primary', paused: 'warn', completed: 'success', cancelled: 'neutral' } as const;

export function RemindersSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['reminders', 'contact', contactId], queryFn: () => listContactReminders(contactId) });
  const items = q.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="alarm-outline" emptyTitle={t('reminders.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((r) => (
          <RowCard
            key={r.id}
            title={r.title}
            lines={[r.content, `${t('reminders.fires', { when: stampLabel(r.first_fire_at) })}${r.recurrence && r.recurrence.unit ? ` · ${t('reminders.repeats')}` : ''}`]}
            right={<Badge label={t(`reminders.status.${r.status}`)} tone={TONE[r.status] ?? 'neutral'} />}
          />
        ))}
      </View>
    </QueryState>
  );
}
