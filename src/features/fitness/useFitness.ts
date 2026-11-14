import { useEffect, useMemo } from 'react';
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

/** `enabled: false` quando a empresa não liberou o treino (nem pede a rota, que responderia sem acesso). */
export const useWeek = (opts?: { enabled?: boolean }) => useQuery({ queryKey: [...root, 'week'], queryFn: api.fetchWeek, enabled: opts?.enabled ?? true });
export const useFitnessSummary = (opts?: { enabled?: boolean }) => useQuery({ queryKey: [...root, 'summary'], queryFn: api.fetchSummary, enabled: opts?.enabled ?? true });
export const useHistory = () => useQuery({ queryKey: [...root, 'history'], queryFn: api.fetchHistory });
export const useEvolution = () => useQuery({ queryKey: [...root, 'evolution'], queryFn: api.fetchEvolution });
export const useCheckins = () => useQuery({ queryKey: [...root, 'checkins'], queryFn: api.fetchCheckins });

/** Cargas por exercício (mais antiga → mais recente), da Evolução: alimenta "última vez" e recordes. */
export function useLoadHistory(): Record<string, number[]> {
  const { data } = useEvolution();
  return useMemo(() => Object.fromEntries((data?.strength ?? []).map((s) => [s.exercise_id, s.points.map((p) => p.top_load_kg)])), [data]);
}

/** Treinos da semana (sem repetir), para alternar entre as fichas. */
export function useMyWorkouts() {
  const { data } = useWeek();
  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of data?.days ?? []) for (const it of d.items ?? []) if (!seen.has(it.id)) seen.set(it.id, it.title);
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [data]);
}

/** Dias da semana (0 = domingo) que têm treino no plano. */
export function usePlannedWeekdays() {
  const { data } = useWeek();
  return useMemo(() => new Set((data?.days ?? []).filter((d) => d.planned > 0).map((d) => new Date(`${d.date}T12:00:00`).getDay())), [data]);
}

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
