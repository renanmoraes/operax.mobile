import { healthKey, pendingBatches, rememberSent } from '../healthSend';
import type { HealthWorkout } from '../mapWorkouts';

const w = (id: string, extra: Partial<HealthWorkout> = {}): HealthWorkout => ({
  source: 'health_connect', external_id: id, sport: 'Corrida', sport_key: 'running', started_at: '2026-11-14T08:00:00.000Z',
  duration_seconds: 1800, distance_meters: 5000, energy_kcal: null, avg_hr: null, device: null, ...extra,
});

describe('envio dos treinos do Saúde ao Operax', () => {
  it('manda só o que ainda não foi', () => {
    const list = [w('a'), w('b'), w('c')];
    expect(pendingBatches(list, [healthKey(list[1])])).toEqual([[list[0], list[2]]]);
  });
  it('nunca manda treino gravado pelo Strava', () => {
    expect(pendingBatches([w('a', { origin_package: 'com.strava', origin: 'Strava' }), w('b')], [])).toEqual([[w('b')]]);
  });
  it('separa em lotes de 100', () => {
    const many = Array.from({ length: 230 }, (_, i) => w(String(i)));
    expect(pendingBatches(many, []).map((b) => b.length)).toEqual([100, 100, 30]);
  });
  it('a mesma origem e id não se confunde com outra fonte', () => {
    expect(pendingBatches([w('x', { source: 'apple_health' })], ['health_connect:x'])).toHaveLength(1);
  });
  it('guarda os enviados sem repetir e com limite', () => {
    const sent = rememberSent(['health_connect:a'], [w('a'), w('b')]);
    expect(sent).toEqual(['health_connect:a', 'health_connect:b']);
    const long = rememberSent(Array.from({ length: 499 }, (_, i) => `k${i}`), [w('n1'), w('n2')]);
    expect(long).toHaveLength(500);
    expect(long.at(-1)).toBe('health_connect:n2');
  });
});
