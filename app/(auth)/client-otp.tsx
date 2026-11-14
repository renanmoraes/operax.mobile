import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Muted, Title } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientOtpScreen() {
  const insets = useSafeAreaInsets();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const { verifyClientOtp, requestClientOtp, error } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function resend() {
    if (cooldown > 0 || !identifier) return;
    try {
      await requestClientOtp(identifier);
    } catch {
      return; // erro já fica em `error`
    }
    setCooldown(30);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        <Title style={{ color: '#fff' }}>Verificação</Title>
        <Muted style={{ color: '#9aa8bd' }}>Digite o código enviado pra {identifier}.</Muted>
      </View>

      <View style={styles.card}>
        <Field
          label="Código"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="000000"
        />
        {blocked ? (
          <Body style={{ color: colors.danger, fontSize: 13 }}>
            Nenhuma das suas empresas tem o portal disponível. Fale com elas pra habilitar.
          </Body>
        ) : error ? (
          <Body style={{ color: colors.danger, fontSize: 13 }}>{error}</Body>
        ) : null}
        <Button
          label={loading ? 'Confirmando…' : 'Confirmar'}
          disabled={loading || !code}
          onPress={async () => {
            if (!identifier) return;
            setLoading(true);
            try {
              const outcome = await verifyClientOtp(identifier, code);
              if (outcome === 'blocked') {
                setBlocked(true);
                return;
              }
              router.replace('/');
            } catch {
              /* erro já fica em `error` */
            } finally {
              setLoading(false);
            }
          }}
        />
        <Button
          label={cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar código'}
          variant="ghost"
          disabled={cooldown > 0}
          onPress={resend}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.replace('/(auth)/client-login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chromeNavy, justifyContent: 'space-between' },
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
