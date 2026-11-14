import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Field, Muted, Segmented } from '@/src/design-system/ui';
import { colors, radii } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';
import { ALLOW_MOCK } from '@/src/shared/config';

type Method = 'password' | 'otp';

export default function ClientLoginScreen() {
  const { clientLogin, requestClientOtp, clearRole, enterClientDemo, error, clearError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<Method>('password');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const backToRoles = () => clearRole().then(() => router.replace('/(auth)/role-select'));

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
      title="Que bom te ver por aqui"
      subtitle="Entre com o e-mail ou celular que você usa na empresa."
      footer={
        <>
          <Button
            label={method === 'otp' ? 'Enviar código' : 'Entrar'}
            icon="arrow-forward"
            loading={loading}
            disabled={!identifier.trim() || (method === 'password' && !password)}
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
          <Pressable onPress={backToRoles} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.switch}>
              É da equipe? <Text style={styles.switchLink}>Entrar como equipe</Text>
            </Text>
          </Pressable>
        </>
      }
    >
      <Segmented
        options={[
          { key: 'password', label: 'Com senha' },
          { key: 'otp', label: 'Código por SMS' },
        ]}
        value={method}
        onChange={(k) => setMethod(k as Method)}
      />
      <Field
        label="E-mail ou celular"
        icon="mail-outline"
        value={identifier}
        autoCapitalize="none"
        autoComplete="email"
        onChangeText={(v) => {
          clearError();
          setBlocked(false);
          setIdentifier(v);
        }}
        placeholder="seu@email.com ou (11) 90000-0000"
      />
      {method === 'password' ? (
        <Field
          label="Senha"
          icon="lock-closed-outline"
          value={password}
          onChangeText={(v) => {
            clearError();
            setPassword(v);
          }}
          secureTextEntry
          autoComplete="password"
          placeholder="Sua senha"
        />
      ) : (
        <View style={styles.info}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.primaryDeep} />
          <Body style={styles.infoText}>Mandamos um código de 6 dígitos para o seu celular. Sem senha para lembrar.</Body>
        </View>
      )}
      {blocked ? (
        <Body style={styles.error}>Nenhuma das suas empresas tem o portal disponível. Fale com elas para habilitar.</Body>
      ) : error ? (
        <Body style={styles.error}>{error}</Body>
      ) : null}
      {method === 'password' ? <Muted style={styles.forgot}>Esqueceu a senha? Use o código por SMS.</Muted> : null}
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
