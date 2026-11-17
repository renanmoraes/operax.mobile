jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.1.0', nativeBuildVersion: '10' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.1.0' } } }));
jest.mock('expo-updates', () => ({ isEnabled: true, isEmbeddedLaunch: false, updateId: '01a1e6c2-3b09-7687-a3f3-0a1ffdcf0567', channel: 'production', createdAt: new Date('2026-11-16T23:50:00Z') }));

import { appVersionHeader, appVersionInfo } from '../versionInfo';

describe('versão do app', () => {
  it('cabeçalho leva versão, build da loja e a atualização pelo ar em uso', () => {
    expect(appVersionInfo()).toMatchObject({ version: '1.1.0', build: '10', update: '01a1e6c2', channel: 'production' });
    expect(appVersionHeader()).toBe('1.1.0 (10) 01a1e6c2');
  });

  it('sem build conhecido e com a versão do instalador', () => {
    expect(appVersionHeader({ version: '1.1.0', build: null, update: 'embutida', channel: null, updatedAt: null })).toBe('1.1.0 embutida');
  });
});
