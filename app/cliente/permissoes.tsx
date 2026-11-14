import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Display, IconName, IconTile, Muted, Rise, Screen } from '@/src/design-system/ui';
import { colors, spacing, text } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { markClientOnboardingSeen, openSystemSettings, PermissionKey, usePermissions } from '@/src/features/permissions/permissions';
import type { PermissionState } from '@/src/features/permissions/permissionState';
import { useProviders } from '@/src/features/fitness/connections';
import { providerDisplayName } from '@/src/features/fitness/brands';

function StatusAction({
  state,
  onRequest,
  grantLabel,
}: {
  state: PermissionState | undefined;
  onRequest: () => void;
  grantLabel: string;
}) {
  if (state === 'granted') return <Badge label="Ativado" tone="success" icon="checkmark" />;
  if (state === 'unavailable') return <Badge label="No app do celular" tone="neutral" />;
  if (state === 'blocked') return <Button label="Abrir ajustes" variant="soft" compact onPress={openSystemSettings} />;
  return <Button label={grantLabel} compact onPress={onRequest} />;
}

function PermissionCard({
  icon,
  title,
  body,
  action,
  index,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: React.ReactNode;
  index: number;
}) {
  return (
    <Rise index={index}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <IconTile icon={icon} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Muted style={styles.cardBody}>{body}</Muted>
          </View>
        </View>
        <View style={styles.cardAction}>{action}</View>
      </Card>
    </Rise>
  );
}

export default function ClientPermissionsScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const keys: PermissionKey[] = ['notifications', 'camera', 'photos'];
  const { states, request } = usePermissions(keys, mode === 'live');
  const { data: providers } = useProviders();
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
            body="Lembrete antes dos seus horários, resposta da equipe no chat e aviso quando o personal mudar seu treino."
            action={<StatusAction state={states.notifications} grantLabel="Ativar" onRequest={() => void request('notifications')} />}
          />
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
  card: { padding: 18, gap: 14 },
  cardTop: { flexDirection: 'row', gap: 14 },
  cardTitle: { ...text.section, color: colors.text },
  cardBody: { marginTop: 4, fontSize: 13.5, lineHeight: 19.5 },
  cardAction: { alignItems: 'flex-start', paddingLeft: 60 },
});
