import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Busca de novo cada vez que a tela volta ao foco (menos na primeira, que já carregou sozinha). */
export function useFocusRefetch(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
