import { addDaysKey, localDateKey, wallClock, wallDateKey, wallDateLabel, wallDuration, wallIso, wallMinutes, wallParts } from '../wallClock';

describe('horário de parede da agenda', () => {
  it('lê as partes do texto, sem passar pelo fuso do aparelho', () => {
    expect(wallParts('2026-07-20T15:00:00.000Z')).toEqual({ year: 2026, month: 7, day: 20, hours: 15, minutes: 0 });
    expect(wallMinutes('2026-07-20T15:30:00.000Z')).toBe(15 * 60 + 30);
    expect(wallClock('2026-07-20T09:05:00.000Z')).toBe('09:05');
    expect(wallDateKey('2026-07-20T23:59:00.000Z')).toBe('2026-07-20');
    expect(wallParts('lixo')).toBeNull();
    expect(wallMinutes('lixo')).toBe(0);
  });

  it('monta o horário que o servidor espera', () => {
    expect(wallIso('2026-11-17', '14:30')).toBe('2026-11-17T14:30:00.000Z');
  });

  it('soma dias e vira mês e ano', () => {
    expect(addDaysKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysKey('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('dia do aparelho e data por extenso não deslocam o dia', () => {
    expect(localDateKey(new Date(2026, 10, 17, 23, 50))).toBe('2026-11-17');
    expect(wallDateLabel('2026-11-17T00:00:00.000Z', 'pt-BR', { day: '2-digit', month: '2-digit' })).toBe('17/11');
    expect(wallDateLabel('2026-11-17', 'pt-BR', { day: '2-digit', month: '2-digit' })).toBe('17/11');
  });

  it('duração entre dois horários', () => {
    expect(wallDuration('2026-11-17T09:00:00.000Z', '2026-11-17T09:45:00.000Z')).toBe(45);
    expect(wallDuration('2026-11-17T23:30:00.000Z', '2026-11-18T00:15:00.000Z')).toBe(45);
  });
});
