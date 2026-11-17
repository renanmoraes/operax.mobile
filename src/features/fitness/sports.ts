import type { ComponentProps } from 'react';
import i18n from '@/src/i18n';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { FitnessFeeling, FreeSport } from './types';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Esportes que o aluno pode gravar no app. Os de rua usam o GPS (distância, ritmo e o caminho no mapa);
 * os de academia e piscina gravam só o tempo e o "como foi".
 */
export type SportInfo = {
  id: FreeSport;
  label: string;
  icon: McIcon;
  gps: boolean;
  /** Corrida e caminhada mostram ritmo (min/km); bike mostra velocidade. */
  rate: 'pace' | 'speed' | null;
  /** Limite de salto do GPS (o filtro de pontos impossíveis). */
  tracker: 'run' | 'bike';
};

/** `label` é lido na hora no idioma atual (getter), então troca junto com o idioma. */
const sport = (s: Omit<SportInfo, 'label'>): SportInfo => ({ ...s, get label() { return i18n.t(`fitness:free.${s.id}`); } });

export const SPORTS: SportInfo[] = [
  sport({ id: 'run', icon: 'run-fast', gps: true, rate: 'pace', tracker: 'run' }),
  sport({ id: 'walk', icon: 'walk', gps: true, rate: 'pace', tracker: 'run' }),
  sport({ id: 'bike', icon: 'bike', gps: true, rate: 'speed', tracker: 'bike' }),
  sport({ id: 'strength', icon: 'weight-lifter', gps: false, rate: null, tracker: 'run' }),
  sport({ id: 'swim', icon: 'swim', gps: false, rate: null, tracker: 'run' }),
  sport({ id: 'other', icon: 'heart-pulse', gps: false, rate: null, tracker: 'run' }),
];

export const sportInfo = (id: string | null | undefined): SportInfo => SPORTS.find((s) => s.id === id) ?? SPORTS[SPORTS.length - 1];

/** Esporte do histórico (o backend guarda run/bike/swim/row/other) para o rótulo do app. */
export function historySportLabel(modality: string | null | undefined): string | null {
  if (!modality) return null;
  const known = SPORTS.find((s) => s.id === modality);
  if (known) return known.label;
  return modality === 'row' ? i18n.t('fitness:free.row') : null;
}

/**
 * Esporte de qualquer origem (servidor, relógio, Strava): a chave em português do app e o ícone certo. O servidor manda
 * `run`, `bike`, `swim`, `row` ou `other`, e o celular grava também `walk` e `strength`. Chave que não conhecemos vira
 * "Atividade" com o ícone genérico, nunca o nome em inglês cru.
 */
const SPORT_ICON: Record<string, McIcon> = {
  run: 'run-fast',
  walk: 'walk',
  bike: 'bike',
  swim: 'swim',
  row: 'rowing',
  strength: 'weight-lifter',
  other: 'heart-pulse',
};

export function sportIconFor(sport: string | null | undefined): McIcon {
  return SPORT_ICON[sport ?? ''] ?? 'heart-pulse';
}

export function sportLabelFor(sport: string | null | undefined): string {
  return historySportLabel(sport) ?? i18n.t('fitness:watch.activity');
}

const feeling = (id: FitnessFeeling, icon: McIcon) => ({ id, icon, get label() { return i18n.t(`fitness:feeling.${id}`); } });
export const FEELINGS: { id: FitnessFeeling; label: string; icon: McIcon }[] = [
  feeling('great', 'emoticon-excited-outline'),
  feeling('good', 'emoticon-happy-outline'),
  feeling('ok', 'emoticon-neutral-outline'),
  feeling('bad', 'emoticon-sad-outline'),
  feeling('awful', 'emoticon-dead-outline'),
];

/** Escala de esforço percebido (1 a 10), com a palavra que o aluno reconhece. */
export function effortWord(n: number): string {
  return i18n.t(n <= 2 ? 'fitness:effort.veryLight' : n <= 4 ? 'fitness:effort.light' : n <= 6 ? 'fitness:effort.moderate' : n <= 8 ? 'fitness:effort.hard' : 'fitness:effort.max');
}

/** Tipo do treino (o professor filtra e entende o histórico por isso). */
type TagId = 'easy' | 'long' | 'intervals' | 'tempo' | 'race' | 'strength' | 'hypertrophy' | 'conditioning' | 'mobility';
const tag = (id: TagId) => ({ id, get label() { return i18n.t(`fitness:tag.${id}`); } });
export const WORKOUT_TAGS: Record<'endurance' | 'gym', { id: string; label: string }[]> = {
  endurance: [tag('easy'), tag('long'), tag('intervals'), tag('tempo'), tag('race')],
  gym: [tag('strength'), tag('hypertrophy'), tag('conditioning'), tag('mobility')],
};
export const tagLabel = (id: string | null | undefined) => [...WORKOUT_TAGS.endurance, ...WORKOUT_TAGS.gym].find((t) => t.id === id)?.label ?? null;
