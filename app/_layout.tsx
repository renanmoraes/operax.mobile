import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { focusManager, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, LogBox, Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/src/features/auth/AuthContext';
import { AnimatedSplash } from '@/src/design-system/AnimatedSplash';
import { IncomingBanner } from '@/src/features/team-chat/IncomingBanner';
import { TeamChatProvider } from '@/src/features/team-chat/TeamChatContext';
import { resetClientCache } from '@/src/features/client/clientApi';
import { colors } from '@/src/design-system/tokens';
import { installErrorReporter, reportError, setReporterSession, trackRoute } from '@/src/shared/telemetry/errorReporter';
import { Button } from '@/src/design-system/ui';

SplashScreen.preventAutoHideAsync();

// Aviso só de desenvolvimento do expo-router 58 ao montar abas com telas escondidas; não afeta o app
// e o aviso ficava por cima da barra de abas no Expo Go.
LogBox.ignoreLogs(["The action 'ROUTE_NAMES_CHANGED'"]);

// Erros do celular vão para o servidor (system_logs) com o retrato do aparelho.
installErrorReporter();

// No celular, "em foco" = app na frente. Com isso as consultas automáticas (chat ao vivo, contadores)
// param em segundo plano — nada é marcado como lido sem a pessoa ver — e atualizam ao voltar.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}

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
          <AccountCacheReset />
          <NotificationRouter />
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

/**
 * Dados em memória pertencem a uma conta. Ao sair, entrar ou trocar de conta/empresa, apaga tudo
 * o que foi carregado (chaves Pix, conversas, agenda…) para nada de uma empresa aparecer na outra.
 */
/**
 * Notificações: mostra com o app aberto e, ao tocar (com o app aberto, em segundo plano
 * ou fechado), abre a tela do aviso (`data.url`, ex.: o compromisso do lembrete).
 */
function NotificationRouter() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    void import('expo-notifications').then(async (N) => {
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      const open = (data: unknown) => {
        const url = (data as { url?: unknown } | undefined)?.url;
        if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
      };
      sub = N.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
      // App aberto pelo toque na notificação (estava fechado).
      const last = await N.getLastNotificationResponseAsync();
      if (alive && last) open(last.notification.request.content.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return null;
}

function AccountCacheReset() {
  const { user, mode } = useAuth();
  const qc = useQueryClient();
  const tenant = user?.kind === 'staff' ? user.tenant_id ?? '' : user?.kind === 'client' ? user.active_tenant_id ?? '' : '';
  const key = `${mode}:${user?.kind ?? '-'}:${user?.id ?? '-'}:${tenant}`;
  const last = useRef(key);
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    qc.removeQueries();
    resetClientCache();
  }, [key, qc]);
  // O log de erro diz quem estava usando e onde (o servidor confere pelo token).
  const pathname = usePathname();
  useEffect(() => trackRoute(pathname), [pathname]);
  useEffect(() => {
    setReporterSession({ role: user?.kind, mode, tenant: tenant || null });
  }, [user?.kind, mode, tenant]);
  return null;
}

/**
 * Tela que travou: avisa o servidor (com a tela e o aparelho) e deixa tentar de novo,
 * em vez de deixar o app branco ou fechar.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void reportError(error, { context: 'tela', extra: { boundary: true } });
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: colors.pageBg }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text, textAlign: 'center' }}>Algo deu errado nesta tela</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: colors.textSoft, textAlign: 'center' }}>
        Já avisamos a equipe Operax com os detalhes para corrigir. Tente de novo.
      </Text>
      <Button label="Tentar de novo" onPress={() => void retry()} style={{ alignSelf: 'stretch', marginTop: 6 }} />
    </View>
  );
}

