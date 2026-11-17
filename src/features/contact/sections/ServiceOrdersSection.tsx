import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listContactServiceOrders } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const STATUSES = ['draft', 'pending_approval', 'approved', 'scheduled', 'assigned', 'in_progress', 'on_hold', 'waiting_customer', 'waiting_material', 'waiting_third_party', 'completed', 'accepted', 'cancelled', 'reopened', 'archived'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'] as const;
const DONE = new Set(['completed', 'accepted']);
const STOP = new Set(['cancelled', 'archived']);

export function ServiceOrdersSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'service-orders'], queryFn: () => listContactServiceOrders(contactId) });
  const items = q.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={items.length === 0} emptyIcon="clipboard-outline" emptyTitle={t('serviceOrders.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((o) => {
          const status = (STATUSES as readonly string[]).includes(o.status) ? t(`serviceOrders.status.${o.status as (typeof STATUSES)[number]}`) : o.status;
          const prio = (PRIORITIES as readonly string[]).includes(o.priority) ? t(`serviceOrders.priority.${o.priority as (typeof PRIORITIES)[number]}`) : null;
          return (
            <RowCard
              key={o.id}
              title={`${o.display_code} · ${o.title}`}
              lines={[o.responsible?.name || t('serviceOrders.noOwner'), o.due_at ? t('serviceOrders.due', { date: dayLabel(o.due_at) }) : t('serviceOrders.noDue')]}
              right={
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge label={status} tone={DONE.has(o.status) ? 'success' : STOP.has(o.status) ? 'neutral' : 'primary'} />
                  {prio && (o.priority === 'high' || o.priority === 'urgent' || o.priority === 'critical') ? <Badge label={prio} tone="danger" /> : null}
                </View>
              }
            />
          );
        })}
      </View>
    </QueryState>
  );
}
