import { formatClock, formatDistance, formatDuration, formatKg, minutesUntilLabel, timeAgo } from '../format';

describe('format', () => {
  it('formatDuration em minutos e horas', () => {
    expect(formatDuration(1860)).toBe('31 min');
    expect(formatDuration(3720)).toBe('62 min');
    expect(formatDuration(6000)).toBe('1h 40');
    expect(formatDuration(null)).toBe('—');
  });

  it('formatDistance em km com vírgula', () => {
    expect(formatDistance(5120)).toBe('5,1 km');
    expect(formatDistance(800)).toBe('800 m');
  });

  it('formatClock mm:ss', () => {
    expect(formatClock(1122)).toBe('18:42');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('formatKg sem zero sobrando', () => {
    expect(formatKg(37.5)).toBe('37,5');
    expect(formatKg(40)).toBe('40');
  });

  it('timeAgo relativo', () => {
    const now = new Date('2026-11-19T10:00:00Z').getTime();
    expect(timeAgo('2026-11-19T09:59:30Z', now)).toBe('agora');
    expect(timeAgo('2026-11-19T08:00:00Z', now)).toBe('há 2 h');
    expect(timeAgo('2026-11-17T10:00:00Z', now)).toBe('há 2 dias');
  });

  it('minutesUntilLabel para o próximo compromisso', () => {
    const now = new Date('2026-11-19T10:00:00Z').getTime();
    expect(minutesUntilLabel('2026-11-19T10:45:00Z', now)).toBe('em 45 min');
    expect(minutesUntilLabel('2026-11-19T12:30:00Z', now)).toBe('em 2h 30');
    expect(minutesUntilLabel('2026-11-19T09:50:00Z', now)).toBe('agora');
  });
});
