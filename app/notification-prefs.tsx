import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, IconName, Muted, Rise, Screen, ScreenHeader, SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import {
  defaultNotificationPrefs,
  PUSH_CATEGORIES,
  PushCategoryId,
  NotificationPrefsState,
} from '@/src/features/notifications/catalog';
import { useAuth } from '@/src/features/auth/AuthContext';
import { openSystemSettings, usePermissions } from '@/src/features/permissions/permissions';
import { updateNotificationPrefs } from '@/src/shared/api/profile.api';

const CATEGORY_ICONS: Record<PushCategoryId, IconName> = {
  queue_new: 'people-outline',
  claimed_message: 'chatbubble-ellipses-outline',
  ownership_expiring: 'hourglass-outline',
  assignment_expired: 'alert-circle-outline',
  chat_message: 'chatbubbles-outline',
  chat_mention: 'at-outline',
  booking_new: 'calendar-outline',
  booking_reschedule: 'swap-horizontal-outline',
  reminder: 'alarm-outline',
  transfer: 'arrow-redo-outline',
  urgency: 'flame-outline',
  kanban_followup: 'grid-outline',
};

export default function NotificationPrefsScreen() {
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const { states, request } = usePermissions(['notifications'], mode === 'live');
  const permission = states.notifications;
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

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string, disabled?: boolean) => (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ true: colors.primary, false: colors.track }}
      thumbColor="#fff"
      // react-native-web pinta o polegar ligado de verde-água sem esta prop
      {...({ activeThumbColor: '#fff' } as object)}
    />
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}>
        <ScreenHeader title="Notificações" subtitle="Tudo ligado por padrão, inclusive com a tela bloqueada" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: 20 }}>
          <Rise>
            <SettingsGroup>
              <SettingsRow
                icon="phone-portrait-outline"
                title="Permissão do celular"
                subtitle={
                  permission === 'granted'
                    ? 'Ativada'
                    : permission === 'blocked'
                      ? 'Bloqueada nos ajustes'
                      : permission === 'unavailable'
                        ? 'Disponível no app do celular'
                        : 'Ainda não ativada'
                }
                subtitleTone={permission === 'granted' ? 'success' : permission === 'blocked' ? 'warn' : undefined}
                right={
                  permission === 'granted' || permission === 'unavailable' ? (
                    <View />
                  ) : permission === 'blocked' ? (
                    <Button label="Ajustes" variant="soft" compact onPress={openSystemSettings} />
                  ) : (
                    <Button label="Ativar" compact onPress={() => void request('notifications')} />
                  )
                }
              />
              <SettingsRow
                icon="notifications-outline"
                title="Push no aparelho"
                subtitle="Liga ou desliga todas as categorias"
                right={toggle(prefs.push, (v) => setPrefs((p) => ({ ...p, push: v })), 'Push no aparelho')}
              />
              <SettingsRow
                icon="volume-medium-outline"
                title="Som no app"
                subtitle="Quando o app estiver aberto"
                right={toggle(prefs.sound, (v) => setPrefs((p) => ({ ...p, sound: v })), 'Som no app')}
                last
              />
            </SettingsGroup>
          </Rise>

          <Muted style={styles.groupLabel}>Categorias</Muted>
          <Rise index={1}>
            <View style={!prefs.push && { opacity: 0.5 }}>
              <SettingsGroup>
                {PUSH_CATEGORIES.map((cat, i) => (
                  <SettingsRow
                    key={cat.id}
                    icon={CATEGORY_ICONS[cat.id] ?? 'notifications-outline'}
                    title={cat.label}
                    subtitle={cat.description}
                    right={toggle(prefs.categories[cat.id], (v) => setCategory(cat.id, v), cat.label, !prefs.push)}
                    last={i === PUSH_CATEGORIES.length - 1}
                  />
                ))}
              </SettingsGroup>
            </View>
          </Rise>

          <View style={{ marginTop: 18, gap: 10 }}>
            {saved ? (
              <View style={{ alignSelf: 'center' }}>
                <Badge label={saved} tone={saved.startsWith('Falha') ? 'danger' : 'success'} />
              </View>
            ) : null}
            {mode === 'live' ? (
              <Button label="Salvar preferências" loading={saveMut.isPending} onPress={() => saveMut.mutate()} disabled={saveMut.isPending} />
            ) : (
              <Muted style={{ textAlign: 'center' }}>No modo demonstração as preferências ficam só neste aparelho.</Muted>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupLabel: { marginTop: 22, marginBottom: 10, fontFamily: typography.fontFamilySemiBold },
});
