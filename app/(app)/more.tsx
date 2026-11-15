import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { getActiveApps } from '@/src/shared/api/attendance.api';

const WORK: { id: 'pos' | 'patients' | 'kanban' | 'history' | 'quickReplies' | 'templates'; href: string; icon: IconName; perm: PermKey; app?: string }[] = [
  { id: 'pos', href: '/pdv', icon: 'storefront-outline', perm: 'posSell', app: 'pos' },
  { id: 'patients', href: '/pacientes', icon: 'people-outline', perm: 'contacts' },
  { id: 'kanban', href: '/kanban', icon: 'grid-outline', perm: 'kanban' },
  { id: 'history', href: '/history', icon: 'time-outline', perm: 'history' },
  { id: 'quickReplies', href: '/quick-replies', icon: 'flash-outline', perm: 'quickReplies' },
  { id: 'templates', href: '/templates', icon: 'document-text-outline', perm: 'templates' },
];

const ACCOUNT: { id: 'push' | 'profile'; href: string; icon: IconName }[] = [
  { id: 'push', href: '/notification-prefs', icon: 'notifications-outline' },
  { id: 'profile', href: '/profile', icon: 'person-outline' },
];

export default function MoreScreen() {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { user, mode } = useAuth();
  const can = useCan();
  // Item de app (o PDV) só aparece com o app instalado na empresa; na demonstração aparece sempre.
  const apps = useQuery({ queryKey: ['active-apps'], enabled: mode === 'live', staleTime: 10 * 60_000, queryFn: getActiveApps });
  const work = WORK.filter((item) => can(item.perm) && (!item.app || mode !== 'live' || (apps.data ?? []).includes(item.app)));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }}>
        <ScreenHeader title={t('more.title')} />
        <View style={{ paddingHorizontal: 20 }}>
          <Rise>
            <HeroCard style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar initials={initialsOf(user?.name || t('common.user'))} size={56} tone="brand" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{user?.name || t('common.user')}</Text>
                  <Muted numberOfLines={1} style={{ marginTop: 2 }}>{user?.email || '—'}</Muted>
                </View>
                <Badge label={mode === 'live' ? t('common.online') : t('common.demo')} tone={mode === 'live' ? 'success' : 'primary'} />
              </View>
            </HeroCard>
          </Rise>
          {can('teamChat') ? (
            <>
              <Muted style={styles.groupLabel}>{t('more.team')}</Muted>
              <Rise index={1}>
                <TeamChatCard onPress={() => router.push('/equipe')} />
              </Rise>
            </>
          ) : null}
          {work.length ? (
            <>
              <Muted style={styles.groupLabel}>{t('more.work')}</Muted>
              <Rise index={2}>
                <SettingsGroup>
                  {work.map((item, i) => (
                    <SettingsRow key={item.href} icon={item.icon} title={t(`more.items.${item.id}.title`)} subtitle={t(`more.items.${item.id}.hint`)} onPress={() => router.push(item.href as never)} last={i === work.length - 1} />
                  ))}
                </SettingsGroup>
              </Rise>
            </>
          ) : null}
          <Muted style={styles.groupLabel}>{t('more.account')}</Muted>
          <Rise index={3}>
            <SettingsGroup>
              {ACCOUNT.map((item, i) => (
                <SettingsRow key={item.href} icon={item.icon} title={t(`more.items.${item.id}.title`)} subtitle={t(`more.items.${item.id}.hint`)} onPress={() => router.push(item.href as never)} last={i === ACCOUNT.length - 1} />
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
