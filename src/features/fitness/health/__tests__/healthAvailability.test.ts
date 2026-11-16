/**
 * No build de verdade o `Constants.expoGoConfig` devolve o manifesto embutido (não nulo).
 * A Saúde não pode confundir isso com o Expo Go, senão o cartão diz "use o app instalado" para todo mundo.
 */
import { getHealthAvailability } from '../healthStore';

// O jest sobe os jest.mock para antes dos imports, então o módulo já carrega com os dublês abaixo.
const mockConstants: Record<string, unknown> = {};

jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: new Proxy({}, { get: (_t, k: string) => mockConstants[k] }),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openURL: jest.fn() } }));

jest.mock(
  'react-native-health-connect',
  () => ({
    getSdkStatus: jest.fn(async () => 1),
    SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  }),
  { virtual: true },
);

const setEnv = (env: Record<string, unknown>) => {
  for (const k of Object.keys(mockConstants)) delete mockConstants[k];
  Object.assign(mockConstants, env);
};

describe('disponibilidade da Saúde', () => {
  it('build instalado com manifesto embutido não é Expo Go', async () => {
    setEnv({ executionEnvironment: 'bare', appOwnership: null, expoGoConfig: { name: 'Operax' }, manifest2: null });
    await expect(getHealthAvailability()).resolves.toBe('not_installed');
  });

  it('Expo Go pede o app instalado', async () => {
    setEnv({ executionEnvironment: 'storeClient', appOwnership: 'expo' });
    await expect(getHealthAvailability()).resolves.toBe('needs_build');
  });

  it('Expo Go que se diz bare também é reconhecido pelo manifesto', async () => {
    setEnv({ executionEnvironment: 'bare', appOwnership: null, manifest2: { extra: { expoGo: { developer: {} } } } });
    await expect(getHealthAvailability()).resolves.toBe('needs_build');
  });
});
