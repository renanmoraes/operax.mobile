import { pathOf, projectRoute } from '../routeProjection';

const pad = { side: 10, top: 10, bottom: 10 };

describe('projectRoute', () => {
  it('cabe na caixa e centraliza', () => {
    const xy = projectRoute(
      [
        [-19.5, -42.6],
        [-19.52, -42.58],
        [-19.54, -42.6],
      ],
      200,
      400,
      pad,
    );
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(pad.side - 0.01);
      expect(p.x).toBeLessThanOrEqual(200 - pad.side + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(pad.top - 0.01);
      expect(p.y).toBeLessThanOrEqual(400 - pad.bottom + 0.01);
    }
    const xs = xy.map((p) => p.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(100, 1);
  });

  it('norte fica em cima', () => {
    const [north, south] = projectRoute(
      [
        [-19.5, -42.6],
        [-19.6, -42.6],
      ],
      100,
      100,
      pad,
    );
    expect(north.y).toBeLessThan(south.y);
  });

  it('um ponto só fica no centro, sem dividir por zero', () => {
    const [p] = projectRoute([[-19.5, -42.6]], 100, 200, pad);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(100, 5);
  });

  it('caixa vazia ou sem pontos não projeta', () => {
    expect(projectRoute([], 100, 100, pad)).toEqual([]);
    expect(projectRoute([[-19.5, -42.6]], 0, 100, pad)).toEqual([]);
  });
});

describe('pathOf', () => {
  it('monta o caminho SVG', () => {
    expect(
      pathOf([
        { x: 1, y: 2 },
        { x: 3.25, y: 4 },
      ]),
    ).toBe('M1.0 2.0 L3.3 4.0');
  });
});
