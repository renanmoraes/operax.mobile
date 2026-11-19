import Constants from 'expo-constants';
import { Platform } from 'react-native';
import i18n from '@/src/i18n';
import { reportError } from '@/src/shared/telemetry/errorReporter';
import { foregroundNotificationHandler } from './presence';

export type PushRegistrationResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

const easProjectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

/** Tipos de aviso da equipe com toque próprio: conversa nova na fila, mensagem em chat assumido e alerta (esfriando, posse perdida). */
export const PUSH_TONES = ['fila', 'assumido', 'alerta'] as const;
/** Vibração de cada toque: fila em dois pulsos longos, chat assumido num curto, alerta em três rápidos. */
const VIBRATION: Record<(typeof PUSH_TONES)[number], number[]> = {
  fila: [0, 500, 200, 500],
  assumido: [0, 180],
  alerta: [0, 120, 90, 120, 90, 120],
};
/** O app a partir desta versão traz os arquivos de som (fila.wav, assumido.wav, alerta.wav). Igual ao servidor. */
const SOUND_APP_VERSION = [1, 2, 0];

export function hasBundledSounds(version: string | null | undefined): boolean {
  if (!version) return false;
  const v = version.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== SOUND_APP_VERSION[i]) return (v[i] ?? 0) > SOUND_APP_VERSION[i];
  return true;
}

/**
 * Canais de notificação do Android que o servidor usa nos avisos (equipe e aluno). Criar de novo não muda nada: no Android o
 * canal guarda o som e a vibração de quando nasceu. Por isso o app com os arquivos de som usa canais novos (`-som`) e o app
 * sem eles fica nos canais que só vibram diferente.
 */
async function ensureAndroidChannel(Notifications: typeof import('expo-notifications')) {
  if (Platform.OS !== 'android') return;
  const base = {
    importance: Notifications.AndroidImportance.MAX,
    lightColor: '#1e4ed8',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  };
  await Notifications.setNotificationChannelAsync('operax-default', { ...base, name: 'Operax', vibrationPattern: [0, 250, 250, 250] });
  const withSound = hasBundledSounds(Constants.expoConfig?.version);
  for (const tone of PUSH_TONES) {
    await Notifications.setNotificationChannelAsync(withSound ? `operax-${tone}-som` : `operax-${tone}`, {
      ...base,
      name: i18n.t(`common:pushChannels.${tone}`),
      vibrationPattern: VIBRATION[tone],
      ...(withSound ? { sound: `${tone}.wav` } : {}),
    });
  }
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

    Notifications.setNotificationHandler({ handleNotification: foregroundNotificationHandler });

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
