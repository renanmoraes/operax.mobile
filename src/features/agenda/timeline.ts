/** Linha do tempo do dia: posição de cada compromisso, colunas para os que se sobrepõem e faixa de horas. */

export type TimelineEvent = { id: string; startMin: number; endMin: number };
export type PlacedEvent<T extends TimelineEvent> = T & { top: number; height: number; lane: number; lanes: number };

export const HOUR_H = 88;
export const MIN_EVENT_H = 46;

/** "14:30" ou ISO → minutos desde a meia-noite (horário local). */
export function toMinutes(v: string): number {
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getHours() * 60 + d.getMinutes();
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Das 7h às 20h por padrão, abrindo para caber os compromissos e a hora atual. */
export function hourRange(events: TimelineEvent[], now: number, base: [number, number] = [7, 20]): [number, number] {
  let start = base[0];
  let end = base[1];
  for (const e of events) {
    start = Math.min(start, Math.floor(e.startMin / 60));
    end = Math.max(end, Math.ceil(e.endMin / 60));
  }
  start = Math.min(start, Math.floor(now / 60));
  end = Math.max(end, Math.ceil((now + 1) / 60));
  return [Math.max(0, start), Math.min(24, end)];
}

export function yFor(min: number, startHour: number): number {
  return ((min - startHour * 60) / 60) * HOUR_H;
}

/**
 * Compromissos que se cruzam dividem a largura em colunas (como no calendário do iPhone).
 * Cada grupo de sobreposição recebe o mesmo número de colunas.
 */
export function layoutEvents<T extends TimelineEvent>(events: T[], startHour: number): PlacedEvent<T>[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: PlacedEvent<T>[] = [];
  let group: PlacedEvent<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const g of group) g.lanes = lanes;
    out.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const e of sorted) {
    if (group.length && e.startMin >= groupEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.endMin);
    } else laneEnds[lane] = e.endMin;
    groupEnd = Math.max(groupEnd, e.endMin);
    const top = yFor(e.startMin, startHour);
    const height = Math.max(MIN_EVENT_H, yFor(e.endMin, startHour) - top - 3);
    group.push({ ...e, top, height, lane, lanes: 1 });
  }
  if (group.length) flush();
  return out;
}

/** "Agora", "Em 25 min", "Há 2 h"… para o compromisso em relação à hora atual. */
export function relativeLabel(startMin: number, endMin: number, now: number): string | null {
  if (now >= startMin && now < endMin) return 'Agora';
  const diff = Math.round(startMin - now);
  if (diff > 0 && diff <= 60) return `Em ${diff} min`;
  return null;
}

export function clockLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
