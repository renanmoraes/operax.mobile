import axios from 'axios';
import { flushErrors, reportError, setReporterSession, trackAction, trackRoute } from '../errorReporter';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('expo-battery', () => ({ getBatteryLevelAsync: jest.fn(async () => 0.37), getBatteryStateAsync: jest.fn(async () => 1), isLowPowerModeEnabledAsync: jest.fn(async () => false) }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true })) }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.0', nativeBuildVersion: '42' }));
jest.mock('expo-device', () => ({ osName: 'Android', osVersion: '12', brand: 'google', modelName: 'Pixel 7', isDevice: true, totalMemory: 8 * 1024 ** 3 }));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getLastKnownPositionAsync: jest.fn(async () => ({ coords: { latitude: -19.923456, longitude: -43.938765, accuracy: 12.4, altitude: 852.6 }, timestamp: 1_700_000_000_000 })),
}));
jest.mock('@/src/shared/api/token-store', () => ({ getSavedRole: jest.fn(async () => 'staff'), getAccessToken: jest.fn(async () => 'tok') }));

// Banco local em memória (o real é SQLite no aparelho).
jest.mock('@/src/shared/db/localDb', () => {
  const rows: { id: number; created_at: string; level: string; message: string; trace: string | null; context: string | null; meta: string; attempts: number; sent: boolean }[] = [];
  const crumbs: unknown[] = [];
  let seq = 1;
  return {
    insertError: jest.fn(async (e) => void rows.push({ id: seq++, ...e, trace: e.trace ?? null, context: e.context ?? null, meta: JSON.stringify(e.meta), attempts: 0, sent: false })),
    pendingErrors: jest.fn(async (n: number) => rows.filter((r) => !r.sent).slice(0, n)),
    markErrorsSent: jest.fn(async (ids: number[]) => rows.forEach((r) => ids.includes(r.id) && (r.sent = true))),
    bumpErrorAttempts: jest.fn(async (ids: number[]) => rows.forEach((r) => ids.includes(r.id) && (r.attempts += 1))),
    addBreadcrumb: jest.fn(async (b) => void crumbs.push(b)),
    recentBreadcrumbs: jest.fn(async () => crumbs.slice(-25)),
  };
});

const post = axios.post as jest.Mock;

describe('logs de erro do celular', () => {
  beforeEach(() => post.mockReset());

  it('manda o erro com aparelho, localização, sessão e as últimas ações', async () => {
    post.mockResolvedValue({ data: { accepted: 1 } });
    trackRoute('/inbox');
    trackRoute('/conversation/abc');
    trackAction('Enviar');
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
      location: { lat: -19.9235, lng: -43.9388, accuracy_m: 12, altitude_m: 853 },
      screen: '/conversation/abc',
      session: { role: 'staff', mode: 'live', tenant: 't1' },
    });
    expect(e.meta.breadcrumbs.map((b: { label: string }) => b.label)).toEqual(['/inbox', '/conversation/abc', '/conversation/abc · Enviar']);
  });

  it('o mesmo erro repetido em sequência conta uma vez', async () => {
    post.mockResolvedValue({});
    await reportError('Falhou igual', { context: 'x' });
    await reportError('Falhou igual', { context: 'x' });
    await flushErrors();
    expect(post.mock.calls[0][1].entries).toHaveLength(1);
  });

  it('sem internet fica no banco local e vai depois, contando as tentativas', async () => {
    post.mockRejectedValueOnce(new Error('Network Error'));
    await reportError('Erro offline', { context: 'y' });
    await flushErrors();
    post.mockResolvedValue({});
    await flushErrors();
    const last = post.mock.calls[post.mock.calls.length - 1][1].entries;
    const e = last.find((x: { message: string }) => x.message === 'Erro offline');
    expect(e.meta.send_attempts).toBe(2);
  });
});
