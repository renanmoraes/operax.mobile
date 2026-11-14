import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, HeroCard, IconName, Muted, Rise, Screen, ScreenHeader, SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { TeamChatCard } from '@/src/features/team-chat/TeamChatCard';
import { useCan } from '@/src/features/auth/useCan';
import type { PermKey } from '@/src/features/auth/permissions';

const WORK: { label: string; hint: string; href: string; icon: IconName; perm: PermKey }[] = [
  { label: 'Pacientes', hint: 'Pacientes e clientes da empresa', href: '/pacientes', icon: 'people-outline', perm: 'contacts' },
  { label: 'Kanban', hint: 'Pipeline comercial', href: '/kanban', icon: 'grid-outline', perm: 'kanban' },
  { label: 'Histórico', hint: 'Atendimentos encerrados', href: '/history', icon: 'time-outline', perm: 'history' },
  { label: 'Respostas rápidas', hint: 'Atalhos de mensagem', href: '/quick-replies', icon: 'flash-outline', perm: 'quickReplies' },
  { label: 'Templates Meta', hint: 'Fora da janela de 24 h', href: '/templates', icon: 'document-text-outline', perm: 'templates' },
];

const ACCOUNT: { label: string; hint: string; href: string; icon: IconName }[] = [
  { label: 'Notificações push', hint: 'Categorias e preferências', href: '/notification-prefs', icon: 'notifications-outline' },
  { label: 'Perfil', hint: 'Conta, push e sessão', href: '/profile', icon: 'person-outline' },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, mode } = useAuth();
  const can = useCan();
  const work = WORK.filter((item) => can(item.perm));

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
          {can('teamChat') ? (
            <>
              <Muted style={styles.groupLabel}>Equipe</Muted>
              <Rise index={1}>
                <TeamChatCard onPress={() => router.push('/equipe')} />
              </Rise>
            </>
          ) : null}
          {work.length ? (
            <>
              <Muted style={styles.groupLabel}>Trabalho</Muted>
              <Rise index={2}>
                <SettingsGroup>
                  {work.map((item, i) => (
                    <SettingsRow key={item.href} icon={item.icon} title={item.label} subtitle={item.hint} onPress={() => router.push(item.href as never)} last={i === work.length - 1} />
                  ))}
                </SettingsGroup>
              </Rise>
            </>
          ) : null}
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
