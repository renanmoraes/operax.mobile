import type { ShareActivity } from './types';

// Em memória: a rota pode ter centenas de pontos, grande demais para parâmetro de URL.
let current: ShareActivity | null = null;

export function setShareActivity(a: ShareActivity) {
  current = a;
}

export function getShareActivity(): ShareActivity | null {
  return current;
}
