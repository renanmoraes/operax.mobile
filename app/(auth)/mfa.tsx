import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Field } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';

export default function MfaScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const { verifyMfa, error } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <AuthShell
      onBack={() => router.replace('/(auth)/login')}
      tag={t('shared.team')}
      title={t('mfa.title')}
      subtitle={t('mfa.subtitle')}
      footer={
        <Button
          label={t('common:actions.confirm')}
          loading={loading}
          onPress={async () => {
            setLoading(true);
            try {
              await verifyMfa(code || '000000');
              router.replace('/');
            } catch {
              /* error */
            } finally {
              setLoading(false);
            }
          }}
        />
      }
    >
      <Field label={t('fields.code')} icon="keypad-outline" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" />
      {error ? <Body style={{ color: colors.dangerText, fontSize: 13.5 }}>{error}</Body> : null}
    </AuthShell>
  );
}
