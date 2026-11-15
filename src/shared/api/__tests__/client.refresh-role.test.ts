import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { api } from '../client';
import { setSavedRole, setTokens } from '../token-store';

const mockMem = new Map<string, string>();
jest.mock('../../storage', () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => void mockMem.set(k, v)),
  deleteItem: jest.fn(async (k: string) => void mockMem.delete(k)),
}));

const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError('401', 'ERR_BAD_REQUEST', config, null, { status: 401, statusText: '', headers: {}, config, data: {} });

beforeEach(async () => {
  mockMem.clear();
  await setTokens('a-staff', 'r-staff', 'staff');
  await setTokens('a-client', 'r-client', 'client');
  await setSavedRole('staff');
});

afterEach(() => jest.restoreAllMocks());

describe('renovação do token presa à conta que pediu', () => {
  it('trocar para o cliente no meio da renovação não grava a equipe no lugar do cliente', async () => {
    const seen: string[] = [];
    api.defaults.adapter = async (config) => {
      const auth = String(config.headers.Authorization);
      seen.push(auth);
      if (auth === 'Bearer a-staff') throw unauthorized(config);
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
    jest.spyOn(axios, 'post').mockImplementation(async () => {
      await setSavedRole('client'); // a pessoa troca de conta enquanto renova
      return { data: { access_token: 'new-staff', refresh_token: 'r2-staff' } };
    });

    const res = await api.get('/api/me');

    expect(res.data).toEqual({ ok: true });
    expect(seen).toEqual(['Bearer a-staff', 'Bearer new-staff']);
    expect(mockMem.get('operax_access_token_staff')).toBe('new-staff');
    expect(mockMem.get('operax_refresh_token_staff')).toBe('r2-staff');
    expect(mockMem.get('operax_access_token_client')).toBe('a-client');
  });

  it('se a renovação falha, só a conta que pediu sai', async () => {
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };
    jest.spyOn(axios, 'post').mockImplementation(async () => {
      await setSavedRole('client');
      throw new Error('refresh falhou');
    });

    await expect(api.get('/api/me')).rejects.toBeTruthy();
    expect(mockMem.get('operax_access_token_staff')).toBeUndefined();
    expect(mockMem.get('operax_access_token_client')).toBe('a-client');
  });
});
