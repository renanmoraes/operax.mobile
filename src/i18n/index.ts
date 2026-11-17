import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { varsFor, type VocabMap } from './vocabulary';
import { resources, type Lang } from './resources';

/**
 * Idiomas do app. Português é a base (e o reserva de qualquer texto que falte); inglês e espanhol
 * seguem as mesmas chaves (o teste `i18n.test.ts` confere que nenhuma falta).
 *
 * De onde vem o idioma, nesta ordem:
 * 1. Escolha feita no app (Perfil › Idioma), guardada no aparelho.
 * 2. Equipe: o idioma do perfil no Operax (`users.locale`, o mesmo do web).
 * 3. Idioma do celular.
 * 4. Português.
 *
 * Textos: `const { t } = useTranslation('fitness')` → `t('recorder.start')`. Datas e números: `locale()`
 * (pt-BR, en-US, es-ES) em todo `toLocale*` e `Intl`, nunca 'pt-BR' fixo.
 */

export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: 'pt', label: 'Português', locale: 'pt-BR' },
  { id: 'en', label: 'English', locale: 'en-US' },
  { id: 'es', label: 'Español', locale: 'es-ES' },
];

export const isLang = (v: unknown): v is Lang => v === 'pt' || v === 'en' || v === 'es';

/** "pt-BR", "en_US", "es-419" → idioma do app (ou null se não houver tradução). */
export function langFrom(tag: string | null | undefined): Lang | null {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : null;
}

function deviceLang(): Lang | null {
  try {
    // Carregado sob demanda: nos testes e no SSR do web não há módulo nativo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    for (const l of getLocales()) {
      const lang = langFrom(l.languageTag) ?? langFrom(l.languageCode);
      if (lang) return lang;
    }
  } catch {
    // sem expo-localization
  }
  return null;
}

// eslint-disable-next-line import/no-named-as-default-member -- forma oficial do i18next
void i18n.use(initReactI18next).init({
  resources,
  lng: process.env.NODE_ENV === 'test' ? 'pt' : deviceLang() ?? 'pt',
  fallbackLng: 'pt',
  defaultNS: 'common',
  ns: Object.keys(resources.pt),
  interpolation: { escapeValue: false },
  returnNull: false,
});

/**
 * Aplica o vocabulário da empresa (o que um app de terminologia trocou). Os textos do app usam `$t(vocab:contacts)` e
 * afins; aqui o grupo `vocab` de cada idioma é refeito com as palavras da empresa por cima do padrão. Vazio volta ao
 * padrão do app. Avisa as telas abertas para se redesenharem.
 */
export function setVocabulary(map: VocabMap) {
  for (const lang of Object.keys(resources) as Lang[]) {
    i18n.addResourceBundle(lang, 'vocab', varsFor(lang, map), true, true);
  }
  i18n.emit('languageChanged', i18n.language);
}

export const currentLang = (): Lang => (isLang(i18n.language) ? i18n.language : 'pt');

/** Locale para datas e números (`toLocaleDateString(locale())`, `Intl.NumberFormat(locale())`). */
export const locale = (): string => LANGS.find((l) => l.id === currentLang())?.locale ?? 'pt-BR';

export function changeLang(lang: Lang) {
  // eslint-disable-next-line import/no-named-as-default-member -- forma oficial do i18next
  if (lang !== i18n.language) void i18n.changeLanguage(lang);
}

export default i18n;
