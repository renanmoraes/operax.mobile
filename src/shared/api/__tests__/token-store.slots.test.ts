const mem = new Map<string, string>();
jest.mock('../../storage', () => ({
  getItem: jest.fn(async (k: string) => mem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => void mem.set(k, v)),
  deleteItem: jest.fn(async (k: string) => void mem.delete(k)),
}));

import {
  clearTokens,
  getAccessToken,
  getAccountSummary,
  getRefreshToken,
  hasSession,
  migrateLegacyTokens,
  saveAccountSummary,
  setSavedRole,
  setTokens,
} from '../token-store';

beforeEach(() => mem.clear());

describe('token-store com uma sessão por tipo de conta', () => {
  it('guarda equipe e cliente separados e lê pelo lado ativo', async () => {
    await setTokens('a-staff', 'r-staff', 'staff');
    await setTokens('a-client', 'r-client', 'client');

    await setSavedRole('staff');
    expect(await getAccessToken()).toBe('a-staff');
    expect(await getRefreshToken()).toBe('r-staff');

    await setSavedRole('client');
    expect(await getAccessToken()).toBe('a-client');
    expect(await getRefreshToken()).toBe('r-client');
  });

  it('sem papel explícito, grava no lado ativo', async () => {
    await setSavedRole('client');
    await setTokens('a', 'r');
    expect(await hasSession('client')).toBe(true);
    expect(await hasSession('staff')).toBe(false);
  });

  it('sair de uma conta não derruba a outra', async () => {
    await setTokens('a-staff', 'r-staff', 'staff');
    await setTokens('a-client', 'r-client', 'client');
    await clearTokens('client');
    expect(await hasSession('client')).toBe(false);
    expect(await hasSession('staff')).toBe(true);
  });

  it('migra o token antigo (sem lado) para o lado salvo, ou equipe', async () => {
    mem.set('operax_access_token', 'old-a');
    mem.set('operax_refresh_token', 'old-r');
    await migrateLegacyTokens();
    expect(await hasSession('staff')).toBe(true);
    expect(mem.has('operax_access_token')).toBe(false);

    mem.clear();
    mem.set('operax_access_token', 'old-a');
    mem.set('operax_refresh_token', 'old-r');
    await setSavedRole('client');
    await migrateLegacyTokens();
    expect(await hasSession('client')).toBe(true);
  });

  it('guarda o resumo da conta para mostrar na troca sem rede', async () => {
    await saveAccountSummary({ role: 'staff', name: 'Renan', email: 'r@x.com', demo: false });
    expect(await getAccountSummary('staff')).toEqual({ role: 'staff', name: 'Renan', email: 'r@x.com', demo: false });
    expect(await getAccountSummary('client')).toBeNull();
    await clearTokens('staff');
    expect(await getAccountSummary('staff')).toBeNull();
  });
});
