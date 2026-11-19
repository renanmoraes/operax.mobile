import { adherenceStreak, bestAdherenceStreak, levelFromXp, xpFrom, mergeResultIntoHistory, mergeDuplicateEntries } from '../derive';

describe('adherenceStreak', () => {
  it('conta dias seguidos cumprindo o plano, descanso conta', () => {
    // do mais antigo para o mais recente (ontem por último)
    expect(adherenceStreak(['missed', 'done', 'done', 'rest', 'rest', 'done'])).toBe(5);
  });

  it('zera quando ontem foi falta', () => {
    expect(adherenceStreak(['done', 'done', 'missed'])).toBe(0);
  });

  it('só descanso não forma sequência', () => {
    expect(adherenceStreak(['rest', 'rest'])).toBe(0);
  });

  it('ignora dia extra como cumprido', () => {
    expect(adherenceStreak(['done', 'extra', 'done'])).toBe(3);
  });
});

describe('nível', () => {
  it('xp soma treinos, recordes e semanas com meta batida', () => {
    expect(xpFrom({ sessions: 10, records: 2, goalWeeks: 1 })).toBe(10 * 50 + 2 * 30 + 120);
  });

  it('nível e progresso até o próximo', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, current: 0, next: 200, label: 'Iniciante' });
    const l = levelFromXp(4740);
    expect(l.level).toBe(7);
    expect(l.current).toBeLessThan(l.next);
    expect(l.label).toBe('Intermediário');
  });
});

describe('treino salvo entra no histórico', () => {
  const base = { workout_id: 'w-a', workout_title: 'Treino A', executed_on: '2026-11-14', created_at: '2026-11-14T10:00:00Z', effort: 8 };
  const sets = (n: number) => ({ kind: 'sets' as const, sets: Array.from({ length: n }, (_, i) => ({ item: 0, set: i, done: true, load_kg: 20, reps: 10 })) });

  it('cria a entrada do dia com séries e volume', () => {
    const h = mergeResultIntoHistory([], { ...base, data: sets(3) });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ date: '2026-11-14', title: 'Treino A', sets_done: 3, volume_kg: 600, effort: 8 });
  });

  it('soma outro bloco do mesmo treino no mesmo dia sem duplicar', () => {
    const once = mergeResultIntoHistory([], { ...base, data: sets(3) });
    const twice = mergeResultIntoHistory(once, { ...base, data: sets(2), effort: 9 });
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ sets_done: 5, volume_kg: 1000, effort: 9 });
  });
});

describe('maior sequência', () => {
  it('pega o maior trecho sem falta, contando descanso só junto de treino', () => {
    expect(bestAdherenceStreak(['done', 'rest', 'done', 'missed', 'done', 'missed'])).toBe(3);
    expect(bestAdherenceStreak(['rest', 'rest', 'missed'])).toBe(0);
    expect(bestAdherenceStreak(['missed', 'done', 'done', 'done', 'done'])).toBe(4);
  });
});

describe('mergeDuplicateEntries', () => {
  const base = { kind: 'free' as const, date: '2026-11-18', title: 'Corrida', modality: 'run', effort: null };
  const garmin = { ...base, id: 's:g', started_at: '2026-11-18T10:00:00Z', duration_seconds: 1800, distance_meters: 5000, avg_hr: 150, session_id: 'g', sources: [{ origin: 'garmin' as const, label: 'Garmin Forerunner 265', device: 'Forerunner 265' }] };
  const strava = { ...base, id: 's:s', started_at: '2026-11-18T10:02:00Z', duration_seconds: 1750, distance_meters: 5050, avg_hr: null, session_id: 's', sources: [{ origin: 'strava' as const, label: 'Strava' }] };

  it('junta o mesmo treino do Garmin e do Strava, com os dois selos e os números do relógio', () => {
    const out = mergeDuplicateEntries([strava, garmin]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('s:g');
    expect(out[0].distance_meters).toBe(5000);
    expect(out[0].sources.map((s) => s.origin)).toEqual(['garmin', 'strava']);
  });

  it('não copia número do Strava para o treino do relógio', () => {
    const out = mergeDuplicateEntries([{ ...garmin, avg_hr: null }, { ...strava, avg_hr: 140 }]);
    expect(out[0].avg_hr).toBeNull();
  });

  it('mantém separados treinos de horários ou esportes diferentes', () => {
    expect(mergeDuplicateEntries([garmin, { ...strava, started_at: '2026-11-18T11:00:00Z' }])).toHaveLength(2);
    expect(mergeDuplicateEntries([garmin, { ...strava, modality: 'bike' }])).toHaveLength(2);
    expect(mergeDuplicateEntries([garmin, { ...strava, duration_seconds: 600, distance_meters: 1500 }])).toHaveLength(2);
  });

  it('natação: tempo total do relógio e tempo nadando do Strava, mesma largada e distância, viram uma entrada', () => {
    const swimG = { ...garmin, modality: 'swim', started_at: '2026-11-18T10:13:57Z', duration_seconds: 2503, distance_meters: 675 };
    const swimS = { ...strava, modality: 'swim', started_at: '2026-11-18T10:13:58Z', duration_seconds: 687, distance_meters: 675 };
    const out = mergeDuplicateEntries([swimS, swimG]);
    expect(out).toHaveLength(1);
    expect(out[0].duration_seconds).toBe(2503);
  });

  it('o treino prescrito fica e ganha o selo do Strava', () => {
    const prescribed = { ...garmin, id: 'w:1:2026-11-18', kind: 'prescribed' as const, title: 'Rodagem', modality: 'run' };
    const out = mergeDuplicateEntries([strava, prescribed]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('w:1:2026-11-18');
    expect(out[0].sources.map((s) => s.origin)).toEqual(['garmin', 'strava']);
  });
});
