import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listContactContracts } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const STATUSES = ['draft', 'awaiting_issuer', 'sent', 'partially_signed', 'completed', 'canceled', 'expired'] as const;
const TONE: Record<string, 'success' | 'primary' | 'warn' | 'neutral'> = { completed: 'success', sent: 'primary', awaiting_issuer: 'warn', partially_signed: 'warn', expired: 'warn' };

export function ContractsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'contracts'], queryFn: () => listContactContracts(contactId) });
  const items = q.data ?? [];
  const term = (a: string | null, b: string | null) =>
    a && b ? t('contracts.between', { from: dayLabel(a), to: dayLabel(b) }) : a ? t('contracts.from', { from: dayLabel(a) }) : b ? t('contracts.until', { to: dayLabel(b) }) : t('contracts.noTerm');
  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="document-attach-outline" emptyTitle={t('contracts.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((c) => (
          <RowCard
            key={c.id}
            title={`${c.number} · ${c.title}`}
            lines={[term(c.effective_start, c.effective_end)]}
            right={<Badge label={(STATUSES as readonly string[]).includes(c.status) ? t(`contracts.status.${c.status as (typeof STATUSES)[number]}`) : c.status} tone={TONE[c.status] ?? 'neutral'} />}
          />
        ))}
      </View>
    </QueryState>
  );
}
