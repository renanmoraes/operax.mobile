import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, Muted } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useCan } from '@/src/features/auth/useCan';
import { getClinicalPatient } from '@/src/shared/api/contact-extras.api';
import { ymdToBr } from '../format';
import { GroupLabel, QueryState, RowCard } from '../parts';

const SEXES = ['female', 'male', 'other', 'unknown'] as const;

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} selectable>{value}</Text>
    </View>
  );
}

export function ClinicalSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contactMore');
  const can = useCan();
  const canReadClinical = can('clinical:records_read');
  const q = useQuery({ queryKey: ['contact', contactId, 'clinical'], queryFn: () => getClinicalPatient(contactId), retry: false });
  const p = q.data;
  const none = '—';
  return (
    <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={false} emptyTitle="" onRetry={() => void q.refetch()}>
      {!p ? (
        <EmptyState icon="medkit-outline" title={t('clinical.notPatient')} subtitle={t('clinical.notPatientHint')} />
      ) : (
        <View style={{ gap: 12 }}>
          <View style={styles.badges}>
            {p.priority_flag ? <Badge label={t('clinical.priority')} tone="warn" icon="alert-circle" /> : null}
            {p.restricted_access ? <Badge label={t('clinical.restricted')} tone="danger" icon="lock-closed" /> : null}
            {canReadClinical && p.prefers_dynamic_care ? <Badge label={t('clinical.dynamic')} /> : null}
            {canReadClinical && p.injectable_nutrition_adept ? <Badge label={t('clinical.injectable')} /> : null}
          </View>
          <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
            <Row label={t('clinical.cpf')} value={p.cpf || none} />
            <Row label={t('clinical.cns')} value={p.cns || none} />
            <Row label={t('clinical.birth')} value={ymdToBr(p.birth_date) || none} />
            <Row label={t('clinical.sex')} value={p.sex && (SEXES as readonly string[]).includes(p.sex) ? t(`clinical.sexes.${p.sex as (typeof SEXES)[number]}`) : none} last={!canReadClinical && !p.social_name} />
            {p.social_name ? <Row label={t('clinical.socialName')} value={p.social_name} last={!canReadClinical} /> : null}
            {canReadClinical ? (
              <>
                <Row label={t('clinical.blood')} value={p.blood_type || none} />
                <Row label={t('clinical.allergies')} value={p.allergies_summary || none} />
                <Row label={t('clinical.notes')} value={p.notes?.trim() || none} last />
              </>
            ) : null}
          </Card>
          <GroupLabel>{t('clinical.insurances')}</GroupLabel>
          {p.insurances.length === 0 ? <Muted>{t('clinical.private')}</Muted> : p.insurances.map((i) => (
            <RowCard key={i.id} title={i.insurer_name} lines={[i.card_number, i.plan_name]} right={i.is_default ? <Badge label={t('clinical.defaultInsurance')} tone="primary" /> : undefined} />
          ))}
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { paddingVertical: 12, gap: 2 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  value: { fontFamily: typography.fontFamilyMedium, fontSize: 15.5, color: colors.text },
});
