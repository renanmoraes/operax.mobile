import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/design-system/tokens';
import { Card, EmptyState, IconTile, Muted, PressableScale } from '@/src/design-system/ui';
import { PortalPage } from '@/src/features/portal/PortalPage';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalAnamnesisPending } from '@/src/features/portal/usePortal';

/** As anamneses que a equipe pediu e faltam responder. */
export default function AnamnesisListScreen() {
  const { t } = useTranslation('portal');
  const q = usePortalAnamnesisPending();
  useFocusRefetch(q.refetch);
  const items = q.data ?? [];
  return (
    <PortalPage title={t('anam.title')} lead={t('anam.lead')} loading={q.isLoading} error={q.isError ? t('common.loadFail') : null} onRetry={() => void q.refetch()}>
      {!items.length ? <EmptyState icon="clipboard-outline" title={t('anam.empty')} /> : null}
      {items.map((a) => (
        <PressableScale key={a.id} onPress={() => router.push(`/cliente/anamnese/${encodeURIComponent(a.id)}`)} accessibilityRole="button" accessibilityLabel={a.name}>
          <Card style={styles.row}>
            <IconTile icon="clipboard-outline" size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{a.name}</Text>
              <Muted style={{ fontSize: 12.5 }}>{t('anam.missing')}</Muted>
            </View>
          </Card>
        </PressableScale>
      ))}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
});
