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

describe('quando o app diz que está sem internet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const net = require('../network') as typeof import('../network');
  const fetchMock = jest.fn();
  beforeAll(() => {
    (global as { fetch: unknown }).fetch = fetchMock;
  });
  beforeEach(() => {
    net.__resetNetworkForTests(true);
    fetchMock.mockReset();
  });

  it('aviso de "sem internet" do Android com o servidor respondendo não vira faixa', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ status: 'ok' }) });
    await net.__applyForTests({ isConnected: true, isInternetReachable: false });
    expect(net.isOnline()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/health'), expect.anything());
  });

  it('servidor sem responder: fica sem internet', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await net.__applyForTests({ isConnected: true, isInternetReachable: false });
    expect(net.isOnline()).toBe(false);
  });

  it('qualquer resposta do servidor tira a faixa e avisa quem espera a volta', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await net.__applyForTests({ isConnected: false });
    expect(net.isOnline()).toBe(false);
    const back = jest.fn();
    net.onReconnect(back);
    net.markServerReached();
    expect(net.isOnline()).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('página de login do Wi-Fi não conta como internet', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => { throw new SyntaxError('html'); } });
    await net.__applyForTests({ isConnected: true, isInternetReachable: false });
    expect(net.isOnline()).toBe(false);
  });

  it('conferência lenta que falha depois de o servidor responder não derruba', async () => {
    let fail: (e: unknown) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    const pending = net.__applyForTests({ isConnected: true, isInternetReachable: false });
    await new Promise((r) => setTimeout(r, 5));
    net.markServerReached();
    fail(new TypeError('timeout'));
    await pending;
    expect(net.isOnline()).toBe(true);
  });

  it('reconfere sozinho enquanto está fora, para a faixa não ficar presa', async () => {
    jest.useFakeTimers();
    fetchMock.mockRejectedValueOnce(new TypeError('falhou'));
    await net.__applyForTests({ isConnected: true, isInternetReachable: false });
    expect(net.isOnline()).toBe(false);
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ status: 'ok' }) });
    await jest.advanceTimersByTimeAsync(15_000);
    expect(net.isOnline()).toBe(true);
    jest.useRealTimers();
  });
});
