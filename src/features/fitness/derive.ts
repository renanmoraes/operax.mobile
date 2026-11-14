/**
 * Regras calculadas no app: o portal não tem rota de consistência/streak nem de gamificação
 * para o cliente (só a visão da equipe), então derivamos de semana + histórico.
 */

export type DayState = 'done' | 'missed' | 'extra' | 'rest' | 'future';

/** Dias seguidos cumprindo o plano até ontem. Descanso programado mantém a sequência, mas sozinho não cria. */
export function adherenceStreak(daysOldestToYesterday: DayState[]): number {
  let streak = 0;
  let sawTraining = false;
  for (let i = daysOldestToYesterday.length - 1; i >= 0; i--) {
    const s = daysOldestToYesterday[i];
    if (s === 'missed') break;
    if (s === 'future') continue;
    if (s === 'done' || s === 'extra') sawTraining = true;
    streak += 1;
  }
  return sawTraining ? streak : 0;
}

export function xpFrom(input: { sessions: number; records: number; goalWeeks: number }) {
  return input.sessions * 50 + input.records * 30 + input.goalWeeks * 120;
}

const LEVEL_STEP = 200;
const LABELS: Array<[number, string]> = [
  [1, 'Iniciante'],
  [4, 'Em ritmo'],
  [6, 'Intermediário'],
  [10, 'Avançado'],
  [15, 'Elite'],
];

/** Cada nível pede 200 XP a mais que o anterior (200, 400, 600…). */
export function levelFromXp(xp: number) {
  let level = 1;
  let floor = 0;
  let need = LEVEL_STEP;
  while (xp >= floor + need) {
    floor += need;
    level += 1;
    need = LEVEL_STEP * level;
  }
  const label = LABELS.reduce((acc, [min, name]) => (level >= min ? name : acc), LABELS[0][1]);
  return { level, current: xp - floor, next: need, label };
}
