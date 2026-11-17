import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Card, EmptyState, Muted } from '@/src/design-system/ui';
import { getContactAccess } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { GroupLabel, QueryState, RowCard } from '../parts';

const PROFILE = ['active', 'suspended', 'expired'] as const;
const CRED_STATUS = ['pending', 'active', 'suspended', 'expired', 'revoked', 'lost', 'replaced'] as const;
const CRED_TYPE = ['card', 'pin', 'qr_code', 'face', 'fingerprint', 'plate', 'tag', 'barcode'] as const;

export function AccessSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const q = useQuery({ queryKey: ['contact', contactId, 'access'], queryFn: () => getContactAccess(contactId) });
  const data = q.data;

  const term = (from: string | null, to: string | null) =>
    from && to ? t('access.between', { from: dayLabel(from), to: dayLabel(to) }) : from ? t('access.from', { from: dayLabel(from) }) : to ? t('access.until', { to: dayLabel(to) }) : t('access.noLimit');

  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={!!data && !data.perfil} emptyIcon="enter-outline" emptyTitle={t('access.empty')} emptySub={t('access.emptyHint')} onRetry={() => void q.refetch()}>
      {data?.perfil ? (
        <View style={{ gap: 10 }}>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Badge
                label={(PROFILE as readonly string[]).includes(data.perfil.situacao) ? t(`access.profile.${data.perfil.situacao as (typeof PROFILE)[number]}`) : data.perfil.situacao}
                tone={data.perfil.situacao === 'active' ? 'success' : 'danger'}
              />
              <Muted>{term(data.perfil.valido_desde, data.perfil.valido_ate)}</Muted>
            </View>
            {data.perfil.motivo_da_suspensao ? <Muted>{t('access.suspendedReason', { reason: data.perfil.motivo_da_suspensao })}</Muted> : null}
          </Card>

          <GroupLabel>{t('access.groups')}</GroupLabel>
          {data.grupos.length === 0 ? <Muted>{t('access.noGroups')}</Muted> : data.grupos.map((g) => <RowCard key={g.id} title={g.nome} lines={[term(g.valido_desde, g.valido_ate)]} />)}

          <GroupLabel>{t('access.credentials')}</GroupLabel>
          {data.credenciais.length === 0 ? <Muted>{t('access.noCredentials')}</Muted> : data.credenciais.map((c) => (
            <RowCard
              key={c.id}
              title={c.rotulo}
              lines={[[(CRED_TYPE as readonly string[]).includes(c.tipo) ? t(`access.credType.${c.tipo as (typeof CRED_TYPE)[number]}`) : c.tipo, c.valor_mascarado].filter(Boolean).join(' · '), term(c.valido_desde, c.valido_ate)]}
              right={<Badge label={(CRED_STATUS as readonly string[]).includes(c.situacao) ? t(`access.credStatus.${c.situacao as (typeof CRED_STATUS)[number]}`) : c.situacao} tone={c.situacao === 'active' ? 'success' : c.situacao === 'pending' ? 'warn' : 'neutral'} />}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="enter-outline" title={t('access.empty')} subtitle={t('access.emptyHint')} />
      )}
    </QueryState>
  );
}
