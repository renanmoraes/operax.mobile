import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import { GlassTabBar } from '@/src/design-system/GlassTabBar';
import { TAB_TRANSITION } from '@/src/design-system/tabTransition';
import { useAuth } from '@/src/features/auth/AuthContext';
import { QueueDrawerProvider } from '@/src/features/queue/QueueDrawerContext';
import { hasPermission } from '@/src/features/auth/permissions';
import { useTeamChat } from '@/src/features/team-chat/TeamChatContext';

// Nenhuma aba exige permissão ainda — é só o mecanismo. Specs futuras preenchem
// isto conforme admin/atendente precisarem ver coisas diferentes.
const TAB_PERMISSIONS: Record<string, string | undefined> = {
  'inbox/index': undefined,
  agenda: undefined,
  notifications: undefined,
  more: undefined,
};

const HIDDEN_ITEM = { display: 'none' } as const;

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const teamChat = useTeamChat();
  if (!isAuthenticated || user?.kind !== 'staff') return <Redirect href="/" />;

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
            title: 'Atendimento',
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
            title: 'Agenda',
            href: visible('agenda') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Avisos',
            href: visible('notifications') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'Mais',
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
        <Tabs.Screen name="kanban" options={{ title: 'Kanban', tabBarItemStyle: HIDDEN_ITEM }} />
        <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarItemStyle: HIDDEN_ITEM }} />
        <Tabs.Screen name="history" options={{ title: 'Histórico', tabBarItemStyle: HIDDEN_ITEM }} />
      </Tabs>
    </QueueDrawerProvider>
  );
}
