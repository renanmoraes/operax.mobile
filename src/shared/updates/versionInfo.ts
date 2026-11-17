import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * De qual versão é este app: a do instalador (versão e build da loja) e a atualização pelo ar em uso.
 * Sem dependência de telemetria nem da API, para servir aos dois sem import circular.
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

/**
 * Valor do cabeçalho `X-App-Version` de toda chamada à API: "1.1.0 (10) 01a1e6c2".
 * O servidor grava isso nos logs da requisição, para saber de qual versão veio o erro de um cliente.
 */
export function appVersionHeader(info: AppVersionInfo = appVersionInfo()): string {
  return [info.version, info.build ? `(${info.build})` : null, info.update].filter(Boolean).join(' ');
}
