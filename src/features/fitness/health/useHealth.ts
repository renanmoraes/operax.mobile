import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { fitnessOwner, ownedKey } from '../owner';
import { getHealthAvailability, readRecentWorkouts, requestHealthAccess } from './healthStore';
import type { HealthWorkout } from './mapWorkouts';
import { pendingBatches, rememberSent } from './healthSend';
import { sendHealthWorkouts } from '../fitnessApi';

/**
 * Estado da conexão com o Saúde / Health Connect. Os treinos lidos aparecem na tela de relógios e vão para o
 * Operax (`POST /fitness/health/workouts`), onde casam com o treino do dia e alimentam o ritmo de referência.
 */

/**
 * Por conta e no banco local: os treinos do Saúde de um aluno não aparecem para outro que entrar no mesmo
 * celular, e 30 dias de treinos passam do limite de ~2 KB do armazenamento seguro.
 */
const stateKey = (who: string) => ownedKey('operax_health_connected', who);
const key = ['fitness', 'health'] as const;
/** A lista na tela também é por dono: o resultado de uma sincronização nunca cai na conta de outro. */
const stateQueryKey = (who: string) => [...key, 'state', who] as const;

export type HealthState = { connected: boolean; lastSyncAt: string | null; workouts: HealthWorkout[] };

async function loadState(who: string): Promise<HealthState> {
  const k = stateKey(who);
  // Os treinos da última sincronização ficam guardados: reabrir a tela não zera a lista.
  const saved = k ? await kvGet<{ lastSyncAt: string | null; workouts?: HealthWorkout[] }>(k) : null;
  if (!saved) return { connected: false, lastSyncAt: null, workouts: [] };
  return { connected: true, lastSyncAt: saved.lastSyncAt, workouts: Array.isArray(saved.workouts) ? saved.workouts : [] };
}

export function useHealthAvailability() {
  return useQuery({ queryKey: [...key, 'availability'], queryFn: getHealthAvailability, staleTime: 60_000 });
}

export function useHealthState() {
  const who = fitnessOwner();
  return useQuery({ queryKey: stateQueryKey(who), queryFn: () => loadState(who) });
}

type Owned = { who: string; state: HealthState };

/**
 * `who`: o dono que pediu, guardado ANTES da leitura (que demora). Se a pessoa trocou de conta no meio,
 * o resultado vai só para a chave e para a lista de quem pediu, nunca para a conta que entrou depois.
 */
async function syncNow(who: string): Promise<Owned> {
  const workouts = await readRecentWorkouts(30);
  const lastSyncAt = new Date().toISOString();
  const k = stateKey(who);
  if (k) await kvSet(k, { lastSyncAt, workouts });
  await sendPending(who, workouts);
  return { who, state: { connected: true, lastSyncAt, workouts } };
}

/** Ids já enviados ao Operax, por conta: o mesmo treino não sobe de novo a cada sincronização. */
const sentKey = (who: string) => ownedKey('operax_health_sent', who);

/**
 * Manda ao Operax os treinos que ainda não foram. Falha (sem internet, servidor fora) não apaga a lista da tela
 * nem marca como enviado: a próxima sincronização tenta de novo, e o backend não duplica.
 */
async function sendPending(who: string, workouts: HealthWorkout[]): Promise<void> {
  const k = sentKey(who);
  if (!k) return;
  let sent = (await kvGet<string[]>(k)) ?? [];
  for (const batch of pendingBatches(workouts, sent)) {
    try {
      await sendHealthWorkouts(batch);
    } catch {
      return;
    }
    sent = rememberSent(sent, batch);
    await kvSet(k, sent);
  }
}

/** Só atualiza a lista na tela se quem pediu ainda é a conta aberta (senão o cache dela já foi limpo). */
function applyIfCurrent(qc: ReturnType<typeof useQueryClient>, r: Owned) {
  if (r.who && r.who === fitnessOwner()) qc.setQueryData(stateQueryKey(r.who), r.state);
}

export function useConnectHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const who = fitnessOwner();
      await requestHealthAccess();
      return syncNow(who);
    },
    onSuccess: (r) => applyIfCurrent(qc, r),
  });
}

export function useSyncHealth() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => syncNow(fitnessOwner()), onSuccess: (r) => applyIfCurrent(qc, r) });
}

export function useDisconnectHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Owned> => {
      const who = fitnessOwner();
      const k = stateKey(who);
      if (k) await kvSet(k, null);
      return { who, state: { connected: false, lastSyncAt: null, workouts: [] } };
    },
    onSuccess: (r) => applyIfCurrent(qc, r),
  });
}
