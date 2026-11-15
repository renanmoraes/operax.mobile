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
