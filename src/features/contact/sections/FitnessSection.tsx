import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { Badge, Button, Card, EmptyState, Muted } from '@/src/design-system/ui';
import { useCan } from '@/src/features/auth/useCan';
import { getFitnessLink, getFitnessStudent, revokeFitnessLink, rotateFitnessLink } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { GroupLabel, QueryState, RowCard } from '../parts';

export function FitnessSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['contact', contactId, 'fitness'], queryFn: () => getFitnessStudent(contactId) });
  const student = q.data;
  const linkQ = useQuery({ queryKey: ['contact', contactId, 'fitness-link'], enabled: !!student, queryFn: () => getFitnessLink(contactId) });
  const url = linkQ.data ?? null;
  const canManage = can('fitness:assessments');
  const done = (msg: string) => { void qc.invalidateQueries({ queryKey: ['contact', contactId, 'fitness-link'] }); void showDialog({ title: msg, tone: 'success' }); };
  const fail = () => void showDialog({ title: t('fitness.linkFailed'), tone: 'warn' });
  const rotate = useMutation({ mutationFn: () => rotateFitnessLink(contactId), onSuccess: () => done(url ? t('fitness.linkRotated') : t('fitness.link')), onError: fail });
  const revoke = useMutation({ mutationFn: () => revokeFitnessLink(contactId), onSuccess: () => done(t('fitness.linkDisabled')), onError: fail });

  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={false} emptyTitle="" onRetry={() => void q.refetch()}>
      {!student ? (
        <EmptyState icon="barbell-outline" title={t('fitness.notStudent')} subtitle={t('fitness.notStudentHint')} />
      ) : (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 6 }}>
            <Badge label={student.attendance_mode === 'online' ? t('fitness.mode.online') : t('fitness.mode.in_person')} tone="primary" />
            <Muted>{student.last_activity_on ? t('fitness.lastActivity', { date: dayLabel(student.last_activity_on) }) : t('fitness.never')}</Muted>
          </Card>

          <GroupLabel>{t('fitness.contracts')}</GroupLabel>
          {student.contracts.map((c) => (
            <RowCard key={c.id} title={c.plan_name ?? '—'} right={<Badge label={t(`fitness.contractStatus.${c.status}`)} tone={c.status === 'active' ? 'success' : 'warn'} />} />
          ))}

          <GroupLabel>{t('fitness.link')}</GroupLabel>
          <Card style={{ gap: 10 }}>
            <Muted>{t('fitness.linkHint')}</Muted>
            <Muted>{url ?? t('fitness.noLink')}</Muted>
            {url ? <Button label={t('fitness.share')} variant="soft" icon="share-outline" onPress={() => void Share.share({ message: url })} /> : null}
            {canManage ? <Button label={url ? t('fitness.newLink') : t('fitness.makeLink')} variant="soft" loading={rotate.isPending} onPress={() => rotate.mutate()} /> : null}
            {canManage && url ? <Button label={t('fitness.disableLink')} variant="ghost" loading={revoke.isPending} onPress={() => revoke.mutate()} /> : null}
          </Card>
          <Muted style={{ textAlign: 'center' }}>{t('fitness.moreOnWeb')}</Muted>
        </View>
      )}
    </QueryState>
  );
}
