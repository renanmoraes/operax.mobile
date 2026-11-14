import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Body, Button, Field } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';

export default function ClientOtpScreen() {
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const { verifyClientOtp, requestClientOtp, setClientPassword, error } = useAuth();
  // Primeiro acesso: depois do código certo, a pessoa cria a senha para as próximas vezes.
  const [creating, setCreating] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
      title={creating ? 'Crie sua senha' : 'Confira seu celular'}
      subtitle={
        creating
          ? 'É o seu primeiro acesso. Com a senha você entra direto nas próximas vezes.'
          : `Digite o código de 6 dígitos enviado para ${identifier ?? 'você'}.`
      }
      footer={
        creating ? (
          <Button
            label="Criar senha e entrar"
            loading={loading}
            disabled={password.length < 8 || password !== confirm}
            onPress={async () => {
              setLoading(true);
              try {
                const outcome = await setClientPassword(password);
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
        ) : (
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
                  if (outcome === 'set_password') {
                    setCreating(true);
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
            <Button label={cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'} variant="ghost" disabled={cooldown > 0} onPress={resend} />
          </>
        )
      }
    >
      {creating ? (
        <>
          <Field
            label="Nova senha"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Pelo menos 8 caracteres"
          />
          <Field label="Repita a senha" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
          {confirm && password !== confirm ? <Body style={styles.error}>As senhas não são iguais.</Body> : null}
        </>
      ) : (
        <Field
          label="Código"
          icon="keypad-outline"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          placeholder="000000"
        />
      )}
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
