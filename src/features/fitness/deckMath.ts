/**
 * Geometria do baralho de conquistas. Tudo sai de um número só, `progress` (o índice da carta da frente, com
 * fração enquanto o dedo arrasta): cada carta calcula sua pose pela distância até ele (`rel = índice − progress`).
 *
 * - `rel = 0`: na frente, no centro, inteira.
 * - `rel` de 0 a −1: saindo pela esquerda atrás do dedo (gira e some no fim).
 * - `rel = 1` e `2`: esperando a vez atrás, de lado, menores e escurecidas. O lado alterna pelo índice
 *   (ímpar à direita, par à esquerda), então as que esperam nunca se cruzam.
 * - `rel ≥ 3`: escondida atrás do baralho.
 *
 * As funções rodam na thread de animação (`'worklet'`) e também no teste, como funções comuns.
 */

export type DeckDims = {
  /** Até onde a carta vai para sumir pela esquerda (negativo). O dedo anda essa mesma distância por carta. */
  exitX: number;
  /** Deslocamento lateral de quem espera a vez. */
  sideX: number;
};

export type CardPose = { x: number; y: number; rot: number; scale: number; opacity: number; dim: number };

/** Lado em que a carta espera a vez: ímpar à direita (1), par à esquerda (−1). */
export function sideOf(index: number): 1 | -1 {
  'worklet';
  return index % 2 === 1 ? 1 : -1;
}

export function cardPose(rel: number, side: number, d: DeckDims): CardPose {
  'worklet';
  if (rel <= 0) {
    const t = Math.min(1, -rel);
    return { x: d.exitX * t, y: 22 * t, rot: -16 * t, scale: 1 - 0.05 * t, opacity: t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.25), dim: 0 };
  }
  if (rel <= 1) {
    return { x: side * d.sideX * rel, y: 14 * rel, rot: side * 9 * rel, scale: 1 - 0.2 * rel, opacity: 1, dim: 0.5 * rel };
  }
  if (rel <= 2) {
    const t = rel - 1;
    return { x: side * d.sideX, y: 14 + 8 * t, rot: side * (9 + 2 * t), scale: 0.8 - 0.05 * t, opacity: 1, dim: 0.5 + 0.14 * t };
  }
  const t = Math.min(1, rel - 2);
  return { x: side * d.sideX * (1 - 0.5 * t), y: 22, rot: side * 11, scale: 0.75 - 0.08 * t, opacity: 1 - t, dim: 0.64 };
}

/**
 * Arrasto: quanto o baralho andou. Um gesto passa no máximo uma carta (para a anterior ou a próxima de `anchor`).
 * Passou do começo ou do fim, `pull` é o pouquinho que a carta da frente cede (elástico), em pontos da tela.
 */
export function dragProgress(base: number, anchor: number, dx: number, travel: number, count: number): { progress: number; pull: number } {
  'worklet';
  const raw = base - dx / travel;
  const lo = Math.max(0, anchor - 1);
  const hi = Math.min(count - 1, anchor + 1);
  const over = raw < 0 ? raw : raw > count - 1 ? raw - (count - 1) : 0;
  return { progress: Math.max(lo, Math.min(hi, raw)), pull: -over * travel * 0.28 };
}

/**
 * Ao soltar: em qual carta o baralho para. `anchor` é a carta em que o baralho estava (ou para a qual já ia) e
 * `moved` é quanto o dedo andou neste gesto, em cartas (positivo = para a próxima). Passa com ~28% do caminho
 * ou com um peteleco (`velocity` em cartas por segundo); senão volta. Medir pelo gesto, e não pela posição do
 * baralho, faz dois deslizes rápidos seguidos passarem duas cartas mesmo com a primeira ainda assentando.
 */
export function settleTarget(anchor: number, moved: number, velocity: number, count: number): number {
  'worklet';
  let target = anchor;
  if (moved > 0.28 || (velocity > 1.1 && moved > 0.02)) target = anchor + 1;
  else if (moved < -0.28 || (velocity < -1.1 && moved < -0.02)) target = anchor - 1;
  return Math.max(0, Math.min(count - 1, target));
}
