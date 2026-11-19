import { datesToFetch, doneKey, emptyStore, enforceLimits, markDone, prune, putDay, weekFromStore } from '../offlineStore';
import type { FitnessWorkoutView } from '../types';

jest.mock('@/src/shared/db/localDb', () => ({ kvGet: async () => null, kvSet: async () => undefined, kvSetDurable: async () => undefined }));

const w = (id: string, pad = 0): FitnessWorkoutView => ({
  id, title: `Treino ${id}`, modality: 'strength', destination: 'individual', parts: [], exercise_snapshots: [],
  schedule: { mode: 'daily', starts_on: '2026-11-01', timezone: 'America/Sao_Paulo' }, created_at: '', updated_at: '',
  coach_note: 'x'.repeat(pad),
});

describe('treinos baixados para uso offline', () => {
  it('datesToFetch cobre hoje até 14 dias à frente', () => {
    const d = datesToFetch('2026-11-19');
    expect(d[0]).toBe('2026-11-19');
    expect(d).toHaveLength(15);
    expect(d[14]).toBe('2026-12-03');
  });

  it('putDay não baixa de novo o que já foi feito e confirmado', () => {
    const s = markDone(emptyStore(), 'a', '2026-11-20');
    const next = putDay(s, '2026-11-20', [w('a'), w('b')]);
    expect(next.days['2026-11-20']).toEqual(['b']);
    expect(next.workouts.a).toBeUndefined();
  });

  it('limite de fichas: sai primeiro o dia mais distante', () => {
    let s = emptyStore();
    ['2026-11-20', '2026-11-21', '2026-11-22'].forEach((d, i) => (s = putDay(s, d, [w(`w${i}`)])));
    const out = enforceLimits(s, { workouts: 2, bytes: 1e9 });
    expect(Object.keys(out.days)).toEqual(['2026-11-20', '2026-11-21']);
    expect(Object.keys(out.workouts).sort()).toEqual(['w0', 'w1']);
  });

  it('limite de bytes também vale', () => {
    let s = emptyStore();
    ['2026-11-20', '2026-11-21'].forEach((d, i) => (s = putDay(s, d, [w(`w${i}`, 5000)])));
    const out = enforceLimits(s, { workouts: 99, bytes: 7000 });
    expect(Object.keys(out.days)).toEqual(['2026-11-20']);
  });

  it('prune tira o feito e o que passou, mas preserva ficha com resultado na fila', () => {
    let s = emptyStore();
    s = putDay(s, '2026-11-18', [w('old'), w('pend')]);
    s = putDay(s, '2026-11-19', [w('sent')]);
    s = putDay(s, '2026-11-25', [w('future')]);
    s = markDone(s, 'sent', '2026-11-19');
    const out = prune(s, '2026-11-19', new Set(['pend']));
    expect(out.workouts.old).toBeUndefined();
    expect(out.workouts.sent).toBeUndefined();
    expect(out.workouts.pend).toBeDefined();
    expect(out.workouts.future).toBeDefined();
    expect(out.days['2026-11-25']).toEqual(['future']);
  });

  it('prune esquece marcas de feito muito antigas', () => {
    const s = { ...emptyStore(), done: [doneKey('a', '2026-01-01'), doneKey('b', '2026-11-18')] };
    expect(prune(s, '2026-11-19').done).toEqual([doneKey('b', '2026-11-18')]);
  });

  it('weekFromStore monta a semana com as fichas baixadas e aponta a próxima', () => {
    const s = putDay(emptyStore(), '2026-11-20', [w('a')]);
    const week = weekFromStore(s, '2026-11-19');
    expect(week.days.find((d) => d.date === '2026-11-20')?.items?.[0].id).toBe('a');
    expect(week.next?.date).toBe('2026-11-20');
    expect(week.days).toHaveLength(7);
  });
});
