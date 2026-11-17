import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Muted } from '@/src/design-system/ui';
import { getMensalidades, type MensalidadeStatus } from '@/src/shared/api/contact-extras.api';
import { brl, dayLabel } from '../format';
import { GroupLabel, QueryState, RowCard } from '../parts';

const STATUS: readonly MensalidadeStatus[] = ['failed', 'overdue', 'scheduled', 'open', 'paid'];
const TONE: Record<MensalidadeStatus, 'danger' | 'warn' | 'primary' | 'neutral' | 'success'> = { failed: 'danger', overdue: 'warn', scheduled: 'primary', open: 'neutral', paid: 'success' };
const FORMAS = ['pix_automatico', 'carne', 'manual'] as const;
const PIX = ['awaiting_authorization', 'active', 'refused', 'cancelled', 'expired', 'failed'] as const;

/** "2026-11" → "nov. de 2026" no idioma do app. */
function competence(c: string): string {
  const [y, m] = c.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, (m || 1) - 1, 1)));
}

export function MensalidadesSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'mensalidades'], queryFn: () => getMensalidades(contactId) });
  const contratos = q.data?.contratos ?? [];
  const meses = q.data?.meses ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={contratos.length === 0 && meses.length === 0} emptyIcon="calendar-number-outline" emptyTitle={t('mensalidades.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        <GroupLabel>{t('mensalidades.contracts')}</GroupLabel>
        {contratos.map((c) => {
          const forma = (FORMAS as readonly string[]).includes(c.forma) ? t(`mensalidades.forma.${c.forma as (typeof FORMAS)[number]}`) : c.forma;
          const pix = c.pix && (PIX as readonly string[]).includes(c.pix.status) ? t(`mensalidades.pix.${c.pix.status as (typeof PIX)[number]}`) : null;
          return (
            <RowCard
              key={c.contract_id}
              title={`${t('mensalidades.contractNumber', { number: c.number })}${c.plan_name ? ` · ${c.plan_name}` : ''}`}
              lines={[t('mensalidades.perMonth', { amount: brl(c.monthly_cents) }), c.due_day ? t('mensalidades.dueDay', { day: c.due_day }) : null, [forma, c.bank].filter(Boolean).join(' · '), pix]}
            />
          );
        })}
        <GroupLabel>{t('mensalidades.months')}</GroupLabel>
        {meses.length === 0 ? <Muted>{t('mensalidades.noMonths')}</Muted> : null}
        {meses.map((m) => (
          <RowCard
            key={m.receivable_id}
            title={`${competence(m.competence)} · ${brl(m.amount_cents)}`}
            lines={[t('mensalidades.due', { date: dayLabel(m.due_date) }), m.paid_amount_cents > 0 ? t('mensalidades.paid', { amount: brl(m.paid_amount_cents) }) : null, m.reason]}
            right={<Badge label={(STATUS as readonly string[]).includes(m.status) ? t(`mensalidades.status.${m.status}`) : m.status} tone={TONE[m.status] ?? 'neutral'} />}
          />
        ))}
      </View>
    </QueryState>
  );
}
