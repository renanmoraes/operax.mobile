import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { listCobrancaCards } from '@/src/shared/api/contact-extras.api';
import { brl } from '../format';
import { QueryState, RowCard } from '../parts';

const STATUSES = ['open', 'won', 'lost'] as const;
const DAY = 86_400_000;

/** Dias de atraso do vencimento mais antigo, ou null sem vencimento. */
function daysLate(dates: string[] | null | undefined): number | null {
  const first = [...(dates ?? [])].filter(Boolean).sort()[0];
  if (!first) return null;
  const t = new Date(`${first.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY));
}

export function CobrancaSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'cobranca'], queryFn: () => listCobrancaCards(contactId) });
  const items = q.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="cash-outline" emptyTitle={t('cobranca.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((c) => {
          const late = daysLate(c.cobranca_json?.due_dates);
          const status = (STATUSES as readonly string[]).includes(c.sale_status) ? (c.sale_status as (typeof STATUSES)[number]) : 'open';
          return (
            <RowCard
              key={c.id}
              title={brl(Math.round((c.value_estimated ?? 0) * 100))}
              lines={[t('cobranca.stage', { stage: c.stage_name, pipeline: c.pipeline_name }), c.contact_id && c.contact_name ? t('cobranca.fromOther', { name: c.contact_name }) : null]}
              right={
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge label={late == null ? t('cobranca.noDue') : late === 0 ? t('cobranca.onTime') : t('cobranca.late', { count: late })} tone={late == null || late === 0 ? 'neutral' : late <= 7 ? 'warn' : 'danger'} />
                  {status !== 'open' ? <Badge label={t(`cobranca.status.${status}`)} tone={status === 'won' ? 'success' : 'neutral'} /> : null}
                </View>
              }
            />
          );
        })}
      </View>
    </QueryState>
  );
}
