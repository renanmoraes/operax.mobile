import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { reportError } from '@/src/shared/telemetry/errorReporter';

export type PushRegistrationResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

const easProjectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

/** Canal de notificação do Android que o servidor usa nos avisos (equipe e aluno). Criar de novo não muda nada. */
async function ensureAndroidChannel(Notifications: typeof import('expo-notifications')) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('operax-default', {
    name: 'Operax',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1e4ed8',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

/**
 * Token do aparelho só se a pessoa já deixou o app notificar, sem abrir o pedido do sistema.
 * Serve para registrar em silêncio ao entrar na conta (o pedido fica na tela de permissões).
 */
export async function grantedPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return null;
    // No Android 12 ou antes a permissão já vem dada e a pessoa pode nunca passar pelo pedido: o canal que o servidor
    // usa (`operax-default`) precisa existir mesmo assim, senão o aviso cai no canal genérico, sem som nem destaque.
    await ensureAndroidChannel(Notifications);
    const projectId = easProjectId();
    return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch (err) {
    // Permissão dada mas o token não veio (credencial do FCM, rede): antes sumia sem rastro e o aviso nunca chegava.
    void reportError(err, { context: 'push.token', level: 'warn' });
    return null;
  }
}

/**
 * Pede permissão e obtém Expo push token.
 * Em Expo Go / simulador pode falhar — tratamos como unavailable sem quebrar o app.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  try {
    // Import dinâmico evita crash se o módulo nativo não estiver linkado em algum ambiente
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    await ensureAndroidChannel(Notifications);

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      void reportError(new Error('Notificações negadas neste aparelho: não vai receber avisos com o app fechado'), { context: 'push.denied', level: 'warn' });
      return { status: 'denied' };
    }

    const projectId = easProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    return { status: 'granted', token: tokenResponse.data };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Push indisponível neste ambiente';
    void reportError(err, { context: 'push.register', level: 'warn' });
    return { status: 'unavailable', reason };
  }
}
