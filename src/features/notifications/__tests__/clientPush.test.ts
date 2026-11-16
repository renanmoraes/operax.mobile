import * as portal from '@/src/shared/api/portal.api';
import * as push from '../push';
import { pushLang, registerClientPush, revokeClientPush } from '../clientPush';
import { pushTargetFor } from '@/src/features/permissions/permissions';

jest.mock('@/src/shared/api/portal.api', () => ({ portalRegisterPushToken: jest.fn(), portalRevokePushToken: jest.fn() }));
jest.mock('../push', () => ({ grantedPushToken: jest.fn(), registerForPushNotificationsAsync: jest.fn() }));
jest.mock('@/src/i18n', () => ({ __esModule: true, default: { language: 'es-MX' } }));
jest.mock('@/src/shared/updates/appVersion', () => ({ appVersionInfo: () => ({ version: '1.2.3' }) }));
jest.mock('@/src/features/fitness/health/healthStore', () => ({}));
jest.mock('expo-audio', () => ({}));
jest.mock('expo-image-picker', () => ({}));

const api = portal as jest.Mocked<typeof portal>;
const device = push as jest.Mocked<typeof push>;
const TOKEN = 'ExponentPushToken[aparelho-da-ana]';

beforeEach(() => jest.clearAllMocks());

describe('push do aluno', () => {
  it('ao entrar, registra em silêncio só se a pessoa já deixou notificar, com o idioma do app', async () => {
    device.grantedPushToken.mockResolvedValueOnce(TOKEN);
    await registerClientPush({ prompt: false });
    expect(device.registerForPushNotificationsAsync).not.toHaveBeenCalled();
    expect(api.portalRegisterPushToken).toHaveBeenCalledWith(expect.objectContaining({ token: TOKEN, lang: 'es', app_version: '1.2.3' }));
  });

  it('sem permissão, não pede nem registra; na tela de permissões, pede e registra', async () => {
    device.grantedPushToken.mockResolvedValueOnce(null);
    await registerClientPush({ prompt: false });
    expect(api.portalRegisterPushToken).not.toHaveBeenCalled();
    device.registerForPushNotificationsAsync.mockResolvedValueOnce({ status: 'granted', token: TOKEN });
    await registerClientPush({ prompt: true });
    expect(api.portalRegisterPushToken).toHaveBeenCalledTimes(1);
    device.registerForPushNotificationsAsync.mockResolvedValueOnce({ status: 'denied' });
    await registerClientPush({ prompt: true });
    expect(api.portalRegisterPushToken).toHaveBeenCalledTimes(1);
  });

  it('ao sair, revoga o aparelho; falha de rede não segura a saída', async () => {
    device.grantedPushToken.mockResolvedValueOnce(TOKEN);
    api.portalRevokePushToken.mockRejectedValueOnce(new Error('offline'));
    await expect(revokeClientPush()).resolves.toBeUndefined();
    expect(api.portalRevokePushToken).toHaveBeenCalledWith(TOKEN);
  });

  it('idioma e destino do token', () => {
    expect(pushLang('en-US')).toBe('en');
    expect(pushLang('fr')).toBe('pt');
    expect(pushLang(undefined)).toBe('pt');
    expect(pushTargetFor('live', 'client')).toBe('client');
    expect(pushTargetFor('live', 'staff')).toBe('staff');
    expect(pushTargetFor('mock', 'client')).toBeNull();
    expect(pushTargetFor('live', undefined)).toBeNull();
  });
});
