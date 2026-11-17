import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TAB_TRANSITION } from '@/src/design-system/tabTransition';
import { GlassTabBar } from '@/src/design-system/GlassTabBar';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useBookingReminders, useClientCapabilities, useClientUnread } from '@/src/features/client/useClientData';
import { hasSeenClientOnboarding } from '@/src/features/permissions/permissions';
import { useFlushResultsQueue } from '@/src/features/fitness/useFitness';
import { useTranslation } from 'react-i18next';

export default function ClientLayout() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation('nav');
  const unread = useClientUnread();
  // Abas seguem o que a empresa liberou no portal (sem treino liberado, não existe aba Treino).
  const caps = useClientCapabilities();
  // Lembretes de agenda e aula agendados no aparelho (tocam com o app fechado).
  useBookingReminders();
  useFlushResultsQueue();
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
  if (!onboarded) return <Redirect href="/cliente/permissoes?inicio=1" />;

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' }, ...TAB_TRANSITION }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: t('client.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: t('client.agenda'),
          href: caps.scheduling ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="fitness"
        options={{
          title: t('client.fitness'),
          href: caps.training ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="conversas"
        options={{
          title: t('client.chats'),
          href: caps.chat ? undefined : null,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: t('client.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
