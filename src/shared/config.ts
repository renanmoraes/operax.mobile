/**
 * Endereço da API. Em desenvolvimento, o servidor local; no app gerado (build ou atualização
 * pelo EAS Update) sem a variável definida, a API de produção — nunca o endereço local.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || (__DEV__ ? 'http://127.0.0.1:3000' : 'https://api.operax.digital');

export const MOBILE_CLIENT_HEADER = 'operax-mobile';

/** Demo mock só se EXPO_PUBLIC_ALLOW_MOCK=1 */
export const ALLOW_MOCK = process.env.EXPO_PUBLIC_ALLOW_MOCK === '1';
