import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { ALLOW_MOCK } from '@/src/shared/config';

type Method = 'password' | 'otp';

export default function ClientLoginScreen() {
  const insets = useSafeAreaInsets();
  const { clientLogin, requestClientOtp, clearRole, enterClientDemo, error, clearError } =
    useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<Method>('password');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function submit() {
    setLoading(true);
    setBlocked(false);
    try {
      if (method === 'otp') {
        await requestClientOtp(identifier.trim());
        router.push({
          pathname: '/(auth)/client-otp',
          params: { identifier: identifier.trim() },
        } as never);
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
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + spacing.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Field
            label="Telefone ou e-mail"
            value={identifier}
            onChangeText={(v) => {
              clearError();
              setBlocked(false);
              setIdentifier(v);
            }}
            placeholder="seu@email.com ou (11) 90000-0000"
          />

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setMethod('password')}
              style={[styles.toggle, method === 'password' && styles.toggleActive]}
            >
              <Body style={method === 'password' ? styles.toggleTextActive : styles.toggleText}>
                Senha
              </Body>
            </Pressable>
            <Pressable
              onPress={() => setMethod('otp')}
              style={[styles.toggle, method === 'otp' && styles.toggleActive]}
            >
              <Body style={method === 'otp' ? styles.toggleTextActive : styles.toggleText}>
                Receber código
              </Body>
            </Pressable>
          </View>

          {method === 'password' ? (
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
          ) : null}

          {blocked ? (
            <Body style={{ color: colors.danger, fontSize: 13 }}>
              Nenhuma das suas empresas tem o portal disponível. Fale com elas pra habilitar.
            </Body>
          ) : error ? (
            <Body style={{ color: colors.danger, fontSize: 13 }}>{error}</Body>
          ) : null}

          <Button
            label={loading ? 'Entrando…' : method === 'otp' ? 'Enviar código' : 'Entrar'}
            disabled={loading || !identifier.trim() || (method === 'password' && !password)}
            onPress={submit}
          />

          {ALLOW_MOCK ? (
            <Button
              label="Entrar direto (demo cliente)"
              variant="ghost"
              onPress={() => {
                enterClientDemo();
                router.replace('/');
              }}
            />
          ) : null}

          <Pressable onPress={() => clearRole().then(() => router.replace('/(auth)/role-select'))}>
            <Muted style={styles.switchRole}>Não é você? Entrar como equipe</Muted>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chromeNavy },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  form: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: colors.pageBg,
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
  switchRole: { textAlign: 'center', marginTop: spacing.sm },
});
