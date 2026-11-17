import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Body, Button, Field } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';

export default function ClientOtpScreen() {
  const { t } = useTranslation(['auth', 'common']);
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
      title={creating ? t('clientOtp.createTitle') : identifier?.includes('@') ? t('clientOtp.checkEmailTitle') : t('clientOtp.checkTitle')}
      subtitle={
        creating
          ? t('clientOtp.createSubtitle')
          : t('clientOtp.checkSubtitle', { target: identifier ?? t('clientOtp.you') })
      }
      footer={
        creating ? (
          <Button
            label={t('clientOtp.createAndEnter')}
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
              label={t('common:actions.confirm')}
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
            <Button label={cooldown > 0 ? t('clientOtp.resendIn', { seconds: cooldown }) : t('clientOtp.resend')} variant="ghost" disabled={cooldown > 0} onPress={resend} />
          </>
        )
      }
    >
      {creating ? (
        <>
          <Field
            label={t('clientOtp.newPassword')}
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder={t('clientOtp.passwordHint')}
          />
          <Field label={t('clientOtp.repeatPassword')} icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
          {confirm && password !== confirm ? <Body style={styles.error}>{t('clientOtp.mismatch')}</Body> : null}
        </>
      ) : (
        <Field
          label={t('fields.code')}
          icon="keypad-outline"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          placeholder="000000"
        />
      )}
      {blocked ? (
        <Body style={styles.error}>{t('shared.portalBlocked')}</Body>
      ) : error ? (
        <Body style={styles.error}>{error}</Body>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13.5 },
});
