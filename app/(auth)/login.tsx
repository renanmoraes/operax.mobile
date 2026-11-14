import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { ALLOW_MOCK, API_URL } from '@/src/shared/config';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, enterDemo, error, clearError, clearRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('OPRX');
  const [loading, setLoading] = useState(false);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + spacing.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Image source={require('../../assets/brand/operax-mark.png')} style={styles.mark} contentFit="contain" />
          <Image source={require('../../assets/brand/operax-logo-full.png')} style={styles.logo} contentFit="contain" />
          {__DEV__ ? <Muted style={styles.dev}>API {API_URL}</Muted> : null}
        </View>

        <View style={styles.form}>
          <Field
            label="Código da empresa"
            value={companyCode}
            onChangeText={(v) => setCompanyCode(v.toUpperCase())}
            placeholder="Ex.: OPRX"
          />
          <Field
            label="E-mail"
            value={email}
            onChangeText={(v) => {
              clearError();
              setEmail(v);
            }}
            keyboardType="email-address"
            placeholder="seu@email.com"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={(v) => {
              clearError();
              setPassword(v);
            }}
            secureTextEntry
            placeholder="Sua senha"
          />

          <Muted style={styles.notice}>
            Ao entrar neste aparelho, a sessão no computador será encerrada.
          </Muted>

          {error ? <Body style={{ color: colors.danger, fontSize: 13 }}>{error}</Body> : null}

          <Button
            label={loading ? 'Entrando…' : 'Entrar'}
            disabled={loading}
            onPress={async () => {
              setLoading(true);
              try {
                const next = await login(email.trim(), password, companyCode.trim());
                router.replace(next === 'mfa' ? '/(auth)/mfa' : '/(app)/inbox');
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
                router.replace('/(app)/inbox');
              }}
            />
          ) : null}

          <Pressable onPress={() => clearRole().then(() => router.replace('/(auth)/role-select'))}>
            <Muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
              Não é você? Entrar como cliente
            </Muted>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.chromeNavy,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.xxl,
  },
  brand: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  mark: { width: 72, height: 72 },
  logo: { width: 180, height: 40 },
  dev: { color: '#9aa8bd', textAlign: 'center' },
  form: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
  notice: {
    color: colors.textMuted,
    lineHeight: 18,
  },
});
