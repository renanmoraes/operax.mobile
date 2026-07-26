export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3000';

export const MOBILE_CLIENT_HEADER = 'operax-mobile';

/** Demo mock só se EXPO_PUBLIC_ALLOW_MOCK=1 */
export const ALLOW_MOCK = process.env.EXPO_PUBLIC_ALLOW_MOCK === '1';
