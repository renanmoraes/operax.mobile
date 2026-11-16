import type { ProviderView, WatchKind } from './types';

/**
 * Para que lado cada integração leva o treino:
 *
 * - **Envia** (Operax → relógio): o treino do plano aparece no relógio para o aluno seguir as etapas.
 *   Hoje só a Garmin (Training API, `pushWorkout` no backend). Coros (Partner API) e Apple Watch
 *   (WorkoutKit) estão planejados.
 * - **Recebe** (relógio → Operax): o treino gravado no relógio entra sozinho e marca o dia do plano.
 *   Garmin, Strava e Polar pelo backend; Apple Watch pelo Saúde do iPhone; Galaxy Watch, Pixel Watch e
 *   outros pelo Health Connect do Android.
 */

export type HealthPlatform = 'ios' | 'android' | null;

/** Marcas que a tela mostra: as do backend mais as que chegam pelo celular. */
export type BrandId = ProviderView['id'] | 'galaxy' | 'healthconnect' | 'applehealth';

export interface SendTarget {
  id: 'garmin' | 'coros' | 'apple';
  label: string;
  state: ProviderView['state'];
  connected: boolean;
}

/** Relógios que recebem o treino do plano. A conexão é a mesma de importar: conectou a Garmin, vale para os dois lados. */
export function sendTargets(providers: ProviderView[] = []): SendTarget[] {
  const garmin = providers.find((p) => p.id === 'garmin');
  return [
    { id: 'garmin', label: garmin?.label ?? 'Garmin', state: garmin?.state ?? 'soon', connected: !!garmin?.connected },
    { id: 'coros', label: 'Coros', state: 'soon', connected: false },
    { id: 'apple', label: 'Apple Watch', state: 'soon', connected: false },
  ];
}

/**
 * Integrações que trazem o treino feito. O Apple Watch do backend sai da lista: ele entra pelo
 * Saúde do iPhone, que tem cartão próprio.
 */
export function receiveProviders(providers: ProviderView[] = []) {
  const list = providers.filter((p) => p.id !== 'apple');
  return { ready: list.filter((p) => p.state === 'available'), soon: list.filter((p) => p.state === 'soon') };
}

/** Uma linha da tela de Relógios: o app/relógio, se já dá para conectar e o estado da conexão. */
export interface IntegrationItem {
  id: ProviderView['id'];
  label: string;
  state: ProviderView['state'];
  connected: boolean;
  /** Dados do backend (status, última sincronização, envio). Ausente no relógio que ainda não chegou ao backend. */
  provider?: ProviderView;
}

/** Só traz o treino feito (não é relógio): o Strava. O resto é relógio, que manda o plano e traz o treino. */
const APPS_ONLY_IN: ProviderView['id'][] = ['strava'];
/** Relógios na ordem da tela: os mais usados no Brasil primeiro. */
const WATCH_ORDER: ProviderView['id'][] = ['garmin', 'polar', 'apple', 'coros', 'zepp'];

/**
 * A tela de Relógios em dois grupos, cada app uma vez: relógios (uma conexão só, que manda o treino do plano e traz o
 * treino feito) e apps que só trazem o treino feito (Strava). Em cada grupo, conectados primeiro, depois os que dá
 * para conectar, depois os que vêm em breve.
 */
export function watchGroups(providers: ProviderView[] = []) {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const item = (id: ProviderView['id'], fallback: string): IntegrationItem => {
    const p = byId.get(id);
    return { id, label: p?.label ?? fallback, state: p?.state ?? 'soon', connected: !!p?.connected, provider: p };
  };
  const rank = (i: IntegrationItem) => (i.connected ? 0 : i.state === 'available' ? 1 : 2);
  const sort = (list: IntegrationItem[]) => list.map((i, n) => ({ i, n })).sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n).map((x) => x.i);
  const known = new Set<string>([...WATCH_ORDER, ...APPS_ONLY_IN]);
  const watches = [
    ...WATCH_ORDER.map((id) => item(id, id === 'apple' ? 'Apple Watch' : id[0].toUpperCase() + id.slice(1))),
    // Relógio novo que o backend passe a listar entra no fim, sem esperar a tela conhecer.
    ...providers.filter((p) => !known.has(p.id)).map((p) => item(p.id, p.label)),
  ];
  return {
    watches: sort(watches),
    apps: sort(APPS_ONLY_IN.filter((id) => byId.has(id)).map((id) => item(id, id))),
  };
}

/** Cartões do celular que aparecem em cada sistema (Galaxy Watch só no Android, pelo Health Connect). */
export function phoneHealthCards(platform: HealthPlatform): ('health' | 'galaxy')[] {
  return platform === 'android' ? ['health', 'galaxy'] : ['health'];
}

/** Faixa de marcas do topo: as mais usadas no Brasil primeiro. */
export const BRAND_WALL: { id: BrandId; label: string }[] = [
  { id: 'garmin', label: 'Garmin' },
  { id: 'apple', label: 'Apple Watch' },
  { id: 'galaxy', label: 'Galaxy Watch' },
  { id: 'zepp', label: 'Amazfit' },
  { id: 'coros', label: 'Coros' },
  { id: 'polar', label: 'Polar' },
  { id: 'strava', label: 'Strava' },
  { id: 'healthconnect', label: 'Health Connect' },
];

/** Ordem e ícone de cada tipo de treino nas preferências de envio. */
export const WATCH_KINDS: { id: WatchKind; icon: 'footsteps-outline' | 'bicycle-outline' | 'water-outline' | 'boat-outline' | 'barbell-outline' | 'flash-outline' }[] = [
  { id: 'run', icon: 'footsteps-outline' },
  { id: 'bike', icon: 'bicycle-outline' },
  { id: 'swim', icon: 'water-outline' },
  { id: 'row', icon: 'boat-outline' },
  { id: 'strength', icon: 'barbell-outline' },
  { id: 'functional', icon: 'flash-outline' },
];

/** Liga ou desliga um tipo, sem deixar a lista vazia (sem nenhum tipo, nada iria para o relógio). Mantém a ordem da tela. */
export function toggleKind(kinds: WatchKind[], kind: WatchKind): WatchKind[] {
  const has = kinds.includes(kind);
  if (has && kinds.length === 1) return kinds;
  const next = has ? kinds.filter((k) => k !== kind) : [...kinds, kind];
  return WATCH_KINDS.map((k) => k.id).filter((k) => next.includes(k));
}

/** O primeiro provedor conectado que recebe treino (é nele que as preferências valem). */
export function pushProvider(providers: ProviderView[] = []) {
  return providers.find((p) => p.connected && p.can_push && p.push) ?? null;
}
