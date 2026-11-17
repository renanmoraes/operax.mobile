import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listCsScores } from '@/src/shared/api/contact-extras.api';
import { stampLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const BANDS = ['promoter', 'passive', 'detractor'] as const;
const METRICS = ['nps', 'csat', 'ces', 'mixed'] as const;
const TONE = { promoter: 'success', passive: 'warn', detractor: 'danger', none: 'neutral' } as const;

export function NpsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['customer-success', 'contact-scores', contactId], queryFn: () => listCsScores(contactId) });
  const items = q.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="star-outline" emptyTitle={t('nps.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((s) => {
          const band = (BANDS as readonly string[]).includes(s.band) ? (s.band as (typeof BANDS)[number]) : 'none';
          const metric = (METRICS as readonly string[]).includes(s.metric) ? t(`nps.metrics.${s.metric as (typeof METRICS)[number]}`) : s.metric;
          return (
            <RowCard
              key={s.id}
              title={`${metric} · ${s.score}`}
              lines={[stampLabel(s.recorded_at)]}
              right={<Badge label={t(`nps.bands.${band}`)} tone={TONE[band]} icon="star" />}
            />
          );
        })}
      </View>
    </QueryState>
  );
}
