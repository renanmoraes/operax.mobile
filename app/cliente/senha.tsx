import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Field, HeroCard, IconTile, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, text } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { passwordProblemKey } from '@/src/features/auth/password';

/**
 * Criar ou trocar a senha do cliente. A senha é da pessoa no Operax, não da empresa: vale em todas
 * as empresas onde ela é cliente. Quem entrou por link da empresa (sem identidade) não cria aqui.
 */
export default function ClientPasswordScreen() {
  const { t } = useTranslation('auth');
  const insets = useSafeAreaInsets();
  const { user, changeClientPassword } = useAuth();
  const account = user?.kind === 'client' ? user.account : undefined;
  // Como estava ao abrir: depois de salvar, a conta já volta com senha e o título não deve trocar no meio.
  const [hasPassword] = useState(() => !!account?.hasPassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const rule = passwordProblemKey(next);
    if (rule) return setError(t(rule));
    if (next !== confirm) return setError(t('clientOtp.mismatch'));
    setSaving(true);
    setError(null);
    const problem = await changeClientPassword(next, hasPassword ? current : undefined);
    setSaving(false);
    if (problem) return setError(problem);
    await showDialog({ title: t(hasPassword ? 'password.changedTitle' : 'password.createdTitle'), message: t('password.doneBody'), tone: 'success', icon: 'key-outline' });
    router.back();
  }

  const title = t(hasPassword ? 'password.changeTitle' : 'password.createTitle');
  const clear = () => setError(null);

  return (
    <Screen>
      <TopBar safe title={title} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Rise>
            <HeroCard>
              <IconTile icon="key-outline" size={52} />
              <Text style={styles.title}>{title}</Text>
              <Muted style={styles.body}>{t('password.body')}</Muted>
            </HeroCard>
          </Rise>
          <Rise index={1}>
            {account && !account.hasIdentity ? (
              <Card>
                <Body style={styles.note}>{t('password.noIdentity')}</Body>
              </Card>
            ) : (
              <Card style={{ gap: 14 }}>
                {hasPassword ? (
                  <Field
                    label={t('password.current')}
                    icon="lock-closed-outline"
                    value={current}
                    onChangeText={(v) => {
                    clear();
                    setCurrent(v);
                  }}
                    secureTextEntry
                    autoComplete="current-password"
                  />
                ) : null}
                <Field
                  label={t('clientOtp.newPassword')}
                  icon="key-outline"
                  value={next}
                  onChangeText={(v) => {
                    clear();
                    setNext(v);
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder={t('clientOtp.passwordHint')}
                />
                <Field
                  label={t('clientOtp.repeatPassword')}
                  icon="lock-closed-outline"
                  value={confirm}
                  onChangeText={(v) => {
                    clear();
                    setConfirm(v);
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                />
                {error ? <Body style={styles.error}>{error}</Body> : <Muted style={styles.rules}>{t('password.rules')}</Muted>}
                <Button
                  label={t('password.save')}
                  icon="checkmark"
                  loading={saving}
                  disabled={!next || !confirm || (hasPassword && !current)}
                  onPress={() => void save()}
                />
              </Card>
            )}
          </Rise>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14, ...text.title, color: colors.text },
  body: { marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  note: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  error: { color: colors.dangerText, fontSize: 13.5 },
  rules: { fontSize: 13 },
});
