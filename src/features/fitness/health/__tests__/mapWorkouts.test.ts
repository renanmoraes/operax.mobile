import { fromAppleWorkout, fromHealthConnectSession, sportFromApple, sportFromHealthConnect } from '../mapWorkouts';

describe('mapeia treinos do Saúde (iPhone) e do Health Connect (Android)', () => {
  it('traduz o tipo de atividade da Apple', () => {
    expect(sportFromApple(37)).toBe('Corrida');
    expect(sportFromApple(50)).toBe('Musculação');
    expect(sportFromApple(9999)).toBe('Treino');
  });

  it('traduz o tipo de exercício do Health Connect', () => {
    expect(sportFromHealthConnect(56)).toBe('Corrida');
    expect(sportFromHealthConnect(81)).toBe('Musculação');
    expect(sportFromHealthConnect(-1)).toBe('Treino');
  });

  it('converte um treino da Apple com distância em km e aparelho', () => {
    const w = fromAppleWorkout(
      {
        uuid: 'A1',
        workoutActivityType: 37,
        startDate: new Date('2026-11-14T08:00:00Z'),
        endDate: new Date('2026-11-14T08:31:00Z'),
        duration: { unit: 's', quantity: 1860 },
        totalDistance: { unit: 'km', quantity: 5.12 },
        totalEnergyBurned: { unit: 'kcal', quantity: 410 },
        device: { name: 'Apple Watch', model: 'Watch7,1' },
      },
      152,
    );
    expect(w).toEqual({
      source: 'apple_health',
      external_id: 'A1',
      sport: 'Corrida',
      started_at: '2026-11-14T08:00:00.000Z',
      duration_seconds: 1860,
      distance_meters: 5120,
      energy_kcal: 410,
      avg_hr: 152,
      device: 'Apple Watch',
    });
  });

  it('aceita distância em metros e treino sem aparelho', () => {
    const w = fromAppleWorkout({
      uuid: 'A2',
      workoutActivityType: 50,
      startDate: new Date('2026-11-14T10:00:00Z'),
      endDate: new Date('2026-11-14T10:45:00Z'),
      duration: { unit: 's', quantity: 2700 },
      totalDistance: { unit: 'm', quantity: 0 },
    });
    expect(w.distance_meters).toBeNull();
    expect(w.device).toBeNull();
    expect(w.avg_hr).toBeNull();
  });

  it('converte uma sessão do Health Connect com a origem (Samsung Health)', () => {
    const w = fromHealthConnectSession(
      {
        startTime: '2026-11-14T07:00:00.000Z',
        endTime: '2026-11-14T07:40:00.000Z',
        exerciseType: 79,
        metadata: { id: 'HC1', dataOrigin: 'com.sec.android.app.shealth', device: { manufacturer: 'Samsung', model: 'Galaxy Watch6' } },
      },
      { distance_meters: 3300, avg_hr: 104 },
    );
    expect(w).toEqual({
      source: 'health_connect',
      external_id: 'HC1',
      sport: 'Caminhada',
      started_at: '2026-11-14T07:00:00.000Z',
      duration_seconds: 2400,
      distance_meters: 3300,
      energy_kcal: null,
      avg_hr: 104,
      device: 'Samsung Galaxy Watch6',
      origin: 'Samsung Health',
    });
  });
});
