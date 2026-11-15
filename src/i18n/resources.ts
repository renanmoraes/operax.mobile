import pt from './locales/pt';
import en from './locales/en';
import es from './locales/es';

export const resources = { pt, en, es } as const;
export type Lang = keyof typeof resources;
