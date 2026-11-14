import { router } from 'expo-router';
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
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const keys: PermissionKey[] = ['notifications', 'location', 'camera', 'photos'];
  const { states, request } = usePermissions(keys, mode === 'live');
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
          <Display style={{ fontSize: 28, lineHeight: 33 }}>Deixe o app do seu jeito</Display>
        </Rise>
        <Rise index={1}>
          <Muted style={styles.sub}>Ative só o que fizer sentido para você. Dá para mudar depois no perfil.</Muted>
        </Rise>

        <View style={{ marginTop: 26, gap: 12 }}>
          <PermissionCard
            index={2}
            icon="notifications-outline"
            title="Notificações"
            body={caps.training ? 'Lembrete antes dos seus horários, resposta da equipe no chat e aviso quando o personal mudar seu treino.' : 'Lembrete antes dos seus horários e resposta da equipe no chat.'}
            action={<StatusAction state={states.notifications} grantLabel="Ativar" onRequest={() => void request('notifications')} />}
          />
          {caps.training ? (
            <PermissionCard
              index={3}
              icon="navigate-outline"
              title="Localização"
              body="Para gravar corrida e pedal com o GPS do celular: distância, ritmo, velocidade e altitude. Só é usada durante o treino."
              action={<StatusAction state={states.location} grantLabel="Permitir" onRequest={() => void request('location')} />}
            />
          ) : null}
          {showWatch ? (
          <PermissionCard
            index={3}
            icon="watch-outline"
            title="Relógio e apps de treino"
            body="Conecte Garmin Connect™, Strava ou Polar e seus treinos chegam sozinhos, com tempo, distância e batimentos."
            action={
              connected.length ? (
                <Button label={`${connected.join(', ')} conectado`} variant="soft" compact icon="checkmark" onPress={() => router.push('/cliente/relogios')} />
              ) : (
                <Button label="Conectar" compact onPress={() => router.push('/cliente/relogios')} />
              )
            }
          />
          ) : null}
          {showMedia ? (
          <PermissionCard
            index={4}
            icon="camera-outline"
            title="Câmera e fotos"
            body="Para mandar fotos, vídeos e documentos no chat e registrar suas fotos de evolução."
            action={
              <StatusAction
                state={mediaState}
                grantLabel="Permitir"
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
          <Button label="Continuar" icon="arrow-forward" onPress={finish} />
          <Button label="Agora não" variant="ghost" onPress={finish} />
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  sub: { marginTop: 10, fontSize: 15, lineHeight: 22 },
});
