import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Body, Muted, Title } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Não encontrado' }} />
      <View style={styles.container}>
        <Title>Tela não encontrada</Title>
        <Muted>Esse caminho não existe no app.</Muted>
        <Link href="/" style={{ marginTop: spacing.md }}>
          <Body style={{ color: '#1e4ed8' }}>Voltar ao início</Body>
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
