import { fromHistoryDetail, fromRecording, fromStrength } from '../fromSources';
import type { ActivityDetail, FitnessHistoryEntry } from '@/src/features/fitness/types';

const entry = (over: Partial<FitnessHistoryEntry> = {}): FitnessHistoryEntry => ({
  id: 'e1',
  kind: 'free',
  date: '2026-11-15',
  started_at: '2026-11-15T07:00:00Z',
  title: 'Corrida matinal',
  modality: 'run',
  duration_seconds: 1800,
  distance_meters: 5000,
  avg_hr: 150,
  effort: null,
  sources: [],
  ...over,
});

const detail = (over: Partial<ActivityDetail> = {}): ActivityDetail => ({
  sport: 'run',
  route: [
    [-19.5, -42.6],
    [-19.51, -42.61],
  ],
  rate_unit: 'min_km',
  seconds: 1795,
  summary: { avg_hr: 152, max_hr: 171, elevation_gain_m: 40, avg_cadence: null, avg_power: null },
  splits: [
    { index: 1, seconds: 360, distance_m: 1000, rate: 360, avg_hr: null },
    { index: 2, seconds: 355, distance_m: 1000, rate: 355, avg_hr: null },
  ],
  split_basis: 'distance',
  ...over,
});

describe('fromHistoryDetail', () => {
  it('atividade com rota vira gps com ritmo, FC e parciais do detalhe', () => {
    const a = fromHistoryDetail(entry(), detail(), 'Academia Demo');
    expect(a.kind).toBe('gps');
    expect(a.strength).toBeUndefined();
    expect(a.seconds).toBe(1800); // o tempo em movimento do histórico, igual ao da tela do treino
    expect(a.date).toBe('2026-11-15T07:00:00Z');
    expect(a.gps?.rateLabel).toBe(a.gps?.paceLabel);
    expect(a.gps?.paceLabel).toMatch(/\/km$/);
    expect(a.gps?.avgHr).toBe(152);
    expect(a.gps?.maxHr).toBe(171);
    expect(a.gps?.elevationGainM).toBe(40);
    expect(a.gps?.splits).toEqual([
      { index: 1, seconds: 360 },
      { index: 2, seconds: 355 },
    ]);
  });

  it('natação parada na borda: ritmo por 100 m com o tempo em movimento, e o título diz que são voltas', () => {
    // 680 m em 11:27 em movimento; as amostras do relógio somam 41:44 com as pausas.
    const a = fromHistoryDetail(
      entry({ modality: 'swim', duration_seconds: 687, distance_meters: 680 }),
      detail({ sport: 'swim', route: [], rate_unit: 'min_100m', seconds: 2504, split_basis: 'laps' }),
      'X',
    );
    expect(a.seconds).toBe(687);
    expect(a.gps?.paceLabel).toBe('1\'41" /100 m');
    expect(a.gps?.splitsKind).toBe('laps');
  });

  it('uma volta só (o treino inteiro) não vira parcial na arte', () => {
    const a = fromHistoryDetail(entry(), detail({ splits: [{ index: 1, seconds: 1800, distance_m: 5000, rate: 360, avg_hr: null }], split_basis: 'laps' }), 'X');
    expect(a.gps?.splits).toEqual([]);
  });

  it('remo sai em ritmo por 500 m', () => {
    const a = fromHistoryDetail(entry({ modality: 'row', duration_seconds: 1200, distance_meters: 5000 }), detail({ sport: 'row', rate_unit: 'min_500m' }), 'X');
    expect(a.gps?.paceLabel).toBe('2\'00" /500 m');
  });

  it('pedal usa velocidade como número principal', () => {
    const a = fromHistoryDetail(entry({ modality: 'bike' }), detail({ rate_unit: 'kmh' }), 'X');
    expect(a.gps?.rateLabel).toBe(a.gps?.speedLabel);
    expect(a.gps?.speedLabel).toMatch(/km\/h$/);
  });

  it('sem detalhe usa os dados da entrada e listas vazias', () => {
    const a = fromHistoryDetail(entry(), null, 'X');
    expect(a.kind).toBe('gps');
    expect(a.seconds).toBe(1800);
    expect(a.gps?.route).toEqual([]);
    expect(a.gps?.splits).toEqual([]);
    expect(a.gps?.avgHr).toBe(150);
    expect(a.gps?.maxHr).toBeNull();
  });

  it('sem rota nem distância vira academia com o que a entrada tiver', () => {
    const a = fromHistoryDetail(entry({ distance_meters: null, volume_kg: 3200, sets_done: 12 }), null, 'X');
    expect(a.kind).toBe('strength');
    expect(a.gps).toBeUndefined();
    expect(a.strength).toEqual({ volumeKg: 3200, setsDone: 12, setsTotal: null, records: [], volumeHistory: [] });
  });

  it('sem volume nem séries fica null, nunca undefined', () => {
    const a = fromHistoryDetail(entry({ distance_meters: null }), null, 'X');
    expect(a.strength?.volumeKg).toBeNull();
    expect(a.strength?.setsDone).toBeNull();
  });
});

describe('fromRecording', () => {
  it('calcula as parciais pelos tempos acumulados de cada km', () => {
    const a = fromRecording(
      { title: 'Corrida', company: 'X', date: '2026-11-15T07:00:00Z', seconds: 700 },
      { sport: 'run', preferSpeed: false, distanceM: 2100, elevationGainM: 12, route: [], kmMarks: [340_000, 690_000] },
    );
    expect(a.gps?.splits).toEqual([
      { index: 1, seconds: 340 },
      { index: 2, seconds: 350 },
    ]);
    expect(a.gps?.elevationGainM).toBe(12);
  });

  it('distância curta não inventa ritmo', () => {
    const a = fromRecording(
      { title: 'Corrida', company: 'X', date: '2026-11-15', seconds: 30 },
      { sport: 'run', preferSpeed: false, distanceM: 5, elevationGainM: 0, route: [], kmMarks: [] },
    );
    expect(a.gps?.paceLabel).toBeNull();
    expect(a.gps?.rateLabel).toBe('–');
  });
});

describe('fromStrength', () => {
  it('preenche o que faltar com null e listas vazias', () => {
    const a = fromStrength({ title: 'Treino A', company: 'X', date: '2026-11-15', seconds: 3000 }, { volumeKg: 4320 });
    expect(a.strength).toEqual({ volumeKg: 4320, setsDone: null, setsTotal: null, records: [], volumeHistory: [] });
  });
});
