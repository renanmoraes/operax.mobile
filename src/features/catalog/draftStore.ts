import { useSyncExternalStore } from 'react';
import { EMPTY_DRAFT, type Draft } from './newProduct';

/**
 * O rascunho do produto que está sendo cadastrado. Mora fora das telas porque a ficha e a tela de variações
 * trabalham no mesmo produto: voltar de uma para a outra não perde nada.
 */
let draft: Draft = EMPTY_DRAFT;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getDraft = (): Draft => draft;
export function patchDraft(patch: Partial<Draft>): void {
  draft = { ...draft, ...patch };
  emit();
}
export function resetDraft(keep: Partial<Draft> = {}): void {
  draft = { ...EMPTY_DRAFT, ...keep };
  emit();
}

export function useDraft(): Draft {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
    () => draft,
  );
}
