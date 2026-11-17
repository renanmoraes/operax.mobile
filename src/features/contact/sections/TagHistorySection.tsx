import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listTagEvents } from '@/src/shared/api/contacts.api';
import { stampLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const SOURCES = ['manual', 'ai', 'auto', 'workflow', 'cobranca', 'lifecycle'] as const;

export function TagHistorySection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const q = useQuery({ queryKey: ['contact', contactId, 'tag-events'], queryFn: () => listTagEvents(contactId) });
  const items = q.data?.items ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={items.length === 0} emptyIcon="pricetags-outline" emptyTitle={t('tagHistory.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 8 }}>
        {items.map((e) => {
          const source = (SOURCES as readonly string[]).includes(e.source) ? t(`tagHistory.sources.${e.source as (typeof SOURCES)[number]}`) : e.source;
          const action = e.action === 'applied' ? t('tagHistory.applied') : t('tagHistory.removed');
          return (
            <RowCard
              key={e.id}
              title={e.tag}
              lines={[`${t('tagHistory.by', { action, source })}${e.reason ? ` · ${e.reason}` : ''}`, stampLabel(e.created_at)]}
              right={<Badge label={action} tone={e.action === 'applied' ? 'success' : 'neutral'} />}
            />
          );
        })}
      </View>
    </QueryState>
  );
}
