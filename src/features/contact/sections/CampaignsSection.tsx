import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listCampaignScores } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const TONE = { active: 'success', finished: 'neutral', paused: 'warn', draft: 'neutral' } as const;

export function CampaignsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'campaigns'], queryFn: () => listCampaignScores(contactId) });
  const items = q.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={items.length === 0} emptyIcon="megaphone-outline" emptyTitle={t('campaigns.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((c) => (
          <RowCard
            key={c.campaign_id}
            title={c.campaign_name}
            lines={[
              `${t('campaigns.original')}: ${Number(c.original_score).toFixed(2)}`,
              `${t('campaigns.weighted')}: ${Number(c.weighted_score).toFixed(2)}`,
              t('campaigns.recalculated', { date: dayLabel(c.recalculated_at) }),
            ]}
            right={<Badge label={t(`campaigns.status.${c.campaign_status}`)} tone={TONE[c.campaign_status] ?? 'neutral'} />}
          />
        ))}
      </View>
    </QueryState>
  );
}
