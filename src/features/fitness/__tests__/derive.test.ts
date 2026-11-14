import { adherenceStreak, levelFromXp, xpFrom } from '../derive';

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
