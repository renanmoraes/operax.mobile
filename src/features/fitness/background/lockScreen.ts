import { Platform } from 'react-native';
import i18n from '@/src/i18n';

/**
 * Resumo do treino na tela bloqueada: uma notificação que se atualiza (tempo, distância, ritmo).
 * Android: fixa e silenciosa, num canal de importância baixa (não toca nem vibra a cada atualização).
 * iPhone: nível "passivo" (não acende a tela nem toca), trocada no lugar a cada atualização.
 * Live Activity (ilha dinâmica) precisa de uma extensão nativa do iOS: fica para depois.
 */
const ID = 'operax-workout-live';
const CHANNEL = 'operax-workout';

type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null | undefined;
async function notifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (mod === undefined) mod = await import('expo-notifications').catch(() => null);
  return mod;
}

let channelReady: Promise<boolean> | null = null;
function ensureChannel(N: NotificationsModule): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  channelReady ??= N.setNotificationChannelAsync(CHANNEL, {
    name: i18n.t('fitness:live.channel'),
    importance: N.AndroidImportance.LOW,
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  }).then(
    () => true,
    () => false,
  );
  return channelReady;
}

/** Na largada: pede a permissão de notificação só se nunca foi perguntada (sem ela, o treino grava igual). */
export async function askSummaryPermission(): Promise<void> {
  const N = await notifications();
  if (!N) return;
  try {
    const p = await N.getPermissionsAsync();
    if (!p.granted && p.canAskAgain && p.status === 'undetermined') await N.requestPermissionsAsync();
  } catch {
    // sem notificação o treino grava igual
  }
}

export async function showLiveSummary(title: string, body: string): Promise<void> {
  const N = await notifications();
  if (!N) return;
  try {
    if (!(await N.getPermissionsAsync()).granted) return;
    const channel = await ensureChannel(N);
    await N.scheduleNotificationAsync({
      identifier: ID,
      // Sem `url`: tocar só traz o app de volta para a gravação (que continua aberta).
      content: { title, body, sound: false, sticky: true, autoDismiss: false, interruptionLevel: 'passive', data: { kind: 'workout-live' } },
      trigger: Platform.OS === 'android' && channel ? ({ channelId: CHANNEL } as never) : null,
    });
  } catch {
    // resumo é extra: falhar aqui não pode atrapalhar a gravação
  }
}

export async function clearLiveSummary(): Promise<void> {
  const N = await notifications();
  if (!N) return;
  try {
    await N.dismissNotificationAsync(ID);
  } catch {
    // já não estava lá
  }
}
