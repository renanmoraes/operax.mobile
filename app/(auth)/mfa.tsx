import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Body, Button, Chip, Field, Muted } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';

/**
 * Segundo fator do login da equipe. O autenticador pede só o código; e-mail e WhatsApp precisam que o app peça o envio
 * antes (o servidor manda e devolve o desafio que o código responde).
 */
export default function MfaScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const { verifyMfa, sendMfaCode, mfaMethods, error, clearError } = useAuth();
  const [method, setMethod] = useState(mfaMethods.primary);
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; method: 'email' | 'whatsapp' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const remote = method === 'email' || method === 'whatsapp';
  const sent = remote && challenge?.method === method;

  const pick = (m: typeof method) => {
    clearError();
    setMethod(m);
    setCode('');
  };

  const send = async () => {
    if (!remote) return;
    setSending(true);
    try {
      const r = await sendMfaCode(method);
      setChallenge({ id: r.challengeId, method });
    } catch {
      /* mensagem no estado de erro */
    } finally {
      setSending(false);
    }
  };

  const confirm = async () => {
    setLoading(true);
    try {
      await verifyMfa(code.trim(), remote && challenge ? { method: challenge.method, challengeId: challenge.id } : undefined);
      router.replace('/');
    } catch {
      /* error */
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      onBack={() => router.replace('/(auth)/login')}
      tag={t('shared.team')}
      title={t('mfa.title')}
      subtitle={t('mfa.subtitle')}
      footer={
        remote && !sent ? (
          <Button label={t('mfa.send')} icon="paper-plane-outline" loading={sending} onPress={() => void send()} />
        ) : (
          <>
            <Button label={t('common:actions.confirm')} loading={loading} disabled={code.trim().length < 6} onPress={() => void confirm()} />
            {sent ? <Button label={t('mfa.resend')} variant="ghost" loading={sending} onPress={() => void send()} /> : null}
          </>
        )
      }
    >
      {mfaMethods.enabled.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Muted>{t('mfa.pick')}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {mfaMethods.enabled.map((m) => (
              <Chip key={m} label={t(`mfa.methods.${m}`)} selected={method === m} onPress={() => pick(m)} />
            ))}
          </View>
        </View>
      ) : null}
      <Muted style={{ lineHeight: 20 }}>{remote ? (sent ? t(`mfa.${method}`) : t('mfa.subtitle')) : t('mfa.totp')}</Muted>
      {!remote || sent ? (
        <Field label={t('fields.code')} icon="keypad-outline" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" maxLength={6} />
      ) : null}
      {error ? <Body style={{ color: colors.dangerText, fontSize: 13.5 }}>{error}</Body> : null}
    </AuthShell>
  );
}
