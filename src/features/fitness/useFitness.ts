import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './fitnessApi';
import { flushQueue, loadQueue, saveQueue } from './resultsQueue';
import type { BodyCheckin, RecordResultBody } from './types';

/** Reenvia resultados guardados sem conexão ao abrir o app e quando ele volta ao primeiro plano. */
export function useFlushResultsQueue() {
  const qc = useQueryClient();
  useEffect(() => {
    const run = async () => {
      const queue = await loadQueue();
      if (!queue.length) return;
      const rest = await flushQueue(queue, async (body) => {
        try {
          await api.recordResult(body);
          return { ok: true };
        } catch {
          return { ok: false, status: 0 };
        }
      });
      await saveQueue(rest);
      if (rest.length < queue.length) void qc.invalidateQueries({ queryKey: root });
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => sub.remove();
  }, [qc]);
}

const root = ['fitness'] as const;

export const useWeek = () => useQuery({ queryKey: [...root, 'week'], queryFn: api.fetchWeek });
export const useFitnessSummary = () => useQuery({ queryKey: [...root, 'summary'], queryFn: api.fetchSummary });
export const useHistory = () => useQuery({ queryKey: [...root, 'history'], queryFn: api.fetchHistory });
export const useEvolution = () => useQuery({ queryKey: [...root, 'evolution'], queryFn: api.fetchEvolution });
export const useCheckins = () => useQuery({ queryKey: [...root, 'checkins'], queryFn: api.fetchCheckins });

export function useWorkout(id: string | undefined) {
  return useQuery({ queryKey: [...root, 'workout', id], queryFn: () => api.fetchWorkout(id!), enabled: !!id });
}

export function useRecordResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordResultBody) => api.recordResult(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: root }),
  });
}

export function useAddCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BodyCheckin, 'id'>) => api.addCheckin(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...root, 'checkins'] }),
  });
}
