import type { ComponentProps } from 'react';
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

export const SPORTS: SportInfo[] = [
  { id: 'run', label: 'Corrida', icon: 'run-fast', gps: true, rate: 'pace', tracker: 'run' },
  { id: 'walk', label: 'Caminhada', icon: 'walk', gps: true, rate: 'pace', tracker: 'run' },
  { id: 'bike', label: 'Pedalada', icon: 'bike', gps: true, rate: 'speed', tracker: 'bike' },
  { id: 'strength', label: 'Musculação', icon: 'weight-lifter', gps: false, rate: null, tracker: 'run' },
  { id: 'swim', label: 'Natação', icon: 'swim', gps: false, rate: null, tracker: 'run' },
  { id: 'other', label: 'Outro treino', icon: 'heart-pulse', gps: false, rate: null, tracker: 'run' },
];

export const sportInfo = (id: string | null | undefined): SportInfo => SPORTS.find((s) => s.id === id) ?? SPORTS[SPORTS.length - 1];

/** Esporte do histórico (o backend guarda run/bike/swim/row/other) para o rótulo do app. */
export function historySportLabel(modality: string | null | undefined): string | null {
  if (!modality) return null;
  const known = SPORTS.find((s) => s.id === modality);
  if (known) return known.label;
  return ({ row: 'Remo', strength: 'Musculação' } as Record<string, string>)[modality] ?? null;
}

export const FEELINGS: { id: FitnessFeeling; label: string; icon: McIcon }[] = [
  { id: 'great', label: 'Ótimo', icon: 'emoticon-excited-outline' },
  { id: 'good', label: 'Bom', icon: 'emoticon-happy-outline' },
  { id: 'ok', label: 'Normal', icon: 'emoticon-neutral-outline' },
  { id: 'bad', label: 'Difícil', icon: 'emoticon-sad-outline' },
  { id: 'awful', label: 'Pesado demais', icon: 'emoticon-dead-outline' },
];

/** Escala de esforço percebido (1 a 10), com a palavra que o aluno reconhece. */
export function effortWord(n: number): string {
  if (n <= 2) return 'Muito leve';
  if (n <= 4) return 'Leve';
  if (n <= 6) return 'Moderado';
  if (n <= 8) return 'Forte';
  return 'Máximo';
}
