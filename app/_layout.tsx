import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/src/features/auth/AuthContext';
import { colors } from '@/src/design-system/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.chromeNavy },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
            contentStyle: { backgroundColor: colors.pageBg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="conversation/[id]" options={{ title: 'Conversa' }} />
          <Stack.Screen name="contact/[id]" options={{ title: 'Contato' }} />
          <Stack.Screen name="quick-replies" options={{ title: 'Respostas rápidas', presentation: 'modal' }} />
          <Stack.Screen name="templates" options={{ title: 'Templates', presentation: 'modal' }} />
          <Stack.Screen name="notification-prefs" options={{ title: 'Notificações push' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
