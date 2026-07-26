import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Button, Card, Muted, Screen, Title } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';
import { API_URL } from '@/src/shared/config';

export default function ProfileScreen() {
  const { logout, user, mode } = useAuth();
  const [pushStatus, setPushStatus] = useState('Verificando…');

  useEffect(() => {
    let alive = true;
    registerForPushNotificationsAsync().then((result) => {
      if (!alive) return;
      if (result.status === 'granted') setPushStatus('Permissão OK — token obtido');
      else if (result.status === 'denied') setPushStatus('Permissão negada no aparelho');
      else setPushStatus(`Indisponível: ${result.reason}`);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen style={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={{ gap: spacing.xs }}>
        <Title>{user?.name || 'Usuário'}</Title>
        <Muted>{user?.email}</Muted>
        <Body style={styles.meta}>
          {mode === 'live' ? 'Online' : 'Mock'} · {user?.role_code || '—'}
        </Body>
        <Muted>API {API_URL}</Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Body style={styles.section}>Push</Body>
        <Muted>{pushStatus}</Muted>
      </Card>

      <Card style={{ gap: spacing.sm, padding: 0 }}>
        <LinkRow label="Preferências de notificação" onPress={() => router.push('/notification-prefs')} />
        <LinkRow label="Respostas rápidas" onPress={() => router.push('/quick-replies')} />
        <LinkRow label="Templates Meta" onPress={() => router.push('/templates')} />
      </Card>

      <Button
        label="Sair"
        variant="danger"
        onPress={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      />
    </Screen>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Body>{label}</Body>
      <Muted>›</Muted>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meta: { marginTop: 4, fontFamily: typography.fontFamilyMedium },
  section: { fontFamily: typography.fontFamilySemiBold },
  link: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
