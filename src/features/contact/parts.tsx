import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Loading } from '@/src/design-system/ui';
import { colors, text, typography } from '@/src/design-system/tokens';

/** Carregando, erro com "tentar de novo" ou vazio: o que toda seção do contato repete. */
export function QueryState({
  loading,
  error,
  empty,
  emptyIcon = 'file-tray-outline',
  emptyTitle,
  emptySub,
  onRetry,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyIcon?: React.ComponentProps<typeof EmptyState>['icon'];
  emptyTitle: string;
  emptySub?: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('contact');
  if (loading) return <Loading />;
  if (error) return <EmptyState icon="cloud-offline-outline" title={t('loadFailed')} actionLabel={t('retry')} onAction={onRetry} />;
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySub} />;
  return <>{children}</>;
}

/** Cartão de uma linha da lista: título forte, linhas de apoio e algo à direita. */
export function RowCard({ title, lines = [], right, onPress, accessibilityLabel }: { title: string; lines?: (string | null | undefined)[]; right?: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <Card style={styles.row} onPress={onPress} accessibilityLabel={accessibilityLabel ?? title}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        {lines.filter(Boolean).map((l, i) => (
          <Text key={i} style={styles.rowLine} numberOfLines={3}>{l}</Text>
        ))}
      </View>
      {right}
    </Card>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.groupLabel}>{children}</Text>;
}

export { Button };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  rowLine: { ...text.callout, color: colors.textMuted },
  groupLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginTop: 6 },
});
