export type XY = { x: number; y: number };

/** Trecho curto (ou só um ponto): enquadra ao menos ~150 m, centrado, para não virar um ponto no canto. */
const MIN_SPAN = 0.0014;

/**
 * Projeta pontos [latitude, longitude] numa caixa w×h, mantendo a proporção e centrando o percurso.
 * Projeção plana: a longitude encolhe com o cosseno da latitude, senão o percurso sai esticado.
 */
export function projectRoute(
  points: [number, number][],
  w: number,
  h: number,
  pad: { side: number; top: number; bottom: number },
): XY[] {
  if (!w || !h || points.length === 0) return [];
  const lat0 = points.reduce((a, p) => a + p[0], 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p[1] * k);
  const ys = points.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, MIN_SPAN);
  const spanY = Math.max(maxY - minY, MIN_SPAN);
  const scale = Math.min((w - pad.side * 2) / spanX, Math.max(40, h - pad.top - pad.bottom) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const midY = pad.top + (h - pad.top - pad.bottom) / 2;
  return points.map((_, i) => ({ x: w / 2 + (xs[i] - cx) * scale, y: midY + (ys[i] - cy) * scale }));
}

export function pathOf(xy: XY[]): string {
  return xy.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
