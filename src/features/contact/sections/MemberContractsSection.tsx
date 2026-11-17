import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { Badge, Button, Field, Muted } from '@/src/design-system/ui';
import { useCan } from '@/src/features/auth/useCan';
import { cancelMemberContract, listMemberContracts, type MemberContract } from '@/src/shared/api/contact-extras.api';
import { brl, dayLabel } from '../format';
import { QueryState, RowCard } from '../parts';

export function MemberContractsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const can = useCan();
  const qc = useQueryClient();
  const key = ['contact', contactId, 'member-contracts'];
  const q = useQuery({ queryKey: key, queryFn: () => listMemberContracts(contactId) });
  const [cancelling, setCancelling] = useState<MemberContract | null>(null);
  const [reason, setReason] = useState('');
  const items = q.data ?? [];

  const cancel = useMutation({
    mutationFn: () => cancelMemberContract(cancelling!.id, reason.trim() || undefined),
    onSuccess: () => { setCancelling(null); setReason(''); void qc.invalidateQueries({ queryKey: key }); void showDialog({ title: t('memberContracts.cancelledOk'), tone: 'success' }); },
    onError: () => void showDialog({ title: t('memberContracts.cancelFailed'), tone: 'warn' }),
  });

  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="document-text-outline" emptyTitle={t('memberContracts.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((c) => {
          const cancelled = c.status === 'cancelled';
          return (
            <RowCard
              key={c.id}
              title={`${t('memberContracts.contractNumber', { number: c.number })}${c.plan_name ? ` · ${c.plan_name}` : ''}`}
              lines={[
                c.monthly_cents ? t('memberContracts.monthly', { amount: brl(Number(c.monthly_cents)) }) : null,
                c.due_day ? t('memberContracts.dueDay', { day: c.due_day }) : null,
                c.seller_name ? t('memberContracts.seller', { name: c.seller_name }) : null,
                cancelled ? t('memberContracts.cancelledOn', { date: dayLabel(c.cancelled_at) }) : c.signed_at ? t('memberContracts.signedOn', { date: dayLabel(c.signed_at) }) : null,
                cancelled ? c.cancel_reason : null,
              ]}
              onPress={!cancelled && can('members:issue') ? () => setCancelling(c) : undefined}
              right={<Badge label={t(`memberContracts.status.${c.status}`)} tone={c.status === 'active' ? 'success' : c.status === 'pending_payment' ? 'warn' : 'neutral'} />}
            />
          );
        })}
        {cancelling ? (
          <BottomSheet visible onClose={() => setCancelling(null)} title={t('memberContracts.cancelTitle', { number: cancelling.number })}
            footer={<Button label={t('memberContracts.cancel')} variant="danger" loading={cancel.isPending} onPress={() => cancel.mutate()} />}>
            <View style={{ gap: 12 }}>
              <Muted>{t('memberContracts.cancelHint')}</Muted>
              <Field label={t('memberContracts.cancelReason')} value={reason} onChangeText={setReason} />
            </View>
          </BottomSheet>
        ) : null}
      </View>
    </QueryState>
  );
}
