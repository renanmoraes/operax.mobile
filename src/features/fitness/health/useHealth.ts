import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getItem, setItem, deleteItem } from '@/src/shared/storage';
import { getHealthAvailability, readRecentWorkouts, requestHealthAccess } from './healthStore';
import type { HealthWorkout } from './mapWorkouts';

/**
 * Estado da conexão com o Saúde / Health Connect.
 * O envio ao backend ainda não existe (ver `docs/12-api-gaps.md`, "Saúde do celular"):
 * por enquanto os treinos lidos ficam no aparelho e aparecem na tela de relógios.
 */

const CONNECTED_KEY = 'operax_health_connected';
const key = ['fitness', 'health'] as const;

export type HealthState = { connected: boolean; lastSyncAt: string | null; workouts: HealthWorkout[] };

async function loadState(): Promise<HealthState> {
  const raw = await getItem(CONNECTED_KEY);
  if (!raw) return { connected: false, lastSyncAt: null, workouts: [] };
  try {
    // Os treinos da última sincronização ficam guardados: reabrir a tela não zera a lista.
    const saved = JSON.parse(raw) as { lastSyncAt: string | null; workouts?: HealthWorkout[] };
    return { connected: true, lastSyncAt: saved.lastSyncAt, workouts: Array.isArray(saved.workouts) ? saved.workouts : [] };
  } catch {
    return { connected: false, lastSyncAt: null, workouts: [] };
  }
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
  await setItem(CONNECTED_KEY, JSON.stringify({ lastSyncAt, workouts }));
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
      await deleteItem(CONNECTED_KEY);
      return { connected: false, lastSyncAt: null, workouts: [] } satisfies HealthState;
    },
    onSuccess: (state) => qc.setQueryData([...key, 'state'], state),
  });
}
