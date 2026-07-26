import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Muted, Title } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function MfaScreen() {
  const insets = useSafeAreaInsets();
  const { verifyMfa, error } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        <Title style={{ color: '#fff' }}>Verificação</Title>
        <Muted style={{ color: '#9aa8bd' }}>
          Digite o código do autenticador ou o que enviamos por e-mail/SMS.
        </Muted>
      </View>

      <View style={styles.card}>
        <Field label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="000000" />
        {error ? <Body style={{ color: colors.danger, fontSize: 13 }}>{error}</Body> : null}
        <Button
          label={loading ? 'Confirmando…' : 'Confirmar'}
          disabled={loading}
          onPress={async () => {
            setLoading(true);
            try {
              await verifyMfa(code || '000000');
              router.replace('/(app)/inbox');
            } catch {
              /* error */
            } finally {
              setLoading(false);
            }
          }}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.chromeNavy,
    justifyContent: 'space-between',
  },
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
