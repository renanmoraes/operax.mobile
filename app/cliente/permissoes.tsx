import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Display, Muted, Rise, Screen } from '@/src/design-system/ui';
import { PermissionCard, StatusAction } from '@/src/features/permissions/PermissionCard';
import { spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { markClientOnboardingSeen, PermissionKey, usePermissions } from '@/src/features/permissions/permissions';
import type { PermissionState } from '@/src/features/permissions/permissionState';
import { useProviders } from '@/src/features/fitness/connections';
import { providerDisplayName } from '@/src/features/fitness/brands';
import { useClientCapabilities } from '@/src/features/client/useClientData';

export default function ClientPermissionsScreen() {
  const { t } = useTranslation(['client', 'common']);
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const keys: PermissionKey[] = ['notifications', 'location', 'camera', 'photos'];
  const { states, request } = usePermissions(keys, false); // cliente: só a permissão do sistema (o portal não registra aparelho)
  const caps = useClientCapabilities();
  const { data: providers } = useProviders();
  // Relógio só com treino liberado; câmera serve ao treino (fotos de evolução) e ao chat com anexos (só no demo por enquanto).
  const showWatch = caps.training;
  const showMedia = caps.training || (mode !== 'live' && caps.chat);
  const connected = providers?.filter((p) => p.connected).map((p) => providerDisplayName(p.id, p.label)) ?? [];

  const finish = async () => {
    await markClientOnboardingSeen();
    router.replace('/(client)/inicio');
  };

  const mediaState: PermissionState | undefined =
    states.camera === 'granted' && states.photos === 'granted'
      ? 'granted'
      : states.camera === 'blocked' || states.photos === 'blocked'
        ? 'blocked'
        : states.camera === 'unavailable'
          ? 'unavailable'
          : states.camera;

  return (
    <Screen backdrop="mirror">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + spacing.xl }]}>
        <Rise>
          <Display style={{ fontSize: 28, lineHeight: 33 }}>{t('onboarding.title')}</Display>
        </Rise>
        <Rise index={1}>
          <Muted style={styles.sub}>{t('onboarding.subtitle')}</Muted>
        </Rise>

        <View style={{ marginTop: 26, gap: 12 }}>
          <PermissionCard
            index={2}
            icon="notifications-outline"
            title={t('onboarding.notifications.title')}
            body={caps.training ? t('onboarding.notifications.bodyTraining') : t('onboarding.notifications.body')}
            action={<StatusAction state={states.notifications} grantLabel={t('onboarding.enable')} onRequest={() => void request('notifications')} />}
          />
          {caps.training ? (
            <PermissionCard
              index={3}
              icon="navigate-outline"
              title={t('onboarding.location.title')}
              body={t('onboarding.location.body')}
              action={<StatusAction state={states.location} grantLabel={t('onboarding.allow')} onRequest={() => void request('location')} />}
            />
          ) : null}
          {showWatch ? (
          <PermissionCard
            index={3}
            icon="watch-outline"
            title={t('onboarding.watch.title')}
            body={t('onboarding.watch.body')}
            action={
              connected.length ? (
                <Button label={t('onboarding.watch.connected', { names: connected.join(', ') })} variant="soft" compact icon="checkmark" onPress={() => router.push('/cliente/relogios')} />
              ) : (
                <Button label={t('onboarding.watch.connect')} compact onPress={() => router.push('/cliente/relogios')} />
              )
            }
          />
          ) : null}
          {showMedia ? (
          <PermissionCard
            index={4}
            icon="camera-outline"
            title={t('onboarding.media.title')}
            body={t('onboarding.media.body')}
            action={
              <StatusAction
                state={mediaState}
                grantLabel={t('onboarding.allow')}
                onRequest={async () => {
                  await request('camera');
                  await request('photos');
                }}
              />
            }
          />
          ) : null}
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />
        <Rise index={5} style={{ gap: 10 }}>
          <Button label={t('common:actions.continue')} icon="arrow-forward" onPress={finish} />
          <Button label={t('onboarding.notNow')} variant="ghost" onPress={finish} />
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  sub: { marginTop: 10, fontSize: 15, lineHeight: 22 },
});
