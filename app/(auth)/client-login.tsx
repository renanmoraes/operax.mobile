import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Field, Muted, Segmented } from '@/src/design-system/ui';
import { colors, radii } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';
import { ALLOW_MOCK } from '@/src/shared/config';

type Method = 'password' | 'otp';

export default function ClientLoginScreen() {
  const { t } = useTranslation('auth');
  const { clientLogin, requestClientOtp, clearRole, returnRole, cancelAddAccount, enterClientDemo, error, clearError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<Method>('password');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Adicionando uma segunda conta: voltar desiste e reabre a conta que já estava aberta.
  const backToRoles = () =>
    returnRole ? cancelAddAccount().then((ok) => ok && router.replace('/')) : clearRole().then(() => router.replace('/(auth)/role-select'));

  async function submit() {
    setLoading(true);
    setBlocked(false);
    try {
      if (method === 'otp') {
        await requestClientOtp(identifier.trim());
        router.push({ pathname: '/(auth)/client-otp', params: { identifier: identifier.trim() } } as never);
        return;
      }
      const outcome = await clientLogin(identifier.trim(), password);
      if (outcome === 'blocked') {
        setBlocked(true);
        return;
      }
      // Deixa o index.tsx/resolveAuthRoute decidir: shell direto se já tem
      // empresa ativa (1 vínculo), seletor se não (2+ vínculos).
      router.replace('/');
    } catch {
      /* erro já fica em `error` */
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      onBack={backToRoles}
      title={t('clientLogin.title')}
      subtitle={t('clientLogin.subtitle')}
      footer={
        <>
          <Button
            label={method === 'otp' ? t('clientLogin.sendCode') : t('shared.signIn')}
            icon="arrow-forward"
            loading={loading}
            disabled={!identifier.trim() || (method === 'password' && !password)}
            onPress={submit}
          />
          {ALLOW_MOCK ? (
            <Button
              label={t('clientLogin.demo')}
              variant="ghost"
              onPress={() => {
                enterClientDemo();
                router.replace('/');
              }}
            />
          ) : null}
          <Pressable onPress={backToRoles} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.switch}>
              {t('clientLogin.isTeam')} <Text style={styles.switchLink}>{t('clientLogin.signInAsTeam')}</Text>
            </Text>
          </Pressable>
        </>
      }
    >
      <Segmented
        options={[
          { key: 'password', label: t('clientLogin.withPassword') },
          { key: 'otp', label: t('clientLogin.bySms') },
        ]}
        value={method}
        onChange={(k) => setMethod(k as Method)}
      />
      <Field
        label={t('fields.emailOrPhone')}
        icon="mail-outline"
        value={identifier}
        autoCapitalize="none"
        autoComplete="email"
        onChangeText={(v) => {
          clearError();
          setBlocked(false);
          setIdentifier(v);
        }}
        placeholder={t('fields.emailOrPhonePlaceholder')}
      />
      {method === 'password' ? (
        <Field
          label={t('fields.password')}
          icon="lock-closed-outline"
          value={password}
          onChangeText={(v) => {
            clearError();
            setPassword(v);
          }}
          secureTextEntry
          autoComplete="password"
          placeholder={t('fields.passwordPlaceholder')}
        />
      ) : (
        <View style={styles.info}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.primaryDeep} />
          <Body style={styles.infoText}>{t('clientLogin.smsInfo')}</Body>
        </View>
      )}
      {blocked ? (
        <Body style={styles.error}>{t('shared.portalBlocked')}</Body>
      ) : error ? (
        <Body style={styles.error}>{error}</Body>
      ) : null}
      {method === 'password' ? <Muted style={styles.forgot}>{t('clientLogin.forgot')}</Muted> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  info: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radii.lg - 2,
    backgroundColor: colors.primarySoft,
  },
  infoText: { flex: 1, fontSize: 13.5, color: colors.primaryDeep, lineHeight: 20 },
  error: { color: colors.dangerText, fontSize: 13.5 },
  forgot: { textAlign: 'right' },
  switch: { textAlign: 'center', fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_400Regular' },
  switchLink: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
});
