import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Muted, ProgressBar } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { interestLabel } from '@/src/features/attendance/interestLabel';
import { getContactInterests } from '@/src/shared/api/contacts.api';
import { QueryState } from '../parts';

export function InterestsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const q = useQuery({ queryKey: ['contact', contactId, 'interests'], queryFn: () => getContactInterests(contactId) });
  const items = [...(q.data ?? [])].sort((a, b) => b.score - a.score);
  const top = Math.max(1, ...items.map((i) => Number(i.score) || 0));
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={items.length === 0} emptyIcon="locate-outline" emptyTitle={t('interests.empty')} emptySub={t('interests.hint')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((i) => (
          <Card key={i.id} style={{ gap: 8, padding: 14 }}>
            <View style={styles.head}>
              <Text style={styles.name} numberOfLines={2}>{interestLabel(i.interest_code)}</Text>
              <Muted>{t('interests.score', { score: Math.round(Number(i.score) || 0) })}</Muted>
            </View>
            <ProgressBar progress={(Number(i.score) || 0) / top} />
          </Card>
        ))}
      </View>
    </QueryState>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
});
