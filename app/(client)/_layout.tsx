import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassTabBar } from '@/src/design-system/GlassTabBar';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useClientUnread } from '@/src/features/client/useClientData';
import { hasSeenClientOnboarding } from '@/src/features/permissions/permissions';

export default function ClientLayout() {
  const { isAuthenticated, user } = useAuth();
  const unread = useClientUnread();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    void hasSeenClientOnboarding().then(setOnboarded);
  }, []);
  // "/" deixa o index.tsx/resolveAuthRoute decidir pelo papel salvo — depois de
  // um logout normal, o papel continua 'client', então cai no client-login,
  // não na escolha de papel de novo.
  if (!isAuthenticated || user?.kind !== 'client') return <Redirect href="/" />;
  if (user.active_tenant_id == null) return <Redirect href="/(auth)/client-tenant-select" />;
  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/cliente/permissoes" />;

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fitness"
        options={{
          title: 'Treino',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversas"
        options={{
          title: 'Conversas',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
