import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { QueueDrawerProvider } from '@/src/features/queue/QueueDrawerContext';
import { hasPermission } from '@/src/features/auth/permissions';

// Nenhuma aba exige permissão ainda — é só o mecanismo. Specs futuras preenchem
// isto conforme admin/atendente precisarem ver coisas diferentes.
const TAB_PERMISSIONS: Record<string, string | undefined> = {
  'inbox/index': undefined,
  agenda: undefined,
  notifications: undefined,
  more: undefined,
};

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const permissions = user?.kind === 'staff' ? user.permissions : undefined;
  const visible = (tab: keyof typeof TAB_PERMISSIONS) =>
    hasPermission(permissions, TAB_PERMISSIONS[tab]);

  return (
    <QueueDrawerProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.chromeNavy },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.cardBg,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="inbox/index"
          options={{
            title: 'Atendimento',
            headerShown: false,
            href: visible('inbox/index') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Agenda',
            href: visible('agenda') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Avisos',
            href: visible('notifications') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'Mais',
            headerShown: false,
            href: visible('more') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="ellipsis-horizontal-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="kanban" options={{ href: null, title: 'Kanban' }} />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Perfil' }} />
        <Tabs.Screen name="history" options={{ href: null, title: 'Histórico' }} />
      </Tabs>
    </QueueDrawerProvider>
  );
}
