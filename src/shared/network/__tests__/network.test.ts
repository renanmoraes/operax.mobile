jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(),
}));

// eslint-disable-next-line import/first -- o mock precisa vir antes do módulo
import { isNetworkError } from '../network';

describe('falha de rede', () => {
  it('reconhece erro sem resposta do servidor', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(true);
    expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isNetworkError({ message: 'Network Error' })).toBe(true);
  });

  it('erro com resposta do servidor não é falta de internet', () => {
    expect(isNetworkError({ response: { status: 500 }, message: 'Request failed' })).toBe(false);
    expect(isNetworkError({ response: { status: 403 }, code: 'ERR_BAD_REQUEST' })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(new Error('qualquer'))).toBe(false);
  });
});
