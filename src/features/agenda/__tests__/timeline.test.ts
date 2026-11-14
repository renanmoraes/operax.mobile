import { buildAxis, clockLabel, HOUR_H, hourRange, layoutEvents, MIN_EVENT_H, relativeLabel, toMinutes, yAt } from '../timeline';

const linear = buildAxis([], 7, 20);

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
    const [e] = layoutEvents([{ id: 'a', startMin: 9 * 60, endMin: 10 * 60 }], linear);
    expect(e.top).toBe(2 * HOUR_H);
    expect(e.height).toBe(HOUR_H - 3);
    const [short] = layoutEvents([{ id: 'b', startMin: 9 * 60, endMin: 9 * 60 + 10 }], linear);
    expect(short.height).toBe(MIN_EVENT_H);
    expect(yAt(linear, 7 * 60 + 30)).toBe(HOUR_H / 2);
  });

  it('estica só o trecho do compromisso que precisa de mais altura para o texto inteiro', () => {
    const ev = { id: 'a', startMin: 14 * 60, endMin: 14 * 60 + 30, need: 120 };
    const axis = buildAxis([ev], 7, 20);
    const [placed] = layoutEvents([ev], axis);
    expect(placed.height).toBeGreaterThanOrEqual(120 - 3);
    // antes dele, a escala continua igual; depois, tudo desce junto (sem sobrepor)
    expect(yAt(axis, 10 * 60)).toBe(yAt(linear, 10 * 60));
    expect(yAt(axis, 15 * 60) - yAt(linear, 15 * 60)).toBeCloseTo(120 - HOUR_H / 2);
    // compromisso que já cabe não mexe em nada
    expect(buildAxis([{ id: 'b', startMin: 600, endMin: 660, need: 40 }], 7, 20).ys.at(-1)).toBe(linear.ys.at(-1));
  });

  it('compromissos curtos seguidos não se sobrepõem (altura mínima entra na escala)', () => {
    const evs = [
      { id: 'a', startMin: 540, endMin: 555 },
      { id: 'b', startMin: 555, endMin: 570 },
    ];
    const [a, b] = layoutEvents(evs, buildAxis(evs, 7, 20));
    expect(a.lane).toBe(b.lane);
    expect(b.top).toBeGreaterThanOrEqual(a.top + a.height);
  });

  it('divide em colunas só quem se sobrepõe', () => {
    const placed = layoutEvents(
      [
        { id: 'a', startMin: 600, endMin: 660 },
        { id: 'b', startMin: 630, endMin: 690 },
        { id: 'c', startMin: 700, endMin: 730 },
      ],
      linear,
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
