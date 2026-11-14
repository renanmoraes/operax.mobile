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
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/src/features/auth/AuthContext';
import { AnimatedSplash } from '@/src/design-system/AnimatedSplash';
import { IncomingBanner } from '@/src/features/team-chat/IncomingBanner';
import { TeamChatProvider } from '@/src/features/team-chat/TeamChatContext';
import { colors } from '@/src/design-system/tokens';

SplashScreen.preventAutoHideAsync();

// Aviso só de desenvolvimento do expo-router 58 ao montar abas com telas escondidas; não afeta o app
// e o aviso ficava por cima da barra de abas no Expo Go.
LogBox.ignoreLogs(["The action 'ROUTE_NAMES_CHANGED'"]);

// No navegador (inclusive Safari do iPhone), tira o contorno azul de foco dos campos e o
// clarão cinza do toque: no app nativo nada disso existe.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('operax-web-reset')) {
  const style = document.createElement('style');
  style.id = 'operax-web-reset';
  style.textContent =
    'input:focus,textarea:focus,[contenteditable]:focus{outline:none!important;box-shadow:none}' +
    '*{-webkit-tap-highlight-color:transparent}' +
    'textarea{resize:none}';
  document.head.appendChild(style);
}

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TeamChatProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.pageBg },
              headerShadowVisible: false,
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
              contentStyle: { backgroundColor: colors.pageBg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="(client)" options={{ headerShown: false }} />
            <Stack.Screen name="cliente" options={{ headerShown: false }} />
            <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="contact/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="quick-replies" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="templates" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="notification-prefs" options={{ headerShown: false }} />
            <Stack.Screen name="pacientes/index" options={{ headerShown: false }} />
            <Stack.Screen name="equipe/index" options={{ headerShown: false }} />
            <Stack.Screen name="equipe/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="visualizar" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack>
          <IncomingBanner />
          <SplashGate />
          </TeamChatProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Abertura animada: fica na frente até o login ser restaurado (e por um tempo mínimo). */
function SplashGate() {
  const { ready } = useAuth();
  return <AnimatedSplash ready={ready} />;
}
