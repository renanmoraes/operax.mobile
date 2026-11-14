import { deleteItem, getItem, setItem } from '../storage';

/**
 * Uma sessão por tipo de conta (equipe e cliente), lado a lado no aparelho.
 * O "papel salvo" diz qual lado está aberto; quem pede o token sem dizer o lado
 * (cliente HTTP, socket) recebe o do lado aberto.
 */

export type SavedRole = 'staff' | 'client';

const ROLE_KEY = 'operax_role';
const LEGACY_ACCESS = 'operax_access_token';
const LEGACY_REFRESH = 'operax_refresh_token';

const accessKey = (role: SavedRole) => `operax_access_token_${role}`;
const refreshKey = (role: SavedRole) => `operax_refresh_token_${role}`;
const summaryKey = (role: SavedRole) => `operax_account_${role}`;

export async function getSavedRole(): Promise<SavedRole | null> {
  const value = await getItem(ROLE_KEY);
  return value === 'staff' || value === 'client' ? value : null;
}

export async function setSavedRole(role: SavedRole): Promise<void> {
  await setItem(ROLE_KEY, role);
}

export async function clearSavedRole(): Promise<void> {
  await deleteItem(ROLE_KEY);
}

async function resolveRole(role?: SavedRole): Promise<SavedRole> {
  return role ?? (await getSavedRole()) ?? 'staff';
}

export async function getAccessToken(role?: SavedRole): Promise<string | null> {
  return getItem(accessKey(await resolveRole(role)));
}

export async function getRefreshToken(role?: SavedRole): Promise<string | null> {
  return getItem(refreshKey(await resolveRole(role)));
}

export async function setTokens(access: string, refresh: string, role?: SavedRole): Promise<void> {
  const r = await resolveRole(role);
  await setItem(accessKey(r), access);
  await setItem(refreshKey(r), refresh);
}

/** Sai de uma conta só: apaga o token e o resumo dela. A outra continua. */
export async function clearTokens(role?: SavedRole): Promise<void> {
  const r = await resolveRole(role);
  await deleteItem(accessKey(r));
  await deleteItem(refreshKey(r));
  await deleteItem(summaryKey(r));
}

export async function hasSession(role: SavedRole): Promise<boolean> {
  return (await getItem(accessKey(role))) != null;
}

/** Instalações antigas guardavam um token só, sem lado: passa para o lado salvo (ou equipe). */
export async function migrateLegacyTokens(): Promise<void> {
  const access = await getItem(LEGACY_ACCESS);
  if (access == null) return;
  const refresh = (await getItem(LEGACY_REFRESH)) ?? '';
  const role = (await getSavedRole()) ?? 'staff';
  if (!(await hasSession(role))) await setTokens(access, refresh, role);
  await deleteItem(LEGACY_ACCESS);
  await deleteItem(LEGACY_REFRESH);
}

/** O que a troca de conta mostra sem precisar de rede. */
export type AccountSummary = { role: SavedRole; name: string; email?: string; demo: boolean };

export async function saveAccountSummary(summary: AccountSummary): Promise<void> {
  await setItem(summaryKey(summary.role), JSON.stringify(summary));
}

export async function getAccountSummary(role: SavedRole): Promise<AccountSummary | null> {
  const raw = await getItem(summaryKey(role));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AccountSummary;
    return parsed.role === role ? parsed : null;
  } catch {
    return null;
  }
}
