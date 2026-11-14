import { adherenceStreak, levelFromXp, xpFrom, mergeResultIntoHistory } from '../derive';

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
