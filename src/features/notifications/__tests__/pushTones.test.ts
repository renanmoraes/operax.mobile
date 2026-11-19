jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.1.0' } } }));
jest.mock('@/src/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('@/src/shared/telemetry/errorReporter', () => ({ reportError: jest.fn() }));
jest.mock('../presence', () => ({ foregroundNotificationHandler: jest.fn() }));

import { hasBundledSounds, PUSH_TONES } from '../push';

describe('toques do push', () => {
  it('só o app a partir do 1.2.0 traz os arquivos de som', () => {
    expect(hasBundledSounds('1.1.0')).toBe(false);
    expect(hasBundledSounds('1.1.9')).toBe(false);
    expect(hasBundledSounds('1.2.0')).toBe(true);
    expect(hasBundledSounds('1.10.0')).toBe(true);
    expect(hasBundledSounds('2.0.0')).toBe(true);
    expect(hasBundledSounds(undefined)).toBe(false);
  });

  it('fila, chat assumido e alerta, os mesmos nomes que o servidor usa nos canais', () => {
    expect([...PUSH_TONES]).toEqual(['fila', 'assumido', 'alerta']);
  });
});
