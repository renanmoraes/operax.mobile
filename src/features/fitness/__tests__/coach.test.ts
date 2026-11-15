import { guideSteps, kmCue, paceVsTarget, spokenDuration, stepCue, stepProgress, stepTitle, targetText } from '../coach';
import type { FitnessPart } from '../types';

const part: FitnessPart = {
  type: 'endurance',
  name: 'Intervalado',
  sport: 'run',
  steps: [
    { kind: 'warmup', duration_seconds: 600 },
    { kind: 'repeat', repeats: 3, steps: [{ kind: 'interval', distance_meters: 400, target: { type: 'pace', min: 270, max: 285 } }, { kind: 'recovery', duration_seconds: 90 }] },
    { kind: 'cooldown' },
  ],
};

describe('treino do professor guiando a gravação', () => {
  it('abre os blocos repetidos na ordem, com a volta', () => {
    const s = guideSteps(part);
    expect(s.map(stepTitle)).toEqual(['Aquecimento 10 min', 'Tiro 400 m', 'Recuperação 1 min 30 s', 'Tiro 400 m', 'Recuperação 1 min 30 s', 'Tiro 400 m', 'Recuperação 1 min 30 s', 'Desaquecimento livre']);
    expect(s[3].round).toEqual({ n: 2, of: 3 });
    expect(guideSteps({ type: 'free_text', name: 'x', text: 'y' })).toEqual([]);
  });

  it('etapa por distância, por tempo e livre', () => {
    const [warm, tiro, , , , , , cool] = guideSteps(part);
    expect(stepProgress(tiro, 999, 280)).toEqual({ done: false, fraction: 0.7, leftMeters: 120 });
    expect(stepProgress(tiro, 0, 401).done).toBe(true);
    expect(stepProgress(warm, 300, 9999)).toEqual({ done: false, fraction: 0.5, leftSeconds: 300 });
    expect(stepProgress(warm, 600, 0).done).toBe(true);
    expect(stepProgress(cool, 5000, 5000)).toEqual({ done: false, fraction: 0 });
  });

  it('alvo do professor em texto e o ritmo contra ele', () => {
    const t = { type: 'pace' as const, min: 270, max: 285 };
    expect(targetText(t)).toBe(`Ritmo 4'30" a 4'45"/km`);
    expect(targetText({ type: 'hr_zone', min: 2 })).toBe('Zona 2 de FC');
    expect(targetText(undefined)).toBeNull();
    expect(paceVsTarget(260, t)).toBe('fast');
    expect(paceVsTarget(280, t)).toBe('ok');
    expect(paceVsTarget(287, t)).toBe('ok'); // folga do GPS
    expect(paceVsTarget(300, t)).toBe('slow');
    expect(paceVsTarget(280, { type: 'rpe', min: 6 })).toBeNull();
  });

  it('frases faladas em português natural', () => {
    expect(spokenDuration(312)).toBe('5 minutos e 12 segundos');
    expect(spokenDuration(45)).toBe('45 segundos');
    expect(spokenDuration(60)).toBe('1 minuto');
    expect(spokenDuration(3780)).toBe('1 hora e 3 minutos');
    expect(kmCue(3, 312, 320)).toBe('Quilômetro 3. Parcial de 5 minutos e 12 segundos. Ritmo médio de 5 minutos e 20 segundos por quilômetro.');
    expect(kmCue(10, 900, null, 27.6)).toBe('10 quilômetros. Velocidade média de 28 quilômetros por hora.');
    const s = guideSteps(part);
    expect(stepCue(s[3])).toBe('Agora: tiro, 2 de 3, 400 metros. Ritmo entre 4 minutos e 30 segundos e 4 minutos e 45 segundos por quilômetro.');
    expect(stepCue(s[0])).toBe('Agora: aquecimento, 10 minutos.');
  });
});
