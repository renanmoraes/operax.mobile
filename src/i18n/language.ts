import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { api } from '@/src/shared/api/client';
import { reportError } from '@/src/shared/telemetry/errorReporter';
import { changeLang, isLang, langFrom, LANGS } from './index';
import type { Lang } from './resources';

/** Escolha de idioma feita no app (vale para qualquer conta neste aparelho). */
const LANG_KEY = 'app_language';

/**
 * Aplica o idioma ao abrir o app e ao entrar: a escolha feita no app vence; sem ela, a equipe usa o
 * idioma do perfil no Operax (`locale`, o mesmo do web); o resto fica no idioma do celular.
 */
export function useLanguageSync(user: { kind: string; locale?: string | null } | null) {
  useEffect(() => {
    let alive = true;
    void kvGet<Lang>(LANG_KEY).then((saved) => {
      if (!alive) return;
      if (isLang(saved)) return changeLang(saved);
      const fromProfile = user?.kind === 'staff' ? langFrom(user.locale) : null;
      if (fromProfile) changeLang(fromProfile);
    });
    return () => {
      alive = false;
    };
  }, [user?.kind, user?.locale]);
}

/** Troca o idioma agora, guarda no aparelho e, na equipe com login real, no perfil do Operax. */
export async function setAppLanguage(lang: Lang, opts: { syncProfile: boolean; name?: string }) {
  changeLang(lang);
  await kvSet(LANG_KEY, lang);
  if (!opts.syncProfile || !opts.name) return;
  try {
    // O PATCH do perfil exige o nome junto (o backend recusa sem ele).
    await api.patch('/api/auth/me', { name: opts.name, locale: LANGS.find((l) => l.id === lang)?.locale ?? 'pt-BR' });
  } catch (e) {
    // O idioma já mudou no app; o perfil acerta na próxima vez.
    void reportError(e, { context: 'idioma no perfil' });
  }
}

/** Idioma atual, reativo (a tela redesenha quando muda). */
export function useLang(): Lang {
  const { i18n } = useTranslation();
  return isLang(i18n.language) ? i18n.language : 'pt';
}
