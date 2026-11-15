import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { ownedKey } from '../owner';
import { getHealthAvailability, readRecentWorkouts, requestHealthAccess } from './healthStore';
import type { HealthWorkout } from './mapWorkouts';

/**
 * Estado da conexão com o Saúde / Health Connect.
 * O envio ao backend ainda não existe (ver `docs/12-api-gaps.md`, "Saúde do celular"):
 * por enquanto os treinos lidos ficam no aparelho e aparecem na tela de relógios.
 */

/**
 * Por conta e no banco local: os treinos do Saúde de um aluno não aparecem para outro que entrar no mesmo
 * celular, e 30 dias de treinos passam do limite de ~2 KB do armazenamento seguro.
 */
const stateKey = () => ownedKey('operax_health_connected');
const key = ['fitness', 'health'] as const;

export type HealthState = { connected: boolean; lastSyncAt: string | null; workouts: HealthWorkout[] };

async function loadState(): Promise<HealthState> {
  const k = stateKey();
  // Os treinos da última sincronização ficam guardados: reabrir a tela não zera a lista.
  const saved = k ? await kvGet<{ lastSyncAt: string | null; workouts?: HealthWorkout[] }>(k) : null;
  if (!saved) return { connected: false, lastSyncAt: null, workouts: [] };
  return { connected: true, lastSyncAt: saved.lastSyncAt, workouts: Array.isArray(saved.workouts) ? saved.workouts : [] };
}

export function useHealthAvailability() {
  return useQuery({ queryKey: [...key, 'availability'], queryFn: getHealthAvailability, staleTime: 60_000 });
}

export function useHealthState() {
  return useQuery({ queryKey: [...key, 'state'], queryFn: loadState });
}

async function syncNow(): Promise<HealthState> {
  const workouts = await readRecentWorkouts(30);
  const lastSyncAt = new Date().toISOString();
  const k = stateKey();
  if (k) await kvSet(k, { lastSyncAt, workouts });
  return { connected: true, lastSyncAt, workouts };
}

export function useConnectHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await requestHealthAccess();
      return syncNow();
    },
    onSuccess: (state) => qc.setQueryData([...key, 'state'], state),
  });
}

export function useSyncHealth() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: syncNow, onSuccess: (state) => qc.setQueryData([...key, 'state'], state) });
}

export function useDisconnectHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const k = stateKey();
      if (k) await kvSet(k, null);
      return { connected: false, lastSyncAt: null, workouts: [] } satisfies HealthState;
    },
    onSuccess: (state) => qc.setQueryData([...key, 'state'], state),
  });
}
