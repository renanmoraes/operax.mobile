import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/design-system/tokens';
import { Chip, Muted } from '@/src/design-system/ui';
import { listActivePlans } from '@/src/shared/api/scheduling.api';
import type { PaymentChoice } from './newBooking';

/**
 * Particular ou convênio, e qual convênio (cadastro "Planos aceitos"). Convênio sem plano escolhido não deixa salvar:
 * quem usa confere com `paymentComplete`. Serve ao dar entrada e à correção do pagamento de agendamento aberto.
 */
export function PaymentPicker({ value, onChange }: { value: PaymentChoice; onChange: (next: PaymentChoice) => void }) {
  const { t } = useTranslation('agenda');
  const plans = useQuery({ queryKey: ['sched', 'plans'], queryFn: listActivePlans, enabled: value.type === 'insurance', staleTime: 5 * 60_000 });
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.wrap}>
        <Chip label={t('sheet.payPrivate')} selected={value.type === 'private'} onPress={() => onChange({ type: 'private', planId: '' })} />
        <Chip label={t('sheet.payInsurance')} selected={value.type === 'insurance'} onPress={() => onChange({ type: 'insurance', planId: value.planId })} />
      </View>
      {value.type === 'insurance' ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.sub}>{t('sheet.payPlan')}</Text>
          {plans.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : !(plans.data ?? []).length ? (
            <Muted>{t('sheet.payNoPlans')}</Muted>
          ) : (
            <View style={styles.wrap}>
              {(plans.data ?? []).map((p) => (
                <Chip key={p.id} label={p.name} selected={value.planId === p.id} onPress={() => onChange({ type: 'insurance', planId: p.id })} />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sub: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textSoft },
});
