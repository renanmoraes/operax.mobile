import { clockLabel, HOUR_H, hourRange, layoutEvents, MIN_EVENT_H, relativeLabel, toMinutes, yFor } from '../timeline';

describe('linha do tempo da agenda', () => {
  it('converte "HH:MM" e ISO em minutos do dia', () => {
    expect(toMinutes('14:30')).toBe(870);
    expect(toMinutes(new Date(2026, 10, 14, 9, 5).toISOString())).toBe(545);
  });

  it('abre a faixa de horas para caber compromissos e a hora atual', () => {
    expect(hourRange([], 12 * 60)).toEqual([7, 20]);
    expect(hourRange([{ id: 'a', startMin: 6 * 60 + 30, endMin: 7 * 60 }], 12 * 60)).toEqual([6, 20]);
    expect(hourRange([], 22 * 60 + 10)).toEqual([7, 23]);
  });

  it('posiciona pelo horário, com altura mínima para leitura', () => {
    const [e] = layoutEvents([{ id: 'a', startMin: 9 * 60, endMin: 10 * 60 }], 7);
    expect(e.top).toBe(2 * HOUR_H);
    expect(e.height).toBe(HOUR_H - 3);
    const [short] = layoutEvents([{ id: 'b', startMin: 9 * 60, endMin: 9 * 60 + 10 }], 7);
    expect(short.height).toBe(MIN_EVENT_H);
    expect(yFor(7 * 60 + 30, 7)).toBe(HOUR_H / 2);
  });

  it('divide em colunas só quem se sobrepõe', () => {
    const placed = layoutEvents(
      [
        { id: 'a', startMin: 600, endMin: 660 },
        { id: 'b', startMin: 630, endMin: 690 },
        { id: 'c', startMin: 700, endMin: 730 },
      ],
      7,
    );
    const by = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect([by.a.lane, by.a.lanes]).toEqual([0, 2]);
    expect([by.b.lane, by.b.lanes]).toEqual([1, 2]);
    expect([by.c.lane, by.c.lanes]).toEqual([0, 1]);
  });

  it('marca o compromisso em andamento e o próximo', () => {
    expect(relativeLabel(600, 660, 630)).toBe('Agora');
    expect(relativeLabel(600, 660, 580)).toBe('Em 20 min');
    expect(relativeLabel(600, 660, 400)).toBeNull();
    expect(clockLabel(12 * 60 + 19.7)).toBe('12:19');
  });
});
