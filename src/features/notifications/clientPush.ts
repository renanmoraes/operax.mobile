import { Platform } from 'react-native';
import i18n from '@/src/i18n';
import { portalRegisterPushToken, portalRevokePushToken } from '@/src/shared/api/portal.api';
import { appVersionInfo } from '@/src/shared/updates/appVersion';
import { grantedPushToken, registerForPushNotificationsAsync } from './push';

export const pushLang = (language: string | undefined): 'pt' | 'en' | 'es' => {
  const l = (language ?? 'pt').slice(0, 2);
  return l === 'en' || l === 'es' ? l : 'pt';
};

/**
 * Liga este aparelho à conta do aluno na empresa aberta, para receber push (conquista ganha e outros avisos).
 * `prompt`: abre o pedido do sistema (tela de permissões); sem ele, só registra se a pessoa já deixou.
 * O idioma vai junto: o servidor escreve o aviso no idioma do app.
 */
export async function registerClientPush({ prompt }: { prompt: boolean }): Promise<void> {
  if (Platform.OS === 'web') return;
  let token: string | null;
  if (prompt) {
    const result = await registerForPushNotificationsAsync();
    token = result.status === 'granted' ? result.token : null;
  } else {
    token = await grantedPushToken();
  }
  if (!token) return;
  await portalRegisterPushToken({
    token,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
    app_version: appVersionInfo().version,
    lang: pushLang(i18n.language),
  });
}

/** Ao sair da conta do aluno: o aparelho para de receber os avisos dela (falha de rede não segura a saída). */
export async function revokeClientPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = await grantedPushToken();
  if (token) await portalRevokePushToken(token).catch(() => undefined);
}
