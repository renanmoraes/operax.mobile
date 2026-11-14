import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Body, Button, Card, Muted, Screen, Title } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import {
  defaultNotificationPrefs,
  PUSH_CATEGORIES,
  PushCategoryId,
  NotificationPrefsState,
} from '@/src/features/notifications/catalog';
import { useAuth } from '@/src/features/auth/AuthContext';
import { updateNotificationPrefs } from '@/src/shared/api/profile.api';

export default function NotificationPrefsScreen() {
  const { mode, user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefsState>(defaultNotificationPrefs);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const remote = (user?.kind === 'staff' ? user.notification_prefs : undefined) as
      | Partial<NotificationPrefsState>
      | undefined;
    if (!remote) return;
    setPrefs((prev) => ({
      ...prev,
      sound: remote.sound ?? prev.sound,
      push: remote.push ?? prev.push,
      desktop: remote.desktop ?? prev.desktop,
      email_digest: remote.email_digest ?? prev.email_digest,
      categories: { ...prev.categories, ...(remote.categories as Record<PushCategoryId, boolean>) },
    }));
  }, [user]);

  const saveMut = useMutation({
    mutationFn: () => updateNotificationPrefs(prefs, user?.name || 'Usuário'),
    onSuccess: () => {
      setSaved('Preferências salvas');
      setTimeout(() => setSaved(null), 2000);
    },
    onError: () => setSaved('Falha ao salvar'),
  });

  const setCategory = (id: PushCategoryId, value: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      categories: { ...prev.categories, [id]: value },
    }));
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Title>Notificações push</Title>
          <Muted>Por padrão tudo fica ligado — inclusive com o telefone bloqueado.</Muted>
          {saved ? <Muted>{saved}</Muted> : null}
        </View>

        <Card style={{ gap: spacing.md }}>
          <Row
            label="Push no aparelho"
            hint="Master"
            value={prefs.push}
            onChange={(v) => setPrefs((p) => ({ ...p, push: v }))}
          />
          <Row
            label="Som no app"
            hint="App aberto"
            value={prefs.sound}
            onChange={(v) => setPrefs((p) => ({ ...p, sound: v }))}
          />
        </Card>

        <Body style={styles.section}>Categorias</Body>
        <Card style={{ gap: spacing.lg }}>
          {PUSH_CATEGORIES.map((cat) => (
            <Row
              key={cat.id}
              label={cat.label}
              hint={cat.description}
              value={prefs.categories[cat.id]}
              onChange={(v) => setCategory(cat.id, v)}
              disabled={!prefs.push}
            />
          ))}
        </Card>

        {mode === 'live' ? (
          <Button
            label={saveMut.isPending ? 'Salvando…' : 'Salvar na API'}
            onPress={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          />
        ) : (
          <Muted>Modo mock — preferências só locais.</Muted>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={{ flex: 1, paddingRight: spacing.md, gap: 2 }}>
        <Body style={styles.label}>{label}</Body>
        <Muted>{hint}</Muted>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: typography.fontFamilySemiBold, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontFamily: typography.fontFamilyMedium },
});
