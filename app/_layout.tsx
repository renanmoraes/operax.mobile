// Idiomas: carrega as traduções antes de qualquer tela.
import i18n from '@/src/i18n';
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
import { setFitnessOwner } from '@/src/features/fitness/owner';
import { resetFinishedSessionMemory } from '@/src/features/fitness/sessionStore';
// Também registra a tarefa do GPS de segundo plano: precisa existir antes de qualquer tela (o Android pode acordar o app só para ela).
import { liveRecordingToResume } from '@/src/features/fitness/background/liveTracking';
import { colors } from '@/src/design-system/tokens';
import { installErrorReporter, reportError, setReporterSession, trackRoute } from '@/src/shared/telemetry/errorReporter';
import { Button } from '@/src/design-system/ui';
import { DialogHost } from '@/src/design-system/Dialog';
import { useTranslation } from 'react-i18next';
import { useLanguageSync } from '@/src/i18n/language';
import { useAppUpdates } from '@/src/shared/updates/appVersion';
import { linkToAppRoute } from '@/src/features/notifications/linkRoute';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
            <Stack.Screen name="permissoes" options={{ headerShown: false }} />
            <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="contact/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="quick-replies" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="templates" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="notification-prefs" options={{ headerShown: false }} />
            <Stack.Screen name="pacientes/index" options={{ headerShown: false }} />
            <Stack.Screen name="equipe/index" options={{ headerShown: false }} />
            <Stack.Screen name="equipe/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="pdv/index" options={{ headerShown: false }} />
            <Stack.Screen name="pdv/vendas" options={{ headerShown: false }} />
            <Stack.Screen name="visualizar" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack>
          <IncomingBanner />
          <SplashGate />
          <AccountCacheReset />
          <DialogHost />
          <NotificationRouter />
          <ResumeRecording />
          <UpdateBanner />
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

/** Nova versão baixada em segundo plano: avisa e deixa atualizar na hora (senão entra ao reabrir). */
function UpdateBanner() {
  const { state, apply } = useAppUpdates();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (state !== 'ready') return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.text }}>
        <Text style={{ flex: 1, color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{t('update.ready')}</Text>
        <Button label={t('update.apply')} compact onPress={apply} />
      </View>
    </View>
  );
}

/**
 * Notificações: mostra com o app aberto e, ao tocar (com o app aberto, em segundo plano
 * ou fechado), abre a tela do aviso (`data.url`, ex.: o compromisso do lembrete).
 * Com o app fechado, o toque chega antes de o login ser restaurado: o destino espera o login
 * (senão a rota protegida manda para o início e o aviso se perde).
 */
function NotificationRouter() {
  const { ready, isAuthenticated, user, switchTenant, accounts, switchAccount } = useAuth();
  const canOpen = ready && isAuthenticated;
  const canOpenRef = useRef(canOpen);
  // O aviso do aluno diz de qual empresa veio: se outra estiver aberta, troca antes de abrir a tela.
  const tenantRef = useRef({ user, switchTenant, accounts, switchAccount });
  useEffect(() => {
    tenantRef.current = { user, switchTenant, accounts, switchAccount };
  }, [user, switchTenant, accounts, switchAccount]);
  const goTo = async (url: string, slug: string | null) => {
    const { user: u, switchTenant: change, accounts: saved, switchAccount: changeAccount } = tenantRef.current;
    // Aviso do aluno com a conta da equipe aberta: troca para a conta do aluno (se está salva) e abre a tela dele.
    if (url.startsWith('/cliente') && u?.kind === 'staff') {
      if (!saved.client) return;
      await changeAccount('client').catch(() => undefined);
      router.push(url as never);
      return;
    }
    if (slug && u?.kind === 'client') {
      const target = u.memberships?.find((m) => m.tenant_slug === slug);
      if (target && target.tenant_id !== u.active_tenant_id) await change(target.tenant_id).catch(() => undefined);
    }
    router.push(url as never);
  };
  const pending = useRef<{ url: string; slug: string | null } | null>(null);
  useEffect(() => {
    canOpenRef.current = canOpen;
    if (canOpen && pending.current) {
      void goTo(pending.current.url, pending.current.slug);
      pending.current = null;
    }
  }, [canOpen]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    void import('expo-notifications').then(async (N) => {
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      const open = (raw: unknown) => {
        const data = (raw ?? {}) as Record<string, unknown>;
        // Lembrete local já traz a tela do app; push do Operax traz o link do web (convertido aqui).
        const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : data.notificationId || data.link ? linkToAppRoute(data.link, data) : null;
        if (!url) return;
        const slug = typeof data.tenant_slug === 'string' ? data.tenant_slug : null;
        if (canOpenRef.current) void goTo(url, slug);
        else pending.current = { url, slug };
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

/** App reaberto com o GPS do treino ainda gravando (o sistema fechou a tela no meio): volta direto para a gravação. */
function ResumeRecording() {
  const { ready, isAuthenticated, user } = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web' || done.current || !ready || !isAuthenticated || user?.kind !== 'client') return;
    done.current = true;
    void liveRecordingToResume()
      .then((m) => {
        if (m?.route?.startsWith('/cliente/')) router.push(m.route as never);
      })
      .catch(() => undefined);
  }, [ready, isAuthenticated, user?.kind]);
  return null;
}

/**
 * Dados em memória pertencem a uma conta. Ao sair, entrar ou trocar de conta/empresa, apaga tudo
 * o que foi carregado (chaves Pix, conversas, agenda…) para nada de uma empresa aparecer na outra.
 */
function AccountCacheReset() {
  const { user, mode } = useAuth();
  const qc = useQueryClient();
  const tenant = user?.kind === 'staff' ? user.tenant_id ?? '' : user?.kind === 'client' ? user.active_tenant_id ?? '' : '';
  const key = `${mode}:${user?.kind ?? '-'}:${user?.id ?? '-'}:${tenant}`;
  const last = useRef(key);
  // Idioma: escolha feita no app, senão o do perfil no Operax (equipe), senão o do celular.
  useLanguageSync(user ? { kind: user.kind, locale: (user as { locale?: string | null }).locale } : null);
  // Dono dos dados de treino guardados no aparelho (fila offline e rascunhos): só a conta logada lê e envia os seus.
  setFitnessOwner(user ? key : '');
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    qc.removeQueries();
    resetClientCache();
    resetFinishedSessionMemory();
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
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text, textAlign: 'center' }}>{i18n.t('errorBoundary.title')}</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: colors.textSoft, textAlign: 'center' }}>
        {i18n.t('errorBoundary.body')}
      </Text>
      <Button label={i18n.t('actions.retry')} onPress={() => void retry()} style={{ alignSelf: 'stretch', marginTop: 6 }} />
    </View>
  );
}

