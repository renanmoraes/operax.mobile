import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { openSystemSettings, pushTargetFor, usePermissions } from '@/src/features/permissions/permissions';
import { StatusAction } from '@/src/features/permissions/PermissionCard';
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
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { mode, user } = useAuth();
  const { states, request } = usePermissions(['notifications', 'camera', 'photos', 'microphone'], pushTargetFor(mode, user?.kind));
  const permission = states.notifications;
  const media =
    states.camera === 'granted' && states.photos === 'granted' ? 'granted' : states.camera === 'blocked' || states.photos === 'blocked' ? 'blocked' : states.camera === 'unavailable' ? 'unavailable' : states.camera;
  // Começa com o que já veio do servidor junto com o usuário (sem efeito para copiar depois).
  const [prefs, setPrefs] = useState<NotificationPrefsState>(() => {
    const remote = (user?.kind === 'staff' ? user.notification_prefs : undefined) as Partial<NotificationPrefsState> | undefined;
    const prev = defaultNotificationPrefs();
    if (!remote) return prev;
    return {
      ...prev,
      sound: remote.sound ?? prev.sound,
      push: remote.push ?? prev.push,
      desktop: remote.desktop ?? prev.desktop,
      email_digest: remote.email_digest ?? prev.email_digest,
      categories: { ...prev.categories, ...(remote.categories as Record<PushCategoryId, boolean>) },
    };
  });
  const [saved, setSaved] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => updateNotificationPrefs(prefs, user?.name || t('common.user')),
    onSuccess: () => {
      setSaved(t('prefs.saved'));
      setTimeout(() => setSaved(null), 2000);
    },
    onError: () => setSaved(t('prefs.saveFailed')),
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
        <ScreenHeader title={t('prefs.title')} subtitle={t('prefs.subtitle')} onBack={() => router.back()} />
        <View style={{ paddingHorizontal: 20 }}>
          <Rise>
            <SettingsGroup>
              <SettingsRow
                icon="phone-portrait-outline"
                title={t('prefs.devicePermission')}
                subtitle={
                  permission === 'granted'
                    ? t('prefs.permission.granted')
                    : permission === 'blocked'
                      ? t('prefs.permission.blocked')
                      : permission === 'unavailable'
                        ? t('prefs.permission.unavailable')
                        : t('prefs.permission.notYet')
                }
                subtitleTone={permission === 'granted' ? 'success' : permission === 'blocked' ? 'warn' : undefined}
                right={
                  permission === 'granted' || permission === 'unavailable' ? (
                    <View />
                  ) : permission === 'blocked' ? (
                    <Button label={t('prefs.settings')} variant="soft" compact onPress={openSystemSettings} />
                  ) : (
                    <Button label={t('prefs.enable')} compact onPress={() => void request('notifications')} />
                  )
                }
              />
              <SettingsRow
                icon="notifications-outline"
                title={t('prefs.push.title')}
                subtitle={t('prefs.push.subtitle')}
                right={toggle(prefs.push, (v) => setPrefs((p) => ({ ...p, push: v })), t('prefs.push.title'))}
              />
              <SettingsRow
                icon="volume-medium-outline"
                title={t('prefs.sound.title')}
                subtitle={t('prefs.sound.subtitle')}
                right={toggle(prefs.sound, (v) => setPrefs((p) => ({ ...p, sound: v })), t('prefs.sound.title'))}
                last
              />
            </SettingsGroup>
          </Rise>

          <Muted style={styles.groupLabel}>{t('prefs.privacy')}</Muted>
          <Rise index={1}>
            <SettingsGroup>
              <SettingsRow
                icon="camera-outline"
                title={t('permissions.camera.title')}
                subtitle={t('permissions.camera.body')}
                right={<StatusAction state={media} grantLabel={t('permissions.allow')} onRequest={() => void request('camera').then(() => request('photos'))} />}
              />
              <SettingsRow
                icon="mic-outline"
                title={t('permissions.microphone.title')}
                subtitle={t('permissions.microphone.body')}
                right={<StatusAction state={states.microphone} grantLabel={t('permissions.allow')} onRequest={() => void request('microphone')} />}
                last
              />
            </SettingsGroup>
          </Rise>

          <Muted style={styles.groupLabel}>{t('prefs.categories')}</Muted>
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
                <Badge label={saved} tone={saved === t('prefs.saveFailed') ? 'danger' : 'success'} />
              </View>
            ) : null}
            {mode === 'live' ? (
              <Button label={t('prefs.savePrefs')} loading={saveMut.isPending} onPress={() => saveMut.mutate()} disabled={saveMut.isPending} />
            ) : (
              <Muted style={{ textAlign: 'center' }}>{t('prefs.demoNote')}</Muted>
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
