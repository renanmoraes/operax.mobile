import i18n from '@/src/i18n';
import { gpsGate, isPoolChoice, liveSummary, NO_GPS_OFFER_MS, parsePoolLength, restoredBanked, swimDistance } from '../background/liveLogic';
import { bufferedSince, clearBuffer, handleLiveTask, onLiveFixes, trimBuffer } from '../background/liveTracking';
import type { GpsPoint } from '../runTracker';

const mockStore = new Map<string, unknown>();
jest.mock('@/src/shared/db/localDb', () => ({
  kvGet: async (k: string) => (mockStore.has(k) ? mockStore.get(k) : null),
  kvSet: async (k: string, v: unknown) => {
    mockStore.set(k, v);
  },
}));
jest.mock('@/src/shared/telemetry/errorReporter', () => ({ reportError: async () => undefined, trackAction: () => undefined }));

const granted = { perm: 'granted' as const, servicesOn: true, hasFix: true, accuracy: 8, searchingMs: 0 };

describe('Iniciar espera o GPS', () => {
  it('libera só com uma posição de até 25 m', () => {
    expect(gpsGate(granted)).toEqual({ ok: true });
    expect(gpsGate({ ...granted, accuracy: 25 })).toEqual({ ok: true });
    expect(gpsGate({ ...granted, accuracy: 40 })).toEqual({ ok: false, reason: 'weak', offerNoGps: false });
    expect(gpsGate({ ...granted, hasFix: false, accuracy: null })).toEqual({ ok: false, reason: 'searching', offerNoGps: false });
  });

  it('sem permissão pede primeiro; negada ou GPS desligado oferece gravar só o tempo na hora', () => {
    expect(gpsGate({ ...granted, perm: 'unknown' })).toEqual({ ok: false, reason: 'permission', offerNoGps: false });
    expect(gpsGate({ ...granted, perm: 'unknown', searchingMs: NO_GPS_OFFER_MS })).toMatchObject({ reason: 'permission', offerNoGps: true });
    expect(gpsGate({ ...granted, perm: 'denied' })).toEqual({ ok: false, reason: 'denied', offerNoGps: true });
    expect(gpsGate({ ...granted, servicesOn: false })).toEqual({ ok: false, reason: 'servicesOff', offerNoGps: true });
  });

  it('procurando por muito tempo: aparece a saída sem GPS (o aluno não fica preso)', () => {
    expect(gpsGate({ ...granted, hasFix: false, accuracy: null, searchingMs: NO_GPS_OFFER_MS })).toMatchObject({ ok: false, offerNoGps: true });
    expect(gpsGate({ ...granted, accuracy: 60, searchingMs: NO_GPS_OFFER_MS })).toMatchObject({ reason: 'weak', offerNoGps: true });
  });
});

describe('piscina da natação', () => {
  it('lê o tamanho digitado (vírgula ou ponto) dentro de 10 a 100 m', () => {
    expect(parsePoolLength('25')).toBe(25);
    expect(parsePoolLength('33,33')).toBe(33.3);
    expect(parsePoolLength(' 50.0 ')).toBe(50);
    expect(parsePoolLength('')).toBeNull();
    expect(parsePoolLength('5')).toBeNull();
    expect(parsePoolLength('250')).toBeNull();
    expect(parsePoolLength('abc')).toBeNull();
  });

  it('distância = piscinas × tamanho; águas abertas não mede', () => {
    expect(swimDistance({ kind: 'pool', m: 25 }, 40)).toBe(1000);
    expect(swimDistance({ kind: 'pool', m: 33.3 }, 3)).toBe(99.9);
    expect(swimDistance({ kind: 'pool', m: 25 }, 0)).toBe(0);
    expect(swimDistance({ kind: 'open' }, 10)).toBe(0);
    expect(swimDistance(null, 10)).toBe(0);
  });

  it('preferência guardada só vale se for uma escolha válida', () => {
    expect(isPoolChoice({ kind: 'pool', m: 50 })).toBe(true);
    expect(isPoolChoice({ kind: 'open' })).toBe(true);
    expect(isPoolChoice({ kind: 'pool', m: 2 })).toBe(false);
    expect(isPoolChoice(null)).toBe(false);
  });
});

describe('retomar depois de o app ser fechado', () => {
  it('gravando: soma o tempo até o último sinal; pausado: o tempo guardado', () => {
    const d = { banked: 600_000, savedAt: 1_000_000 };
    expect(restoredBanked({ ...d, live: true }, 1_300_000)).toBe(900_000);
    expect(restoredBanked({ ...d, live: false }, 1_300_000)).toBe(600_000);
    expect(restoredBanked({ ...d, live: true }, 900_000)).toBe(600_000);
  });
});

describe('resumo da tela bloqueada', () => {
  beforeAll(() => i18n.changeLanguage('pt'));

  it('com GPS: tempo, distância e ritmo', () => {
    const s = liveSummary({ sport: 'Corrida', paused: false, elapsedS: 1500, gps: true, distanceM: 5000, speed: false, startedAt: Date.now() });
    expect(s.title).toBe('Corrida · gravando');
    expect(s.body).toBe(`25:00 · 5,00 km · 5'00" /km`);
  });

  it('bike mostra velocidade; pausado diz pausado', () => {
    const s = liveSummary({ sport: 'Bike', paused: true, elapsedS: 3600, gps: true, distanceM: 30_000, speed: true, startedAt: Date.now() });
    expect(s.title).toBe('Bike · pausado');
    expect(s.body).toContain('30,0 km/h');
  });

  it('sem GPS: quando começou (o texto não fica velho com a tela apagada)', () => {
    const s = liveSummary({ sport: 'Natação', paused: false, elapsedS: 900, gps: false, distanceM: 0, speed: false, startedAt: new Date(2026, 10, 15, 7, 5).getTime() });
    expect(s.body).toMatch(/^Começou às 07:05/);
  });
});

describe('GPS de segundo plano', () => {
  const loc = (at: number) => ({ timestamp: at, coords: { latitude: -19.9, longitude: -43.9, altitude: null, accuracy: 5, speed: null, heading: null, altitudeAccuracy: null } });

  beforeEach(async () => {
    mockStore.clear();
    await clearBuffer();
  });

  it('entrega os pontos para a gravação e guarda no aparelho até o próximo rascunho', async () => {
    const got: GpsPoint[] = [];
    const off = onLiveFixes((p) => got.push(...p));
    await handleLiveTask({ data: { locations: [loc(1000), loc(2000)] }, error: null });
    off();
    expect(got.map((p) => p.at)).toEqual([1000, 2000]);
    expect((await bufferedSince(0)).map((p) => p.at)).toEqual([1000, 2000]);
    await trimBuffer(1500);
    expect((await bufferedSince(0)).map((p) => p.at)).toEqual([2000]);
  });

  it('sem tela aberta (app fechado no meio) os pontos ficam guardados, sem repetir', async () => {
    await handleLiveTask({ data: { locations: [loc(1000)] }, error: null });
    await handleLiveTask({ data: { locations: [loc(1000), loc(3000)] }, error: null });
    expect((await bufferedSince(500)).map((p) => p.at)).toEqual([1000, 3000]);
    expect((await bufferedSince(1000)).map((p) => p.at)).toEqual([3000]);
  });
});
