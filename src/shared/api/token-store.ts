import { deleteItem, getItem, setItem } from '../storage';

const ACCESS_KEY = 'operax_access_token';
const REFRESH_KEY = 'operax_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await setItem(ACCESS_KEY, access);
  await setItem(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  await deleteItem(ACCESS_KEY);
  await deleteItem(REFRESH_KEY);
}

const ROLE_KEY = 'operax_role';

export type SavedRole = 'staff' | 'client';

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
