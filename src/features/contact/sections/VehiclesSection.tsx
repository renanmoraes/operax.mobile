import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listContactVehicles } from '@/src/shared/api/contact-extras.api';
import { QueryState, RowCard } from '../parts';

const TYPES = ['car', 'motorcycle', 'truck', 'other'] as const;

export function VehiclesSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'vehicles'], queryFn: () => listContactVehicles(contactId) });
  const items = q.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="car-outline" emptyTitle={t('vehicles.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((v) => (
          <RowCard
            key={v.id}
            title={v.plate}
            lines={[[v.brand, v.model].filter(Boolean).join(' '), [v.year, v.color].filter(Boolean).join(' · ')]}
            right={<Badge label={(TYPES as readonly string[]).includes(v.vehicle_type) ? t(`vehicles.types.${v.vehicle_type as (typeof TYPES)[number]}`) : v.vehicle_type} />}
          />
        ))}
      </View>
    </QueryState>
  );
}
