import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onReconnect } from './network';

/** A internet voltou: as telas que tinham falhado carregam de novo sozinhas, sem a pessoa precisar tocar em nada. */
export function NetworkWatcher() {
  const qc = useQueryClient();
  useEffect(
    () =>
      onReconnect(() => {
        void qc.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' || q.state.fetchStatus === 'paused' });
      }),
    [qc],
  );
  return null;
}
