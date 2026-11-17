import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Display, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { PermissionCard, StatusAction } from '@/src/features/permissions/PermissionCard';
import { spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { markClientOnboardingSeen, PermissionKey, pushTargetFor, usePermissions } from '@/src/features/permissions/permissions';
import type { PermissionState } from '@/src/features/permissions/permissionState';
import { useProviders } from '@/src/features/fitness/connections';
import { providerDisplayName } from '@/src/features/fitness/brands';
import { useClientCapabilities } from '@/src/features/client/useClientData';

export default function ClientPermissionsScreen() {
  const { t } = useTranslation(['client', 'common']);
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const { inicio } = useLocalSearchParams<{ inicio?: string }>();
  // Primeira entrada: apresentação com Continuar. Vindo do Perfil: só os ajustes, com voltar.
  const onboarding = inicio === '1';
  const keys: PermissionKey[] = ['notifications', 'location', 'camera', 'photos'];
  const { states, request } = usePermissions(keys, pushTargetFor(mode, 'client')); // aluno com login real: o aparelho recebe push do portal
  const caps = useClientCapabilities();
  const { data: providers } = useProviders(caps.training);
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
      {onboarding ? null : <TopBar safe title={t('profile.notifPrivacy')} onBack={() => router.back()} />}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: onboarding ? insets.top + 40 : 8, paddingBottom: insets.bottom + spacing.xl }]}>
        {onboarding ? (
          <>
            <Rise>
              <Display style={{ fontSize: 28, lineHeight: 33 }}>{t('onboarding.title')}</Display>
            </Rise>
            <Rise index={1}>
              <Muted style={styles.sub}>{t('onboarding.subtitle')}</Muted>
            </Rise>
          </>
        ) : null}

        <View style={{ marginTop: onboarding ? 26 : 12, gap: 12 }}>
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
            onPress={() => router.push('/cliente/relogios')}
            action={
              connected.length ? (
                <Button label={t('onboarding.watch.connected', { count: connected.length })} variant="soft" compact icon="checkmark" onPress={() => router.push('/cliente/relogios')} />
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

        {onboarding ? (
          <>
            <View style={{ flex: 1, minHeight: 24 }} />
            <Rise index={5} style={{ gap: 10 }}>
              <Button label={t('common:actions.continue')} icon="arrow-forward" onPress={finish} />
              <Button label={t('onboarding.notNow')} variant="ghost" onPress={finish} />
            </Rise>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  sub: { marginTop: 10, fontSize: 15, lineHeight: 22 },
});
