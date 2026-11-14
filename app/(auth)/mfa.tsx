import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';

export default function MfaScreen() {
  const { verifyMfa, error } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <AuthShell
      onBack={() => router.replace('/(auth)/login')}
      tag="Equipe"
      title="Só mais um passo"
      subtitle="Digite o código do autenticador ou o que enviamos por e-mail ou SMS."
      footer={
        <Button
          label="Confirmar"
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
      <Field label="Código" icon="keypad-outline" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" />
      {error ? <Body style={{ color: colors.dangerText, fontSize: 13.5 }}>{error}</Body> : null}
    </AuthShell>
  );
}
