import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './fitnessApi';
import { isAxiosError } from 'axios';
import { flushAll } from './resultsQueue';
import type { BodyCheckin, FreeActivityBody, RecordResultBody } from './types';

/** Status HTTP para a fila: recusa de verdade (4xx, menos 401/408/425/429) descarta; o resto tenta depois. */
const statusOf = (e: unknown) => (isAxiosError(e) ? (e.response?.status ?? 0) : 0);
/** `Retry-After` do servidor (segundos ou data), em ms; sem ele, nada. */
function retryAfterOf(e: unknown): number | undefined {
  const raw = isAxiosError(e) ? (e.response?.headers?.['retry-after'] as string | undefined) : undefined;
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return secs * 1000;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

/** Reenvia resultados guardados sem conexão: ao abrir o app, ao voltar ao primeiro plano, quando a internet volta e a cada minuto. */
export function useFlushResultsQueue() {
  const qc = useQueryClient();
  useEffect(() => {
    // O status vai junto: a fila descarta o que o servidor recusou de vez e guarda o que é para tentar depois.
    const sender = <T,>(post: (b: T) => Promise<unknown>) => async (body: T) => {
      try {
        await post(body);
        return { ok: true } as const;
      } catch (e) {
        return { ok: false, status: statusOf(e), retryAfterMs: retryAfterOf(e) } as const;
      }
    };
    const run = async () => {
      const changed = await flushAll({ result: sender(api.recordResult), activity: sender(api.recordFreeActivity) });
      if (changed) void qc.invalidateQueries({ queryKey: root });
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    // A internet voltou com o app aberto: reenvia na hora (não precisa sair e voltar para o app).
    let net: { remove: () => void } | null = null;
    try {
      net = Network.addNetworkStateListener((st) => {
        if (st.isConnected && st.isInternetReachable !== false) void run();
      });
    } catch {
      // sem módulo de rede (web antigo): fica o reenvio periódico abaixo
    }
    // Reserva: tenta de novo a cada minuto com o app na frente (fila vazia sai na hora, sem rede nenhuma).
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void run();
    }, 60_000);
    return () => {
      sub.remove();
      net?.remove();
      clearInterval(timer);
    };
  }, [qc]);
}

const root = ['fitness'] as const;

/** `enabled: false` quando a empresa não liberou o treino (nem pede a rota, que responderia sem acesso). */
export const useWeek = (opts?: { enabled?: boolean }) => useQuery({ queryKey: [...root, 'week'], queryFn: api.fetchWeek, enabled: opts?.enabled ?? true });
export const useFitnessSummary = (opts?: { enabled?: boolean }) => useQuery({ queryKey: [...root, 'summary'], queryFn: api.fetchSummary, enabled: opts?.enabled ?? true });
export const useHistory = () => useQuery({ queryKey: [...root, 'history'], queryFn: api.fetchHistory });
export const useEvolution = () => useQuery({ queryKey: [...root, 'evolution'], queryFn: api.fetchEvolution });
/** Caminho, parciais e resumo de um treino do histórico (só existe quando a sessão tem gravação). */
export const useActivityDetail = (id: string | undefined) =>
  useQuery({ queryKey: [...root, 'detail', id], queryFn: () => api.fetchActivityDetail(id!), enabled: !!id });

export function useRecordFreeActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FreeActivityBody) => api.recordFreeActivity(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: root }),
  });
}

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
