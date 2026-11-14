import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { trackAction } from '@/src/shared/telemetry/errorReporter';

/**
 * Versão do app e atualização automática (EAS Update).
 *
 * O app gerado procura atualização ao abrir e ao voltar para a frente (no máximo a cada 30 min).
 * Achou: baixa em segundo plano e avisa "Nova versão pronta"; se a pessoa não tocar em atualizar,
 * a versão nova entra sozinha na próxima vez que o app abrir. Em desenvolvimento e no Expo Go
 * o EAS Update fica desligado (Updates.isEnabled = false).
 */

export type AppVersionInfo = {
  version: string;
  build: string | null;
  /** Atualização em uso (8 primeiros caracteres) ou "embutida" (a que veio no instalador). */
  update: string;
  channel: string | null;
  updatedAt: Date | null;
};

export function appVersionInfo(): AppVersionInfo {
  const embedded = !Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.updateId;
  return {
    version: Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? '0.0.0',
    build: Application.nativeBuildVersion ?? null,
    update: embedded ? 'embutida' : Updates.updateId!.slice(0, 8),
    channel: Updates.isEnabled ? Updates.channel : null,
    updatedAt: Updates.isEnabled && !embedded ? Updates.createdAt : null,
  };
}

/** "Versão 1.0.0 (12) · atualização 3f2a1c9d" */
export function appVersionLabel(info = appVersionInfo()): string {
  const build = info.build ? ` (${info.build})` : '';
  const upd = info.update === 'embutida' ? '' : ` · atualização ${info.update}`;
  return `Versão ${info.version}${build}${upd}`;
}

const CHECK_EVERY_MS = 30 * 60_000;
let lastCheck = 0;

export type UpdateState = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

async function checkAndFetch(set: (s: UpdateState) => void) {
  if (!Updates.isEnabled || __DEV__ || Platform.OS === 'web') return;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  try {
    set('checking');
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) return set('idle');
    set('downloading');
    const f = await Updates.fetchUpdateAsync();
    set(f.isNew ? 'ready' : 'idle');
    if (f.isNew) trackAction('atualização baixada', undefined, 'action');
  } catch {
    set('error');
  }
}

/** Procura e baixa atualização; `apply` reinicia já na versão nova. */
export function useAppUpdates(): { state: UpdateState; apply: () => void } {
  const [state, setState] = useState<UpdateState>('idle');
  useEffect(() => {
    void checkAndFetch(setState);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkAndFetch(setState);
    });
    return () => sub.remove();
  }, []);
  return { state, apply: () => void Updates.reloadAsync().catch(() => undefined) };
}
