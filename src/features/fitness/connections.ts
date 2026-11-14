import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportedSessionView, ProviderView } from './types';

/**
 * Relógios e apps (`/api/public/portal/fitness/connections*`). Store em memória com o formato real
 * até existir o login mobile de cliente. No modo real, `connect` faz POST `/:provider/start`, abre a
 * URL devolvida com `WebBrowser.openAuthSessionAsync` e recarrega a lista ao voltar — o callback OAuth
 * do backend hoje só redireciona para o portal web, então precisa de um destino com deep link `operax://`.
 */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let providers: ProviderView[] = [
  { id: 'garmin', label: 'Garmin', state: 'available', connected: true, status: 'connected', last_sync_at: hoursAgo(2), last_error: null, imported: 38 },
  { id: 'strava', label: 'Strava', state: 'available', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'polar', label: 'Polar', state: 'available', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'apple', label: 'Apple Watch', state: 'soon', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'coros', label: 'Coros', state: 'soon', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
  { id: 'zepp', label: 'Amazfit (Zepp)', state: 'soon', connected: false, status: null, last_sync_at: null, last_error: null, imported: 0 },
];

const imported: ImportedSessionView[] = [
  { id: 'i1', provider: 'garmin', started_at: hoursAgo(26), sport: 'Corrida', duration_seconds: 1860, distance_meters: 5120, avg_hr: 152, status: 'imported', sources: [{ provider: 'garmin', device: 'Forerunner 265', duration_seconds: 1860, distance_meters: 5120, avg_hr: 152 }] },
  { id: 'i2', provider: 'garmin', started_at: hoursAgo(74), sport: 'Musculação', duration_seconds: 3120, distance_meters: null, avg_hr: 118, status: 'imported', sources: [{ provider: 'garmin', device: 'Forerunner 265', duration_seconds: 3120, distance_meters: null, avg_hr: 118 }] },
  { id: 'i3', provider: 'garmin', started_at: hoursAgo(120), sport: 'Caminhada', duration_seconds: 2400, distance_meters: 3300, avg_hr: 104, status: 'unmatched', sources: [{ provider: 'garmin', device: 'Forerunner 265', duration_seconds: 2400, distance_meters: 3300, avg_hr: 104 }] },
];

const tick = () => new Promise((r) => setTimeout(r, 160));

async function fetchProviders() {
  await tick();
  return providers;
}

async function fetchImported() {
  await tick();
  return imported;
}

function patch(id: ProviderView['id'], p: Partial<ProviderView>) {
  providers = providers.map((x) => (x.id === id ? { ...x, ...p } : x));
}

async function connect(id: ProviderView['id']) {
  await new Promise((r) => setTimeout(r, 700));
  patch(id, { connected: true, status: 'connected', last_sync_at: new Date().toISOString() });
}

async function sync(id: ProviderView['id']) {
  await new Promise((r) => setTimeout(r, 900));
  patch(id, { last_sync_at: new Date().toISOString() });
  return { imported: 0, matched: 0 };
}

async function disconnect(id: ProviderView['id']) {
  await tick();
  patch(id, { connected: false, status: null, last_sync_at: null, imported: 0 });
}

const key = ['fitness', 'connections'] as const;

export function useProviders() {
  return useQuery({ queryKey: key, queryFn: fetchProviders });
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
