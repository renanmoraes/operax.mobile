import 'i18next';
import type pt from './locales/pt';

/** Chaves tipadas: `t('fitness:recorder.start')` com chave errada não compila. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof pt;
  }
}
