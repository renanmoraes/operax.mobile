import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { Badge, Button, Field } from '@/src/design-system/ui';
import { useCan } from '@/src/features/auth/useCan';
import { issueMemberCard, listMemberCards, revokeMemberCard, type MemberCard } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { QueryState, RowCard } from '../parts';

export function MemberCardsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const can = useCan();
  const qc = useQueryClient();
  const key = ['contact', contactId, 'member-cards'];
  const q = useQuery({ queryKey: key, queryFn: () => listMemberCards(contactId) });
  const [revoking, setRevoking] = useState<MemberCard | null>(null);
  const [reason, setReason] = useState('');
  const items = q.data ?? [];
  const refresh = () => void qc.invalidateQueries({ queryKey: key });

  const issue = useMutation({
    mutationFn: () => issueMemberCard(contactId),
    onSuccess: () => { refresh(); void showDialog({ title: t('memberCards.issued'), tone: 'success' }); },
    onError: () => void showDialog({ title: t('memberCards.issueFailed'), tone: 'warn' }),
  });
  const revoke = useMutation({
    mutationFn: () => revokeMemberCard(revoking!.id, reason.trim() || undefined),
    onSuccess: () => { setRevoking(null); setReason(''); refresh(); },
    onError: () => void showDialog({ title: t('memberCards.revokeFailed'), tone: 'warn' }),
  });

  return (
    <View style={{ gap: 12 }}>
      <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="card-outline" emptyTitle={t('memberCards.empty')} onRetry={() => void q.refetch()}>
        <View style={{ gap: 10 }}>
          {items.map((c) => {
            const revoked = c.status === 'revoked';
            return (
              <RowCard
                key={c.id}
                title={c.card_code}
                lines={[c.plan_name ? t('memberCards.plan', { name: c.plan_name }) : null, revoked ? t('memberCards.revokedOn', { date: dayLabel(c.revoked_at) }) : t('memberCards.issuedOn', { date: dayLabel(c.issued_at) }), revoked ? c.revoked_reason : null]}
                onPress={!revoked && can('members:revoke') ? () => setRevoking(c) : undefined}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge label={t(`memberCards.cardStatus.${c.status}`)} tone={revoked ? 'neutral' : 'success'} />
                    <Badge label={t(`memberCards.member.${c.member_status}`)} tone={c.member_status === 'active' ? 'success' : c.member_status === 'pending_payment' ? 'warn' : 'neutral'} />
                  </View>
                }
              />
            );
          })}
        </View>
      </QueryState>
      {can('members:issue') ? <Button label={t('memberCards.issue')} variant="soft" icon="add" loading={issue.isPending} onPress={() => issue.mutate()} /> : null}
      {revoking ? (
        <BottomSheet visible onClose={() => setRevoking(null)} title={t('memberCards.revokeTitle', { code: revoking.card_code })}
          footer={<Button label={t('memberCards.revoke')} variant="danger" loading={revoke.isPending} onPress={() => revoke.mutate()} />}>
          <View style={{ gap: 12 }}>
            <Field label={t('memberCards.revokeReason')} value={reason} onChangeText={setReason} />
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}
