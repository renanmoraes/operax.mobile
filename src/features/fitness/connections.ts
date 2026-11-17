import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/src/shared/api/client';
import { clientDataMode } from '@/src/features/client/dataMode';
import type { ImportedSessionView, ProviderView, WatchPushPrefs } from './types';

const C = '/api/public/portal/fitness/connections';
const live = () => clientDataMode() === 'live';

/**
 * Relógios e apps (`/api/public/portal/fitness/connections*`). Login real: rotas do portal;
 * demonstração: store em memória com o mesmo formato. Conectar abre a autorização do relógio no
 * navegador do sistema e recarrega a lista ao voltar (o callback do backend ainda volta para o portal
 * web; para voltar direto ao app ele precisa redirecionar para `operax://relogios`).
 */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let providers: ProviderView[] = [
  { id: 'garmin', label: 'Garmin', state: 'available', connected: true, status: 'connected', last_sync_at: hoursAgo(2), last_error: null, imported: 38, can_push: true, push: { auto: true, kinds: ['run', 'bike', 'swim', 'row', 'strength', 'functional'] } },
  { id: 'strava', label: 'Strava', state: 'available', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'polar', label: 'Polar', state: 'available', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'apple', label: 'Apple Watch', state: 'soon', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'coros', label: 'Coros', state: 'soon', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'zepp', label: 'Amazfit (Zepp)', state: 'soon', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
];

const imported: ImportedSessionView[] = [
  { id: 'i1', provider: 'garmin', started_at: hoursAgo(26), sport: 'run', duration_seconds: 1860, distance_meters: 5120, avg_hr: 152, status: 'imported', sources: [{ provider: 'garmin', device: 'Forerunner 265', duration_seconds: 1860, distance_meters: 5120, avg_hr: 152 }] },
  { id: 'i2', provider: 'garmin', started_at: hoursAgo(74), sport: 'strength', duration_seconds: 3120, distance_meters: null, avg_hr: 118, status: 'imported', sources: [{ provider: 'garmin', device: 'Forerunner 265', duration_seconds: 3120, distance_meters: null, avg_hr: 118 }] },
  { id: 'i3', provider: 'garmin', started_at: hoursAgo(120), sport: 'walk', duration_seconds: 2400, distance_meters: 3300, avg_hr: 104, status: 'unmatched', sources: [{ provider: 'garmin', device: 'Forerunner 265', duration_seconds: 2400, distance_meters: 3300, avg_hr: 104 }] },
];

const tick = () => new Promise((r) => setTimeout(r, 160));

async function fetchProviders() {
  if (live()) return ((await api.get(C)).data ?? []) as ProviderView[];
  await tick();
  return providers;
}

async function fetchImported() {
  if (live()) {
    const { data } = await api.get(`${C}/history`);
    return (Array.isArray(data) ? data : data?.data ?? []) as ImportedSessionView[];
  }
  await tick();
  return imported;
}

function patch(id: ProviderView['id'], p: Partial<ProviderView>) {
  providers = providers.map((x) => (x.id === id ? { ...x, ...p } : x));
}

async function connect(id: ProviderView['id']) {
  if (live()) {
    // O backend devolve a página de autorização do relógio; volta para o app pelo deep link operax://.
    const { data } = await api.post(`${C}/${id}/start`, {});
    const url = (data as { url?: string } | undefined)?.url;
    if (url) await WebBrowser.openAuthSessionAsync(url, 'operax://relogios');
    return;
  }
  await new Promise((r) => setTimeout(r, 700));
  patch(id, { connected: true, status: 'connected', last_sync_at: new Date().toISOString() });
}

async function sync(id: ProviderView['id']) {
  if (live()) return (await api.post(`${C}/${id}/sync`, {})).data as { imported: number; matched: number };
  await new Promise((r) => setTimeout(r, 900));
  patch(id, { last_sync_at: new Date().toISOString() });
  return { imported: 0, matched: 0 };
}

async function disconnect(id: ProviderView['id']) {
  if (live()) {
    await api.delete(`${C}/${id}`);
    return;
  }
  await tick();
  patch(id, { connected: false, status: null, last_sync_at: null, imported: 0 });
}

async function savePush(id: ProviderView['id'], prefs: WatchPushPrefs) {
  if (live()) {
    await api.put(`${C}/${id}/push`, prefs);
    return;
  }
  await tick();
  patch(id, { push: prefs });
}

const key = ['fitness', 'connections'] as const;

/** `enabled` falso para empresa sem Fitness: as rotas de relógio são do Fitness e responderiam 403. */
export function useProviders(enabled = true) {
  return useQuery({ queryKey: key, queryFn: fetchProviders, enabled });
}

export function useImportedSessions() {
  return useQuery({ queryKey: [...key, 'history'], queryFn: fetchImported });
}

function useProviderMutation(fn: (id: ProviderView['id']) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
}

export const useConnectProvider = () => useProviderMutation(connect);
export const useSyncProvider = () => useProviderMutation(sync);
export const useDisconnectProvider = () => useProviderMutation(disconnect);

/** Salva o que vai para o relógio. Atualiza a lista na hora e desfaz se a API recusar. */
export function useSavePushPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, prefs }: { id: ProviderView['id']; prefs: WatchPushPrefs }) => savePush(id, prefs),
    onMutate: async ({ id, prefs }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<ProviderView[]>(key);
      qc.setQueryData<ProviderView[]>(key, (list) => list?.map((p) => (p.id === id ? { ...p, push: prefs } : p)));
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
