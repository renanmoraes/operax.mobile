import { useEffect, useState } from 'react';

/**
 * Hora atual (ms) guardada em estado, para a tela não chamar `Date.now()` direto na renderização.
 * Com `everyMs`, atualiza sozinha nesse intervalo (contagens regressivas, "falta 1 h"…).
 */
export function useNow(everyMs?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!everyMs) return;
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
