import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, HeroCard, IconTile, Muted, Rise, Screen, ScreenHeader, SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { openSystemSettings, usePermissions } from '@/src/features/permissions/permissions';
import { API_URL } from '@/src/shared/config';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user, mode } = useAuth();
  const { states, request } = usePermissions(['notifications'], mode === 'live');
  const push = states.notifications;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}>
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
              <SettingsRow icon="options-outline" title="Preferências de notificação" onPress={() => router.push('/notification-prefs')} />
              <SettingsRow icon="flash-outline" title="Respostas rápidas" onPress={() => router.push('/quick-replies')} />
              <SettingsRow icon="document-text-outline" title="Templates Meta" onPress={() => router.push('/templates')} last />
            </SettingsGroup>
          </Rise>

          <Rise index={3}>
            <Button
              label="Sair da conta"
              variant="danger"
              onPress={async () => {
                await logout();
                router.replace('/(auth)/login');
              }}
            />
          </Rise>
          {__DEV__ ? <Muted style={{ textAlign: 'center', fontSize: 11 }}>{`API ${API_URL}`}</Muted> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: typography.fontFamilyHeavy, fontSize: 20, letterSpacing: -0.4, color: colors.text },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
});
