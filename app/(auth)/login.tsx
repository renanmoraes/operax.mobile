import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Body, Button, Field, Muted } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';
import { ALLOW_MOCK, API_URL } from '@/src/shared/config';

export default function LoginScreen() {
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
      tag={returnRole ? "Nova conta · Equipe" : "Equipe"}
      showLogo
      title="Bom trabalho hoje"
      subtitle="Entre com o acesso que a sua empresa liberou para você."
      footer={
        <>
          <Muted style={styles.notice}>Ao entrar neste aparelho, a sessão no computador é encerrada.</Muted>
          <Button
            label="Entrar"
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
              label="Entrar direto (demo)"
              variant="ghost"
              onPress={() => {
                enterDemo();
                router.replace('/');
              }}
            />
          ) : null}
          <Pressable onPress={backToRoles} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.switch}>
              É cliente? <Text style={styles.switchLink}>Entrar como cliente</Text>
            </Text>
          </Pressable>
          {__DEV__ ? <Muted style={{ textAlign: 'center', fontSize: 11 }}>API {API_URL}</Muted> : null}
        </>
      }
    >
      <Field
        label="Código da empresa"
        icon="business-outline"
        value={companyCode}
        autoCapitalize="none"
        onChangeText={(v) => setCompanyCode(v.toUpperCase())}
        placeholder="Ex.: OPRX"
      />
      <Field
        label="E-mail de trabalho"
        icon="mail-outline"
        value={email}
        autoCapitalize="none"
        autoComplete="email"
        onChangeText={(v) => {
          clearError();
          setEmail(v);
        }}
        keyboardType="email-address"
        placeholder="seu@empresa.com"
      />
      <Field
        label="Senha"
        icon="lock-closed-outline"
        value={password}
        autoComplete="password"
        onChangeText={(v) => {
          clearError();
          setPassword(v);
        }}
        secureTextEntry
        placeholder="Sua senha"
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
