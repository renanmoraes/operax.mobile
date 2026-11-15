import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import { GlassTabBar } from '@/src/design-system/GlassTabBar';
import { TAB_TRANSITION } from '@/src/design-system/tabTransition';
import { useAuth } from '@/src/features/auth/AuthContext';
import { QueueDrawerProvider } from '@/src/features/queue/QueueDrawerContext';
import { hasPermission, PERMS, type PermissionNeed } from '@/src/features/auth/permissions';
import { useTeamChat } from '@/src/features/team-chat/TeamChatContext';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvents } from '@/src/shared/realtime/socket';
import { useEffect, useState } from 'react';
import { hasSeenStaffOnboarding } from '@/src/features/permissions/permissions';

// Mesmas permissões do menu do Operax web: sem elas a aba nem aparece.
const TAB_PERMISSIONS: Record<string, PermissionNeed | undefined> = {
  'inbox/index': PERMS.inbox,
  agenda: PERMS.agenda,
  notifications: undefined,
  more: undefined,
};

const HIDDEN_ITEM = { display: 'none' } as const;

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const teamChat = useTeamChat();
  const qc = useQueryClient();
  // Aviso novo chega ao vivo na aba Avisos.
  const { t } = useTranslation('nav');
  useSocketEvents({ 'notification.new': () => void qc.invalidateQueries({ queryKey: ['notifications'] }) }, user?.kind === 'staff');
  // Primeira entrada da equipe: pede as permissões do aparelho (depois ficam em Perfil).
  const [permsSeen, setPermsSeen] = useState<boolean | null>(null);
  useEffect(() => {
    void hasSeenStaffOnboarding().then(setPermsSeen);
  }, []);
  if (!isAuthenticated || user?.kind !== 'staff') return <Redirect href="/" />;
  if (permsSeen === null) return null;
  if (!permsSeen) return <Redirect href="/permissoes?inicio=1" />;

  const permissions = user?.kind === 'staff' ? user.permissions : undefined;
  const visible = (tab: keyof typeof TAB_PERMISSIONS) =>
    hasPermission(permissions, TAB_PERMISSIONS[tab]);

  return (
    <QueueDrawerProvider>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.pageBg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
          sceneStyle: { backgroundColor: 'transparent' },
          ...TAB_TRANSITION,
        }}
      >
        <Tabs.Screen
          name="inbox/index"
          options={{
            title: t('staff.inbox'),
            headerShown: false,
            href: visible('inbox/index') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="agenda"
          options={{
            title: t('staff.agenda'),
            href: visible('agenda') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: t('staff.notifications'),
            href: visible('notifications') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('staff.more'),
            headerShown: false,
            href: visible('more') ? undefined : null,
            // Mensagens novas do chat interno aparecem como contador na aba Mais.
            tabBarBadge: teamChat.unread > 0 ? teamChat.unread : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="ellipsis-horizontal-circle" size={size} color={color as string} />
            ),
          }}
        />
        {/* Telas abertas pelo Mais: ficam fora da barra, mas acessíveis. No expo-router 58
            `href: null` faz a rota redirecionar para a primeira aba, então só escondemos o item. */}
        <Tabs.Screen name="kanban" options={{ title: t('staff.kanban'), tabBarItemStyle: HIDDEN_ITEM }} />
        <Tabs.Screen name="profile" options={{ title: t('staff.profile'), tabBarItemStyle: HIDDEN_ITEM }} />
        <Tabs.Screen name="history" options={{ title: t('staff.history'), tabBarItemStyle: HIDDEN_ITEM }} />
      </Tabs>
    </QueueDrawerProvider>
  );
}
