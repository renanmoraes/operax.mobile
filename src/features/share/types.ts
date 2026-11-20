import type { ReactElement } from 'react';

export type ShareStrength = {
  volumeKg: number | null;
  setsDone: number | null;
  setsTotal: number | null;
  records: { name: string; kg: number }[];
  /** Últimas vezes + hoje; o último é hoje. */
  volumeHistory: { label: string; kg: number }[];
};

export type ShareGps = {
  sport: string;
  distanceM: number;
  /** O número principal do esporte: ritmo (corrida) ou velocidade (pedal), já formatado. */
  rateLabel: string;
  paceLabel: string | null;
  speedLabel: string | null;
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  route: [number, number][];
  splits: { index: number; seconds: number }[];
  /** De onde vêm as parciais: volta do relógio, quilômetro ou 100 m (natação). Muda o título do modelo. */
  splitsKind?: 'laps' | 'km' | '100m';
};

/** Tudo que a tela de compartilhar precisa; quem abre a tela monta este objeto. */
export type ShareActivity = {
  kind: 'strength' | 'gps';
  title: string;
  company: string;
  date: string;
  seconds: number;
  strength?: ShareStrength;
  gps?: ShareGps;
};

export type TemplateProps = {
  activity: ShareActivity;
  photoUri?: string | null;
  mapUri?: string | null;
  /** Chamado quando a imagem de fundo (foto ou mapa) terminou de carregar: só então a captura sai certa. */
  onReady?: () => void;
};

export type ShareTemplate = {
  id: string;
  /** Chave em `fitness:share.templates`. */
  labelKey: string;
  transparent: boolean;
  /** Precisa de foto da galeria antes de gerar. */
  needsPhoto?: boolean;
  /** Fundo com o mapa real (captura do mapa). */
  usesMap?: boolean;
  supports: (a: ShareActivity) => boolean;
  /** Desenha em 1080×1920. */
  Render: (p: TemplateProps) => ReactElement;
};

export const CANVAS = { w: 1080, h: 1920 };
