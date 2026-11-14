import type { FitnessEnduranceStep, FitnessPart } from './types';

/**
 * O treino do professor guiando a gravação: as etapas da ficha (aquecimento, tiros, recuperação…) viram
 * uma fila que avança sozinha pelo tempo ou pela distância, e as frases que o app fala em voz alta.
 * Tudo puro, para testar sem aparelho.
 */

export type StepTarget = NonNullable<FitnessEnduranceStep['target']>;
export type GuideStep = {
  kind: FitnessEnduranceStep['kind'];
  seconds?: number;
  meters?: number;
  target?: StepTarget;
  /** Dentro de um bloco "5 vezes": qual volta é esta. */
  round?: { n: number; of: number };
};

const KIND: Record<GuideStep['kind'], string> = { warmup: 'Aquecimento', interval: 'Tiro', recovery: 'Recuperação', cooldown: 'Desaquecimento', rest: 'Descanso' };

/** Etapas da parte de resistência, com os blocos repetidos já abertos ("Tiro 2 de 5"). */
export function guideSteps(part: FitnessPart | undefined): GuideStep[] {
  if (!part || part.type !== 'endurance') return [];
  const one = (s: FitnessEnduranceStep, round?: GuideStep['round']): GuideStep => ({
    kind: s.kind,
    ...(s.duration_seconds ? { seconds: s.duration_seconds } : {}),
    ...(s.distance_meters ? { meters: s.distance_meters } : {}),
    ...(s.target ? { target: s.target } : {}),
    ...(round ? { round } : {}),
  });
  return part.steps.flatMap((s) =>
    s.kind === 'repeat' ? Array.from({ length: s.repeats }, (_, i) => s.steps.map((c) => one(c, { n: i + 1, of: s.repeats }))).flat() : [one(s)],
  );
}

/** Quanto falta da etapa, dado o tempo e a distância feitos desde que ela começou. Etapa sem medida espera a pessoa tocar em "Próxima". */
export function stepProgress(step: GuideStep, doneSeconds: number, doneMeters: number): { done: boolean; fraction: number; leftSeconds?: number; leftMeters?: number } {
  if (step.meters) {
    const left = step.meters - doneMeters;
    return { done: left <= 0, fraction: Math.min(1, Math.max(0, doneMeters / step.meters)), leftMeters: Math.max(0, Math.round(left)) };
  }
  if (step.seconds) {
    const left = step.seconds - doneSeconds;
    return { done: left <= 0, fraction: Math.min(1, Math.max(0, doneSeconds / step.seconds)), leftSeconds: Math.max(0, Math.round(left)) };
  }
  return { done: false, fraction: 0 };
}

const meters = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0).replace('.', ',')} km` : `${m} m`);
const clock = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}` : `${s} s`);
const pace = (s: number) => `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, '0')}"`;

/** "Tiro 400 m", "Aquecimento 10 min", "Recuperação livre". */
export function stepTitle(step: GuideStep): string {
  const size = step.meters ? meters(step.meters) : step.seconds ? clock(step.seconds) : 'livre';
  return `${KIND[step.kind]} ${size}`;
}

/** Alvo do professor em texto curto. */
export function targetText(t: StepTarget | undefined): string | null {
  if (!t) return null;
  const range = (f: (n: number) => string) => (t.max != null && t.max !== t.min ? `${f(t.min)} a ${f(t.max)}` : f(t.min));
  switch (t.type) {
    case 'pace': return `Ritmo ${range(pace)}/km`;
    case 'hr_zone': return `Zona ${range(String)} de FC`;
    case 'hr_percent': return `${range(String)}% da FC máxima`;
    case 'rpe': return `Esforço ${range(String)} de 10`;
    case 'cadence': return `Cadência ${range(String)}`;
    case 'ftp_percent': return `${range(String)}% do FTP`;
    case 'pace_percent': return `${range(String)}% do ritmo de referência`;
  }
}

/** Ritmo atual contra o alvo de ritmo do professor (só alvo em min/km). */
export function paceVsTarget(secPerKm: number | null, t: StepTarget | undefined): 'fast' | 'ok' | 'slow' | null {
  if (secPerKm == null || !t || t.type !== 'pace') return null;
  const lo = Math.min(t.min, t.max ?? t.min);
  const hi = Math.max(t.min, t.max ?? t.min);
  // Folga de 3 s/km: o GPS oscila e ninguém corre no segundo exato.
  if (secPerKm < lo - 3) return 'fast';
  if (secPerKm > hi + 3) return 'slow';
  return 'ok';
}

// ---------- frases faladas ----------

/** "5 minutos e 12 segundos", "45 segundos", "1 hora e 3 minutos". */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = h ? [unit(h, 'hora', 'horas'), m ? unit(m, 'minuto', 'minutos') : null] : [m ? unit(m, 'minuto', 'minutos') : null, sec || !m ? unit(sec, 'segundo', 'segundos') : null];
  return parts.filter(Boolean).join(' e ');
}

const spokenMeters = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0).replace('.', ' vírgula ')} quilômetros` : `${m} metros`);

/** Aviso de cada quilômetro (corrida/caminhada) ou a cada 5 km (bike). */
export function kmCue(km: number, splitSeconds: number, avgSecPerKm: number | null, kmh?: number): string {
  if (kmh != null) return `${km} quilômetros. Velocidade média de ${Math.round(kmh)} quilômetros por hora.`;
  const avg = avgSecPerKm ? ` Ritmo médio de ${spokenDuration(avgSecPerKm)} por quilômetro.` : '';
  return `Quilômetro ${km}. Parcial de ${spokenDuration(splitSeconds)}.${avg}`;
}

/** Aviso ao entrar numa etapa do treino do professor. */
export function stepCue(step: GuideStep): string {
  const size = step.meters ? spokenMeters(step.meters) : step.seconds ? spokenDuration(step.seconds) : 'sem tempo marcado';
  const round = step.round && step.kind === 'interval' ? `, ${step.round.n} de ${step.round.of}` : '';
  const t = step.target?.type === 'pace' ? `. Ritmo entre ${spokenDuration(Math.min(step.target.min, step.target.max ?? step.target.min))} e ${spokenDuration(Math.max(step.target.min, step.target.max ?? step.target.min))} por quilômetro` : '';
  return `Agora: ${KIND[step.kind].toLowerCase()}${round}, ${size}${t}.`;
}
