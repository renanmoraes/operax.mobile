import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Body, Button, Field } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';

export default function ClientOtpScreen() {
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
    <AuthShell
      onBack={() => router.replace('/(auth)/client-login')}
      title="Confira seu celular"
      subtitle={`Digite o código de 6 dígitos enviado para ${identifier ?? 'você'}.`}
      footer={
        <>
          <Button
            label="Confirmar"
            loading={loading}
            disabled={code.length < 4}
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
            label={cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
            variant="ghost"
            disabled={cooldown > 0}
            onPress={resend}
          />
        </>
      }
    >
      <Field label="Código" icon="keypad-outline" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" />
      {blocked ? (
        <Body style={styles.error}>Nenhuma das suas empresas tem o portal disponível. Fale com elas para habilitar.</Body>
      ) : error ? (
        <Body style={styles.error}>{error}</Body>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13.5 },
});
