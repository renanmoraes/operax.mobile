import { flattenWorkout } from '../flatten';
import { WORKOUTS } from '../mockData';
import { exerciseStatus, nextOpenIndex, transitionRest } from '../sessionStatus';

const rows = flattenWorkout(WORKOUTS[0]); // 7 linhas; rows[6] é o drop set (3 estágios x 3 rodadas = 9 sets)

describe('exerciseStatus', () => {
  it('é "active" quando é o índice atual, mesmo sem nenhuma série feita', () => {
    expect(exerciseStatus(rows[0], [], true)).toBe('active');
  });

  it('é "pending" sem nenhuma série e não é o atual', () => {
    expect(exerciseStatus(rows[0], [], false)).toBe('pending');
  });

  it('é "incomplete" com série feita mas não todas, e não é o atual', () => {
    expect(exerciseStatus(rows[0], [{ kg: 40, reps: 10 }], false)).toBe('incomplete');
  });

  it('é "done" com todas as séries feitas', () => {
    const done = rows[0].sets.map((s) => ({ kg: s.kg, reps: s.reps }));
    expect(exerciseStatus(rows[0], done, false)).toBe('done');
  });

  it('é "done" com mais séries logadas do que planejadas', () => {
    const extra = [...rows[0].sets, { kg: 50, reps: 5 }].map((s) => ({ kg: s.kg, reps: s.reps }));
    expect(exerciseStatus(rows[0], extra, false)).toBe('done');
  });

  it('é "done" quando não há séries planejadas (trivialmente concluído, intencional)', () => {
    expect(exerciseStatus({ ...rows[0], sets: [] }, [], false)).toBe('done');
  });
});

describe('nextOpenIndex', () => {
  const emptyLogs = rows.map(() => []);

  it('acha o próximo índice sem todas as séries, só pra frente', () => {
    expect(nextOpenIndex(rows, emptyLogs, 0)).toBe(1);
  });

  it('pula um exercício já "done" no meio do caminho', () => {
    const logs = rows.map((r, i) => (i === 1 ? r.sets.map((s) => ({ kg: s.kg, reps: s.reps })) : []));
    expect(nextOpenIndex(rows, logs, 0)).toBe(2);
  });

  it('não dá a volta: um não concluído antes de "from" não conta', () => {
    // só o índice 1 está aberto; a partir de 5 não há nada pra frente
    const logs = rows.map((r, i) => (i === 1 ? [] : r.sets.map((s) => ({ kg: s.kg, reps: s.reps }))));
    expect(nextOpenIndex(rows, logs, 5)).toBe(-1);
  });

  it('retorna -1 quando não sobra nenhum não concluído dali pra frente', () => {
    const logs = rows.map((r) => r.sets.map((s) => ({ kg: s.kg, reps: s.reps })));
    expect(nextOpenIndex(rows, logs, 3)).toBe(-1);
  });

  it('retorna -1 quando o "from" já é o último índice', () => {
    expect(nextOpenIndex(rows, emptyLogs, rows.length - 1)).toBe(-1);
  });

  it('retorna -1 quando o "from" está além do último índice', () => {
    expect(nextOpenIndex(rows, emptyLogs, rows.length)).toBe(-1);
  });
});

describe('transitionRest', () => {
  it('anel regressivo quando o último set do exercício tem descanso > 0', () => {
    const row = { ...rows[0], sets: rows[0].sets.map((s, i, arr) => (i === arr.length - 1 ? { ...s, rest: 45 } : s)) };
    expect(transitionRest(row)).toEqual({ kind: 'ring', seconds: 45 });
  });

  it('cronômetro crescente quando o último set não tem "rest" definido', () => {
    const row = { ...rows[0], sets: rows[0].sets.map((s) => ({ ...s, rest: undefined })) };
    expect(transitionRest(row)).toEqual({ kind: 'stopwatch' });
  });

  it('cronômetro crescente quando o último set tem "rest" explicitamente 0', () => {
    const row = { ...rows[0], sets: rows[0].sets.map((s, i, arr) => (i === arr.length - 1 ? { ...s, rest: 0 } : s)) };
    expect(transitionRest(row)).toEqual({ kind: 'stopwatch' });
  });
});
