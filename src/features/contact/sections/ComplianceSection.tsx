import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Muted } from '@/src/design-system/ui';
import { listConsents, listTermAcceptances } from '@/src/shared/api/contact-extras.api';
import { dayLabel } from '../format';
import { GroupLabel, RowCard } from '../parts';

/** "agent_manual" → "Agent manual": o que sobra quando o código não tem texto próprio. */
const humanize = (v: string) => v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function ComplianceSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const cq = useQuery({ queryKey: ['contact', contactId, 'consents'], queryFn: () => listConsents(contactId) });
  const aq = useQuery({ queryKey: ['contact', contactId, 'acceptances'], queryFn: () => listTermAcceptances(contactId) });
  const consents = cq.data ?? [];
  const terms = aq.data ?? [];
  return (
    <View style={{ gap: 10 }}>
      <GroupLabel>{t('compliance.consents')}</GroupLabel>
      {consents.length === 0 ? <Muted>{cq.isError ? '—' : t('compliance.emptyConsents')}</Muted> : null}
      {consents.map((c) => (
        <RowCard
          key={c.id}
          title={humanize(c.consent_type)}
          lines={[c.source_description, t('compliance.grantedOn', { date: dayLabel(c.granted_at) })]}
          right={<Badge label={c.active ? t('compliance.active') : t('compliance.inactive')} tone={c.active ? 'success' : 'neutral'} />}
        />
      ))}
      <GroupLabel>{t('compliance.terms')}</GroupLabel>
      {terms.length === 0 ? <Muted>{aq.isError ? '—' : t('compliance.emptyTerms')}</Muted> : null}
      {terms.map((a) => (
        <RowCard
          key={a.id}
          title={a.termVersion.title}
          lines={[`v${a.termVersion.version}`, a.source_channel ? t('compliance.channel', { name: humanize(a.source_channel) }) : null, t('compliance.acceptedOn', { date: dayLabel(a.accepted_at) })]}
          right={<Badge label={humanize(a.acceptance_level)} />}
        />
      ))}
    </View>
  );
}
