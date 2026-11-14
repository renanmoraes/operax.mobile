import axios from 'axios';
import { flushErrors, reportError, setReporterSession, trackRoute } from '../errorReporter';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: null, readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn() }));
jest.mock('expo-battery', () => ({ getBatteryLevelAsync: jest.fn(async () => 0.37), getBatteryStateAsync: jest.fn(async () => 1), isLowPowerModeEnabledAsync: jest.fn(async () => false) }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true })) }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.0', nativeBuildVersion: '42' }));
jest.mock('expo-device', () => ({ osName: 'Android', osVersion: '12', brand: 'google', modelName: 'Pixel 7', isDevice: true, totalMemory: 8 * 1024 ** 3 }));
jest.mock('@/src/shared/api/token-store', () => ({ getSavedRole: jest.fn(async () => 'staff'), getAccessToken: jest.fn(async () => 'tok') }));

const post = axios.post as jest.Mock;

describe('logs de erro do celular', () => {
  beforeEach(() => post.mockReset());

  it('manda o erro com o retrato do aparelho e o token da sessão', async () => {
    post.mockResolvedValue({ data: { accepted: 1 } });
    trackRoute('/inbox');
    trackRoute('/conversation/abc');
    setReporterSession({ role: 'staff', mode: 'live', tenant: 't1' });
    await reportError(new TypeError('x is undefined'), { context: 'tela' });
    await flushErrors();
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, cfg] = post.mock.calls[0];
    expect(url).toMatch(/\/api\/mobile\/logs$/);
    expect(cfg.headers.Authorization).toBe('Bearer tok');
    const e = body.entries[0];
    expect(e).toMatchObject({ level: 'error', message: 'TypeError: x is undefined', context: 'tela' });
    expect(e.meta).toMatchObject({
      app: { native_version: '1.2.0', build: '42' },
      device: { model: 'Pixel 7', os_version: '12', emulator: false, memory_gb: 8 },
      network: { type: 'wifi', connected: true },
      battery: { level: 0.37, state: 'unplugged', low_power: false },
      screen: '/conversation/abc',
      recent_screens: ['/inbox', '/conversation/abc'],
      session: { role: 'staff', mode: 'live', tenant: 't1' },
    });
  });

  it('o mesmo erro repetido em sequência conta uma vez', async () => {
    post.mockResolvedValue({});
    await reportError('Falhou igual', { context: 'x' });
    await reportError('Falhou igual', { context: 'x' });
    await flushErrors();
    expect(post.mock.calls[0][1].entries).toHaveLength(1);
  });

  it('sem internet guarda e manda depois', async () => {
    post.mockRejectedValueOnce(new Error('Network Error'));
    await reportError('Erro offline', { context: 'y' });
    await flushErrors();
    post.mockResolvedValue({});
    await flushErrors();
    const last = post.mock.calls[post.mock.calls.length - 1][1].entries;
    expect(last.map((x: { message: string }) => x.message)).toContain('Erro offline');
  });
});
