import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Field, HeroCard, IconTile, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, text } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { portalEmailLinkRequest, portalEmailLinkVerify } from '@/src/shared/api/portal.api';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serverMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  const msg = res?.data?.message;
  // Frase do servidor só para erro do cliente (4xx): "já tem e-mail", "código vencido", "use outro e-mail".
  if (res?.status && res.status < 500 && typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

/**
 * Liga um e-mail à conta da pessoa. O código vai para o e-mail novo: quem não lê aquela caixa não confirma.
 * Depois disso o e-mail entra em todas as empresas da conta, com a mesma senha.
 */
export default function ClientEmailScreen() {
  const { t } = useTranslation('auth');
  const insets = useSafeAreaInsets();
  const { user, refreshClientUser } = useAuth();
  const account = user?.kind === 'client' ? user.account : undefined;
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; sentTo: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!EMAIL_RE.test(email)) return setError(t('email.invalid'));
    setBusy(true);
    setError(null);
    try {
      const r = await portalEmailLinkRequest(email);
      setChallenge({ id: r.challenge_id, sentTo: r.sent_to });
      setCode('');
    } catch (err) {
      setError(serverMessage(err, t('errors.sendCode')));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await portalEmailLinkVerify(challenge.id, code.trim());
      await refreshClientUser();
      await showDialog({ title: t('email.doneTitle'), message: t('email.doneBody'), tone: 'success', icon: 'mail-outline' });
      router.back();
    } catch (err) {
      setError(serverMessage(err, t('errors.invalidOtp')));
    } finally {
      setBusy(false);
    }
  }

  const noIdentity = !!account && !account.hasIdentity;

  return (
    <Screen>
      <TopBar safe title={t('email.addTitle')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Rise>
            <HeroCard>
              <IconTile icon="mail-outline" size={52} />
              <Text style={styles.title}>{t('email.addTitle')}</Text>
              <Muted style={styles.body}>{t('email.body')}</Muted>
            </HeroCard>
          </Rise>
          <Rise index={1}>
            {noIdentity ? (
              <Card>
                <Body style={styles.note}>{t('email.noIdentity')}</Body>
              </Card>
            ) : challenge ? (
              <Card style={{ gap: 14 }}>
                <Body style={styles.note}>{t('email.codeInfo', { target: challenge.sentTo })}</Body>
                <Field
                  label={t('fields.code')}
                  icon="keypad-outline"
                  value={code}
                  onChangeText={(v) => {
                    setError(null);
                    setCode(v.replace(/\D/g, '').slice(0, 6));
                  }}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  placeholder="000000"
                />
                {error ? <Body style={styles.error}>{error}</Body> : null}
                <Button label={t('email.confirm')} icon="checkmark" loading={busy} disabled={code.length !== 6} onPress={() => void confirm()} />
                <Button
                  label={t('email.other')}
                  variant="ghost"
                  onPress={() => {
                    setChallenge(null);
                    setError(null);
                  }}
                />
              </Card>
            ) : (
              <Card style={{ gap: 14 }}>
                <Field
                  label={t('email.label')}
                  icon="mail-outline"
                  value={email}
                  onChangeText={(v) => {
                    setError(null);
                    // E-mail não tem maiúscula nem espaço: o teclado do celular costuma pôr a primeira letra em maiúscula.
                    setEmail(v.toLowerCase().replace(/\s/g, ''));
                  }}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder={t('fields.workEmailPlaceholder')}
                />
                {error ? <Body style={styles.error}>{error}</Body> : null}
                <Button label={t('email.send')} icon="arrow-forward" loading={busy} disabled={!email} onPress={() => void send()} />
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
});
