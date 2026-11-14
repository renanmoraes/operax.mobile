import { buildResultBodies, flattenWorkout, nextPrescription, parseKg } from '../flatten';
import { WORKOUTS } from '../mockData';

describe('parseKg', () => {
  it('lê carga com vírgula e unidade', () => {
    expect(parseKg('12,5 kg')).toBe(12.5);
    expect(parseKg('40 kg')).toBe(40);
    expect(parseKg(undefined)).toBe(0);
  });
});

describe('flattenWorkout', () => {
  const rows = flattenWorkout(WORKOUTS[0]);

  it('uma linha por exercício, na ordem da ficha', () => {
    expect(rows.map((r) => r.name).slice(0, 2)).toEqual(['Supino reto com barra', 'Supino inclinado com halteres']);
    expect(rows).toHaveLength(7);
  });

  it('bloco combinado vira uma linha com o rótulo do bloco e as cargas em sequência', () => {
    const drop = rows[6];
    expect(drop.tag).toBe('Drop set');
    expect(drop.loadLabel).toBe('25 → 15 kg');
    // 3 rodadas × 3 estágios: cada estágio com a própria carga e repetições, descanso só no fim da rodada
    expect(drop.sets).toHaveLength(9);
    expect(drop.sets.slice(0, 3)).toEqual([
      { kg: 25, reps: 10, rest: 0 },
      { kg: 20, reps: 8, rest: 0 },
      { kg: 15, reps: 8, rest: 75 },
    ]);
  });

  it('resume séries e prescrição', () => {
    expect(rows[0].prescription).toBe('4 × 10 · 40 kg');
    expect(rows[0].kg).toBe(40);
    expect(rows[0].restSeconds).toBe(60);
  });
});

describe('nextPrescription', () => {
  const row = { kg: 25, reps: 10, sets: [{ kg: 25, reps: 10 }, { kg: 20, reps: 8 }, { kg: 15, reps: 8 }] };
  it('ao retomar o drop set, volta no estágio seguinte', () => {
    expect(nextPrescription(row, 0)).toEqual({ kg: 25, reps: 10 });
    expect(nextPrescription(row, 1)).toEqual({ kg: 20, reps: 8 });
    expect(nextPrescription(row, 3)).toEqual({ kg: 15, reps: 8 });
  });
  it('sem séries, usa a prescrição do exercício', () => {
    expect(nextPrescription({ kg: 10, reps: 12, sets: [] }, 0)).toEqual({ kg: 10, reps: 12 });
  });
});

describe('buildResultBodies', () => {
  const rows = [
    { partIndex: 1, itemIndex: 0 },
    { partIndex: 1, itemIndex: 1 },
    { partIndex: 3, itemIndex: 0 },
  ];
  const base = { workout_id: 'w', executed_on: '2026-11-14', idempotency_key: 'k', notes: 'ótimo', effort: 7 };

  it('um resultado por parte, com o item de cada série dentro da parte', () => {
    const bodies = buildResultBodies(rows, [[{ kg: 50, reps: 10 }], [], [{ kg: 20, reps: 8 }, { kg: 15, reps: 8 }]], base);
    expect(bodies.map((b) => b.part_index)).toEqual([1, 3]);
    expect(bodies[0].data).toEqual({ kind: 'sets', sets: [{ item: 0, set: 0, done: true, load_kg: 50, reps: 10 }] });
    expect(bodies[1].data).toEqual({ kind: 'sets', sets: [{ item: 0, set: 0, done: true, load_kg: 20, reps: 8 }, { item: 0, set: 1, done: true, load_kg: 15, reps: 8 }] });
  });

  it('chave fixa por parte (tentar de novo não duplica) e comentário só no primeiro', () => {
    const logs = [[{ kg: 50, reps: 10 }], [], [{ kg: 20, reps: 8 }]];
    const a = buildResultBodies(rows, logs, base);
    const b = buildResultBodies(rows, logs, base);
    expect(a.map((x) => x.idempotency_key)).toEqual(['k-p1', 'k-p3']);
    expect(b.map((x) => x.idempotency_key)).toEqual(a.map((x) => x.idempotency_key));
    expect(a[0].notes).toBe('ótimo');
    expect(a[1].notes).toBeUndefined();
  });

  it('as linhas do treino guardam parte e item originais', () => {
    const r = flattenWorkout(WORKOUTS[0]);
    expect(r.every((x) => x.key === `${x.partIndex}:${x.itemIndex}`)).toBe(true);
  });
});
