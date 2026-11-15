import { buildResult, parseClock } from '../results';
import type { FitnessPart } from '../types';

const empty = { time: '', rounds: '', reps: '', kg: '', calories: '', meters: '', km: '' };
const metcon = (result_type: Extract<FitnessPart, { type: 'metcon' }>['result_type']): FitnessPart => ({ type: 'metcon', name: 'WOD', format: 'for_time', result_type, movements: [] });

describe('registrar resultado', () => {
  it('lê tempo como min:seg, h:min:seg ou só minutos', () => {
    expect(parseClock('12:34')).toBe(754);
    expect(parseClock('1:02:03')).toBe(3723);
    expect(parseClock('25')).toBe(1500);
    expect(parseClock('abc')).toBeNull();
  });

  it('monta o resultado no formato do backend para cada modalidade', () => {
    expect(buildResult(metcon('time'), { ...empty, time: '9:30' })).toEqual({ data: { kind: 'time', seconds: 570 } });
    expect(buildResult(metcon('rounds_reps'), { ...empty, rounds: '5', reps: '12' })).toEqual({ data: { kind: 'rounds_reps', rounds: 5, reps: 12 } });
    expect(buildResult({ type: 'hyrox', name: 'H', steps: [] }, { ...empty, time: '1:15:00' })).toEqual({ data: { kind: 'hyrox', total_seconds: 4500 } });
    expect(buildResult({ type: 'endurance', name: 'Natação', sport: 'swim', steps: [] }, { ...empty, km: '1,5' })).toEqual({ data: { kind: 'endurance', distance_m: 1500 } });
    expect(buildResult({ type: 'free_text', name: 'x', text: 'y' }, empty)).toEqual({ data: { kind: 'done' } });
  });

  it('explica o que falta', () => {
    expect(buildResult(metcon('time'), empty)).toEqual({ error: 'Informe o tempo (ex.: 12:34)' });
    expect(buildResult({ type: 'endurance', name: 'Corrida', sport: 'run', steps: [] }, empty)).toEqual({ error: 'Informe o tempo ou a distância' });
  });
});

describe('campo de tempo e números vazios', () => {
  it('máscara de cronômetro para o teclado numérico', () => {
    const { maskClock, parseClock } = jest.requireActual('../results') as typeof import('../results');
    expect(maskClock('5')).toBe('0:05');
    expect(maskClock('1234')).toBe('12:34');
    expect(maskClock('11500')).toBe('1:15:00');
    expect(maskClock('12:34')).toBe('12:34');
    expect(maskClock('')).toBe('');
    expect(parseClock(maskClock('1234'))).toBe(754);
  });
  it('campo obrigatório vazio não vira zero', () => {
    const { buildResult } = jest.requireActual('../results') as typeof import('../results');
    const empty = { time: '', rounds: '', reps: '', kg: '', calories: '', meters: '', km: '' };
    for (const result_type of ['rounds_reps', 'reps', 'load', 'calories', 'distance'] as const) {
      const r = buildResult({ type: 'metcon', name: 'WOD', format: 'amrap', result_type, movements: [] } as never, empty);
      expect('error' in r).toBe(true);
    }
    const zero = buildResult({ type: 'metcon', name: 'WOD', format: 'amrap', result_type: 'reps', movements: [] } as never, { ...empty, reps: '0' });
    expect('data' in zero).toBe(true);
  });
});
