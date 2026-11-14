import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, HeroCard, IconTile, Muted, Rise, Screen, ScreenHeader, SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { colors, text, typography } from '@/src/design-system/tokens';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AccountSwitcher } from '@/src/features/auth/AccountSwitcher';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { openSystemSettings, usePermissions } from '@/src/features/permissions/permissions';
import { API_URL } from '@/src/shared/config';
import { appVersionLabel } from '@/src/shared/updates/appVersion';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user, mode } = useAuth();
  const { states, request } = usePermissions(['notifications'], mode === 'live');
  const push = states.notifications;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }}>
        <ScreenHeader title="Perfil" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Rise>
            <HeroCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Avatar initials={initialsOf(user?.name || 'Usuário')} size={72} tone="brand" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{user?.name || 'Usuário'}</Text>
                  <Muted numberOfLines={1} style={{ marginTop: 3 }}>{user?.email}</Muted>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <Badge label={mode === 'live' ? 'Online' : 'Demo'} tone={mode === 'live' ? 'success' : 'primary'} />
                    {user?.kind === 'staff' && user.role_code ? <Badge label={user.role_code} /> : null}
                  </View>
                </View>
              </View>
            </HeroCard>
          </Rise>

          <Rise index={1}>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <IconTile icon="notifications-outline" size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Notificações neste aparelho</Text>
                  <Muted style={{ marginTop: 4, lineHeight: 19 }}>Avisamos quando alguém entra na fila, quando te mencionam e quando um horário muda.</Muted>
                </View>
              </View>
              <View style={{ paddingLeft: 60 }}>
                {push === 'granted' ? (
                  <Badge label="Ativadas" tone="success" icon="checkmark" />
                ) : push === 'blocked' ? (
                  <Button label="Abrir ajustes do celular" variant="soft" compact onPress={openSystemSettings} style={{ alignSelf: 'flex-start' }} />
                ) : push === 'unavailable' ? (
                  <Badge label="Disponível no app do celular" />
                ) : (
                  <Button label="Ativar notificações" compact onPress={() => void request('notifications')} style={{ alignSelf: 'flex-start' }} />
                )}
              </View>
            </Card>
          </Rise>

          <Rise index={2}>
            <SettingsGroup>
              <SettingsRow icon="shield-checkmark-outline" title="Permissões do aparelho" subtitle="Notificações, câmera, fotos e microfone" onPress={() => router.push('/permissoes')} />
              <SettingsRow icon="options-outline" title="Preferências de notificação" onPress={() => router.push('/notification-prefs')} />
              <SettingsRow icon="flash-outline" title="Respostas rápidas" onPress={() => router.push('/quick-replies')} />
              <SettingsRow icon="document-text-outline" title="Templates Meta" onPress={() => router.push('/templates')} last />
            </SettingsGroup>
          </Rise>

          <Rise index={3}>
            <Text style={styles.groupLabel}>Contas</Text>
            <AccountSwitcher />
          </Rise>

          <Rise index={4}>
            <Button
              label="Sair desta conta"
              variant="danger"
              onPress={async () => {
                await logout();
                router.replace('/');
              }}
            />
          </Rise>
          {/* Versão instalada e atualização em uso: o suporte pede isto quando algo dá errado. */}
          <Muted style={{ textAlign: 'center', fontSize: 12 }}>{appVersionLabel()}</Muted>
          {__DEV__ ? <Muted style={{ textAlign: 'center', fontSize: 11 }}>{`API ${API_URL}`}</Muted> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...text.title, color: colors.text },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  groupLabel: { marginTop: 10, marginBottom: 10, fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textMuted },
});
