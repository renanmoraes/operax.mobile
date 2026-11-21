import { cardPose, dragProgress, settleTarget, sideOf } from '../deckMath';

const d = { exitX: -340, sideX: 150 };

describe('baralho de conquistas', () => {
  it('a carta da frente fica no centro, inteira e sem escurecer', () => {
    const front = cardPose(0, 1, d);
    for (const k of ['x', 'y', 'rot', 'dim'] as const) expect(front[k]).toBeCloseTo(0);
    expect(front.scale).toBe(1);
    expect(front.opacity).toBe(1);
  });

  it('quem sai acompanha o dedo para a esquerda e some só no fim', () => {
    const half = cardPose(-0.5, 1, d);
    expect(half.x).toBe(-170);
    expect(half.opacity).toBe(1);
    expect(half.rot).toBeLessThan(0);
    expect(cardPose(-1, 1, d).opacity).toBe(0);
    expect(cardPose(-3, 1, d).x).toBe(-340);
  });

  it('quem espera fica de lado (ímpar à direita, par à esquerda), menor e escurecida', () => {
    expect(sideOf(1)).toBe(1);
    expect(sideOf(2)).toBe(-1);
    const right = cardPose(1, sideOf(1), d);
    const left = cardPose(2, sideOf(2), d);
    expect(right.x).toBe(150);
    expect(left.x).toBe(-150);
    expect(right.scale).toBeLessThan(1);
    expect(left.scale).toBeLessThan(right.scale);
    expect(left.dim).toBeGreaterThan(right.dim);
    expect(right.opacity).toBe(1);
  });

  it('a pose é contínua nas viradas (a carta não dá pulo ao trocar de faixa)', () => {
    for (const edge of [0, 1, 2]) {
      const a = cardPose(edge - 1e-6, 1, d);
      const b = cardPose(edge + 1e-6, 1, d);
      for (const k of ['x', 'y', 'rot', 'scale', 'opacity', 'dim'] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.01);
    }
  });

  it('da terceira em diante fica escondida atrás do baralho', () => {
    expect(cardPose(3, 1, d).opacity).toBe(0);
    expect(cardPose(7, -1, d).opacity).toBe(0);
  });

  it('arrastar para a esquerda avança e nunca passa mais de uma carta por gesto', () => {
    expect(dragProgress(0, 0, -170, 340, 4).progress).toBeCloseTo(0.5);
    expect(dragProgress(0, 0, -900, 340, 4).progress).toBe(1);
    expect(dragProgress(2, 2, 900, 340, 4).progress).toBe(1);
  });

  it('no começo e no fim a carta só cede um pouco (elástico), sem trocar', () => {
    const first = dragProgress(0, 0, 100, 340, 4);
    expect(first.progress).toBe(0);
    expect(first.pull).toBeGreaterThan(0);
    expect(first.pull).toBeLessThan(100);
    const last = dragProgress(3, 3, -100, 340, 4);
    expect(last.progress).toBe(3);
    expect(last.pull).toBeLessThan(0);
    expect(dragProgress(1, 1, -50, 340, 4).pull).toBeCloseTo(0);
  });

  it('ao soltar: passa com arrasto longo ou peteleco, volta com arrasto curto e respeita as pontas', () => {
    expect(settleTarget(1, 0.4, 0, 4)).toBe(2);
    expect(settleTarget(1, 0.1, 0, 4)).toBe(1);
    expect(settleTarget(1, 0.1, 2, 4)).toBe(2);
    expect(settleTarget(1, -0.4, 0, 4)).toBe(0);
    expect(settleTarget(1, -0.05, -2, 4)).toBe(0);
    expect(settleTarget(3, 0, 5, 4)).toBe(3);
    expect(settleTarget(0, 0, -5, 4)).toBe(0);
  });

  it('dois deslizes seguidos passam duas cartas, mesmo com a primeira ainda no meio do caminho', () => {
    // o baralho já ia para a carta 1, mas a animação está em 0,4 quando o dedo volta a arrastar
    const drag = dragProgress(0.4, 1, -190, 340, 4);
    expect(drag.progress).toBeCloseTo(0.4 + 190 / 340);
    expect(settleTarget(1, drag.progress - 0.4, 0, 4)).toBe(2);
  });
});
