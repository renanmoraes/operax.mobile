import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Display, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { PermissionCard, StatusAction } from '@/src/features/permissions/PermissionCard';
import { markStaffOnboardingSeen, type PermissionKey, usePermissions } from '@/src/features/permissions/permissions';
import type { PermissionState } from '@/src/features/permissions/permissionState';

/**
 * Permissões do aparelho da equipe. Aparece na primeira entrada (`?inicio=1`) e fica no Perfil:
 * quem negou antes volta aqui e libera (ou abre os ajustes do sistema).
 */
export default function StaffPermissionsScreen() {
  const insets = useSafeAreaInsets();
  const { inicio } = useLocalSearchParams<{ inicio?: string }>();
  const onboarding = inicio === '1';
  const { mode } = useAuth();
  const keys: PermissionKey[] = ['notifications', 'camera', 'photos', 'microphone'];
  const { states, request } = usePermissions(keys, mode === 'live');

  const media: PermissionState | undefined =
    states.camera === 'granted' && states.photos === 'granted' ? 'granted' : states.camera === 'blocked' || states.photos === 'blocked' ? 'blocked' : states.camera === 'unavailable' ? 'unavailable' : states.camera;

  const finish = async () => {
    await markStaffOnboardingSeen();
    router.replace('/');
  };

  return (
    <Screen backdrop="mirror">
      {onboarding ? null : <TopBar safe title="Permissões do aparelho" onBack={() => router.back()} />}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: onboarding ? insets.top + 40 : 8, paddingBottom: insets.bottom + spacing.xl }]}>
        {onboarding ? (
          <>
            <Rise>
              <Display style={{ fontSize: 28, lineHeight: 33 }}>Deixe o app pronto para o atendimento</Display>
            </Rise>
            <Rise index={1}>
              <Muted style={styles.sub}>Libere o que for usar. Dá para mudar depois em Perfil › Permissões do aparelho.</Muted>
            </Rise>
          </>
        ) : (
          <Muted style={styles.sub}>Se você negou alguma permissão, libere aqui ou nos ajustes do celular.</Muted>
        )}
        <View style={{ marginTop: 22, gap: 12 }}>
          <PermissionCard
            index={2}
            icon="notifications-outline"
            title="Notificações"
            body="Mensagem nova de cliente, atendimento transferido para você, chat da equipe, agenda e avisos do Operax."
            action={<StatusAction state={states.notifications} grantLabel="Ativar" onRequest={() => void request('notifications')} />}
          />
          <PermissionCard
            index={3}
            icon="camera-outline"
            title="Câmera e fotos"
            body="Para mandar fotos, vídeos e documentos no atendimento e no chat da equipe."
            action={<StatusAction state={media} grantLabel="Permitir" onRequest={async () => { await request('camera'); await request('photos'); }} />}
          />
          <PermissionCard
            index={4}
            icon="mic-outline"
            title="Microfone"
            body="Para gravar e mandar áudios no atendimento e no chat da equipe."
            action={<StatusAction state={states.microphone} grantLabel="Permitir" onRequest={() => void request('microphone')} />}
          />
        </View>
        {onboarding ? (
          <View style={{ marginTop: 26, gap: 8 }}>
            <Button label="Continuar" icon="arrow-forward" onPress={() => void finish()} />
            <Button label="Agora não" variant="ghost" onPress={() => void finish()} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  sub: { marginTop: 8, lineHeight: 20 },
});
