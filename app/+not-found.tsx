import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Body, Muted, Title } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function NotFoundScreen() {
  const { t } = useTranslation('client');
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.header') }} />
      <View style={styles.container}>
        <Title>{t('notFound.title')}</Title>
        <Muted>{t('notFound.body')}</Muted>
        <Link href="/" style={{ marginTop: spacing.md }}>
          <Body style={{ color: '#1e4ed8' }}>{t('notFound.home')}</Body>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
});
