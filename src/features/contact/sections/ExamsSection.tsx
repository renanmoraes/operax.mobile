import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { Badge, Button, Card, EmptyState, Loading } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useCan } from '@/src/features/auth/useCan';
import { getClinicalPatient, listPatientExamRequests, listPatientExamResults, setExamPortalRelease, type ExamRequest, type ExamResult } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { QueryState } from '../parts';

type Line = { key: string; request: ExamRequest | null; result: ExamResult | null };
const REQ = ['requested', 'collected', 'resulted', 'cancelled'] as const;
const RES = ['partial', 'final', 'rectified'] as const;

export function ExamsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const can = useCan();
  const canResults = can('clinical:exams_read');
  const qc = useQueryClient();
  const patientQ = useQuery({ queryKey: ['contact', contactId, 'clinical'], queryFn: () => getClinicalPatient(contactId), retry: false });
  const pid = patientQ.data?.id;
  const reqQ = useQuery({ queryKey: ['clinica', 'exam-requests', 'patient', pid], enabled: !!pid, queryFn: () => listPatientExamRequests(pid!) });
  const resQ = useQuery({ queryKey: ['clinica', 'exam-results', 'patient', pid], enabled: !!pid && canResults, queryFn: () => listPatientExamResults(pid!) });

  const lines = useMemo<Line[]>(() => {
    const requests = reqQ.data ?? [];
    const results = resQ.data ?? [];
    const byRequest = new Map<string, ExamResult>();
    for (const r of results) if (r.exam_request_id) byRequest.set(r.exam_request_id, r);
    const fromRequests = requests.map((r) => ({ key: `req:${r.request_id}`, request: r, result: byRequest.get(r.request_id) ?? null }));
    // Laudo que chegou sem pedido no sistema não pode sumir da tela.
    const loose = results.filter((r) => !r.exam_request_id || !requests.some((p) => p.request_id === r.exam_request_id)).map((r) => ({ key: `res:${r.id}`, request: null, result: r }));
    return [...fromRequests, ...loose];
  }, [reqQ.data, resQ.data]);

  const release = useMutation({
    mutationFn: (v: { id: string; released: boolean }) => setExamPortalRelease(v.id, v.released),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['clinica', 'exam-results', 'patient', pid] }),
    onError: () => void showDialog({ title: t('exams.releaseFailed'), tone: 'warn' }),
  });

  if (patientQ.isLoading) return <Loading />;
  if (!pid) return <EmptyState icon="flask-outline" title={t('exams.noPatient')} subtitle={t('clinical.notPatientHint')} />;

  return (
    <QueryState loading={reqQ.isLoading || (canResults && resQ.isLoading)} error={reqQ.isError} failure={reqQ.error} empty={lines.length === 0} emptyIcon="flask-outline" emptyTitle={t('exams.empty')} emptySub={t('exams.emptyHint')} onRetry={() => void reqQ.refetch()}>
      <View style={{ gap: 10 }}>
        {lines.map(({ key, request, result }) => {
          const title = request ? request.items.map((i) => i.name).join(' · ') || t('exams.noItems') : result?.exam_name ?? t('exams.exam');
          const when = request?.requested_at ?? result?.released_at;
          const released = !!result?.portal_released_at;
          return (
            <Card key={key} style={{ gap: 8, padding: 14 }}>
              <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text }}>{title}</Text>
              <Text style={{ fontFamily: typography.fontFamily, fontSize: 13, color: colors.textMuted }}>
                {[dayLabel(when), request?.doctor_name ? t('exams.doctor', { name: request.doctor_name }) : null].filter(Boolean).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {request ? <Badge label={(REQ as readonly string[]).includes(request.status) ? t(`exams.request.${request.status}`) : request.status} tone={request.status === 'resulted' ? 'success' : 'primary'} /> : <Badge label={t('exams.noRequest')} />}
                {request?.priority === 'urgente' ? <Badge label={t('exams.urgent')} tone="danger" /> : null}
                {result ? <Badge label={(RES as readonly string[]).includes(result.status) ? t(`exams.result.${result.status as (typeof RES)[number]}`) : result.status} tone="success" /> : null}
                {result && result.abnormal_count > 0 ? <Badge label={t('exams.abnormal', { count: result.abnormal_count })} tone="danger" /> : null}
                {result ? <Badge label={released ? t('exams.portalOn') : t('exams.portalOff')} tone={released ? 'success' : 'neutral'} /> : null}
              </View>
              {result && can('clinical:exams_release_portal') ? (
                <Button label={released ? t('exams.withdraw') : t('exams.release')} variant="soft" compact loading={release.isPending && release.variables?.id === result.id} onPress={() => release.mutate({ id: result.id, released: !released })} />
              ) : null}
            </Card>
          );
        })}
      </View>
    </QueryState>
  );
}
