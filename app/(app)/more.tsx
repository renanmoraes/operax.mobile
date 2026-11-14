import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, HeroCard, IconName, Muted, Rise, Screen, ScreenHeader, SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { TeamChatCard } from '@/src/features/team-chat/TeamChatCard';

const WORK: { label: string; hint: string; href: string; icon: IconName }[] = [
  { label: 'Pacientes', hint: 'Pacientes e clientes da empresa', href: '/pacientes', icon: 'people-outline' },
  { label: 'Kanban', hint: 'Pipeline comercial', href: '/kanban', icon: 'grid-outline' },
  { label: 'Histórico', hint: 'Atendimentos encerrados', href: '/history', icon: 'time-outline' },
  { label: 'Respostas rápidas', hint: 'Atalhos de mensagem', href: '/quick-replies', icon: 'flash-outline' },
  { label: 'Templates Meta', hint: 'Fora da janela de 24 h', href: '/templates', icon: 'document-text-outline' },
];

const ACCOUNT: { label: string; hint: string; href: string; icon: IconName }[] = [
  { label: 'Notificações push', hint: 'Categorias e preferências', href: '/notification-prefs', icon: 'notifications-outline' },
  { label: 'Perfil', hint: 'Conta, push e sessão', href: '/profile', icon: 'person-outline' },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, mode } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }}>
        <ScreenHeader title="Mais" />
        <View style={{ paddingHorizontal: 20 }}>
          <Rise>
            <HeroCard style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar initials={initialsOf(user?.name || 'Usuário')} size={56} tone="brand" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{user?.name || 'Usuário'}</Text>
                  <Muted numberOfLines={1} style={{ marginTop: 2 }}>{user?.email || '—'}</Muted>
                </View>
                <Badge label={mode === 'live' ? 'Online' : 'Demo'} tone={mode === 'live' ? 'success' : 'primary'} />
              </View>
            </HeroCard>
          </Rise>
          <Muted style={styles.groupLabel}>Equipe</Muted>
          <Rise index={1}>
            <TeamChatCard onPress={() => router.push('/equipe')} />
          </Rise>
          <Muted style={styles.groupLabel}>Trabalho</Muted>
          <Rise index={2}>
            <SettingsGroup>
              {WORK.map((item, i) => (
                <SettingsRow key={item.href} icon={item.icon} title={item.label} subtitle={item.hint} onPress={() => router.push(item.href as never)} last={i === WORK.length - 1} />
              ))}
            </SettingsGroup>
          </Rise>
          <Muted style={styles.groupLabel}>Conta</Muted>
          <Rise index={3}>
            <SettingsGroup>
              {ACCOUNT.map((item, i) => (
                <SettingsRow key={item.href} icon={item.icon} title={item.label} subtitle={item.hint} onPress={() => router.push(item.href as never)} last={i === ACCOUNT.length - 1} />
              ))}
            </SettingsGroup>
          </Rise>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...text.title, color: colors.text },
  groupLabel: { marginTop: 22, marginBottom: 10, fontFamily: typography.fontFamilySemiBold },
});
