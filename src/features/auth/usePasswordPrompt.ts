import { router } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import i18n from '@/src/i18n';
import { confirmDialog } from '@/src/design-system/Dialog';
import type { AuthUser } from '@/src/shared/api/auth.api';
import { shouldPromptPassword } from './password';

/** Pessoas já perguntadas nesta abertura do app: o aviso não repete ao voltar para o início. */
const askedThisRun = new Set<string>();

const keyFor = (personId: string) => `operax_pwd_prompt_${personId.replace(/[^A-Za-z0-9._-]/g, '')}`;

async function readDismissed(personId: string): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(personId));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function writeDismissed(personId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyFor(personId), String(Date.now()));
  } catch {
    /* sem cofre (web): o aviso volta na próxima abertura, sem prejuízo */
  }
}

/**
 * Depois de entrar pelo código, quem ainda não tem senha vê "Crie uma senha para entrar mais rápido".
 * "Agora não" guarda a data no aparelho e o aviso volta em 7 dias; quem cria a senha não vê mais.
 */
export function usePasswordPrompt(user: AuthUser | null, live: boolean): void {
  const client = user?.kind === 'client' ? user : null;
  const personId = client?.id ?? null;
  const account = client?.account;
  useEffect(() => {
    if (!live || !personId || askedThisRun.has(personId)) return;
    let alive = true;
    void (async () => {
      if (!shouldPromptPassword(account, await readDismissed(personId)) || !alive) return;
      askedThisRun.add(personId);
      const create = await confirmDialog({
        title: i18n.t('auth:password.promptTitle'),
        message: i18n.t('auth:password.promptBody'),
        confirmLabel: i18n.t('auth:password.promptCreate'),
        cancelLabel: i18n.t('auth:password.promptLater'),
        icon: 'key-outline',
      });
      if (create) router.push('/cliente/senha');
      else await writeDismissed(personId);
    })();
    return () => {
      alive = false;
    };
  }, [live, personId, account]);
}
