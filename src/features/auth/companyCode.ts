import { deleteItem, getItem, setItem } from '@/src/shared/storage';

const KEY = 'operax_company_code';

/** Código da empresa como a web aceita: só letras A–Z, em maiúsculas, no máximo 4. */
export function normalizeCompanyCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

/** Último código usado neste aparelho, ou `null`. Não é segredo, e fica depois de sair da conta. */
export async function getSavedCompanyCode(): Promise<string | null> {
  try {
    const code = normalizeCompanyCode((await getItem(KEY)) ?? '');
    return code.length >= 2 ? code : null;
  } catch {
    return null;
  }
}

export async function saveCompanyCode(code: string): Promise<void> {
  const clean = normalizeCompanyCode(code);
  if (clean.length < 2) return;
  try {
    await setItem(KEY, clean);
  } catch {
    /* sem cofre agora: digita de novo na próxima vez */
  }
}

export async function clearSavedCompanyCode(): Promise<void> {
  try {
    await deleteItem(KEY);
  } catch {
    /* ignore */
  }
}
