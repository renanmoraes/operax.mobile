import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Body, Button, Field, Muted } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';
import { ALLOW_MOCK, API_URL } from '@/src/shared/config';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { login, enterDemo, error, clearError, clearRole, returnRole, cancelAddAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('OPRX');
  const [loading, setLoading] = useState(false);

  // Adicionando uma segunda conta: voltar desiste e reabre a conta que já estava aberta.
  const backToRoles = () =>
    returnRole ? cancelAddAccount().then((ok) => ok && router.replace('/')) : clearRole().then(() => router.replace('/(auth)/role-select'));

  return (
    <AuthShell
      onBack={backToRoles}
      tag={returnRole ? t('login.newAccountTag') : t('shared.team')}
      showLogo
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <>
          <Muted style={styles.notice}>{t('login.notice')}</Muted>
          <Button
            label={t('shared.signIn')}
            icon="arrow-forward"
            loading={loading}
            onPress={async () => {
              setLoading(true);
              try {
                const next = await login(email.trim(), password, companyCode.trim());
                router.replace(next === 'mfa' ? '/(auth)/mfa' : '/');
              } catch {
                /* error state */
              } finally {
                setLoading(false);
              }
            }}
          />
          {ALLOW_MOCK ? (
            <Button
              label={t('login.demo')}
              variant="ghost"
              onPress={() => {
                enterDemo();
                router.replace('/');
              }}
            />
          ) : null}
          <Pressable onPress={backToRoles} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.switch}>
              {t('login.isClient')} <Text style={styles.switchLink}>{t('login.signInAsClient')}</Text>
            </Text>
          </Pressable>
          {__DEV__ ? <Muted style={{ textAlign: 'center', fontSize: 11 }}>API {API_URL}</Muted> : null}
        </>
      }
    >
      <Field
        label={t('fields.companyCode')}
        icon="business-outline"
        value={companyCode}
        autoCapitalize="none"
        onChangeText={(v) => setCompanyCode(v.toUpperCase())}
        placeholder={t('fields.companyCodePlaceholder')}
      />
      <Field
        label={t('fields.workEmail')}
        icon="mail-outline"
        value={email}
        autoCapitalize="none"
        autoComplete="email"
        onChangeText={(v) => {
          clearError();
          // E-mail não tem maiúscula nem espaço: o teclado do celular costuma pôr a primeira letra em maiúscula.
          setEmail(v.toLowerCase().replace(/\s/g, ''));
        }}
        keyboardType="email-address"
        placeholder={t('fields.workEmailPlaceholder')}
      />
      <Field
        label={t('fields.password')}
        icon="lock-closed-outline"
        value={password}
        autoComplete="password"
        onChangeText={(v) => {
          clearError();
          setPassword(v);
        }}
        secureTextEntry
        placeholder={t('fields.passwordPlaceholder')}
      />
      {error ? <Body style={styles.error}>{error}</Body> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  notice: { textAlign: 'center', lineHeight: 18 },
  error: { color: colors.dangerText, fontSize: 13.5 },
  switch: { textAlign: 'center', fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_400Regular' },
  switchLink: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
});
