import { templatesFor } from '../templates';
import { fromHistoryDetail, fromRecording, fromStrength } from '../fromSources';

const base = { title: 'X', company: 'Academia', date: '2026-11-15T07:00:00Z', seconds: 1800 };
const ids = (a: Parameters<typeof templatesFor>[0]) => templatesFor(a).map((t) => t.id);

describe('templatesFor', () => {
  it('corrida com rota e parciais mostra rota, parciais e mapa, sem modelos de academia', () => {
    const a = fromRecording(base, {
      sport: 'run',
      preferSpeed: false,
      distanceM: 5000,
      elevationGainM: 30,
      route: [
        [-19.5, -42.6],
        [-19.51, -42.61],
      ],
      kmMarks: [300_000, 610_000],
    });
    expect(ids(a)).toEqual(['route', 'routeBehind', 'routeStats', 'stats', 'row', 'receipt', 'bib', 'bibDark', 'splits', 'map', 'card', 'photo']);
  });

  it('gravação sem rota não mostra modelos de rota nem mapa', () => {
    const a = fromRecording(base, { sport: 'run', preferSpeed: false, distanceM: 900, elevationGainM: 0, route: [], kmMarks: [] });
    expect(ids(a)).toEqual(['stats', 'row', 'receipt', 'bib', 'bibDark', 'card', 'photo']);
  });

  it('academia com histórico e recordes mostra volume e recordes', () => {
    const a = fromStrength(base, {
      volumeKg: 4000,
      setsDone: 18,
      setsTotal: 18,
      records: [{ name: 'Supino', kg: 62.5 }],
      volumeHistory: [
        { label: '01/11', kg: 3800 },
        { label: 'Hoje', kg: 4000 },
      ],
    });
    expect(ids(a)).toEqual(['stats', 'row', 'receipt', 'bib', 'bibDark', 'volume', 'records', 'card', 'photo']);
  });

  it('academia sem dados extras fica só com os modelos gerais', () => {
    expect(ids(fromStrength(base, {}))).toEqual(['stats', 'row', 'receipt', 'bib', 'bibDark', 'card', 'photo']);
    // Treino prescrito com o planejado: entra o "treino cumprido".
    expect(ids({ ...fromStrength(base, {}), plan: { percent: 105, plannedMeters: 6000, plannedSeconds: null, doneMeters: 6300, doneSeconds: 2235 } })).toContain('plan');
  });
});

describe('percurso e números', () => {
  const { routeBehindStats } = require('../templates/parts') as typeof import('../templates/parts');
  it('segue a ordem da referência e usa a potência quando existe', () => {
    const a = fromHistoryDetail(
      { id: 'h', date: '2026-11-19', title: 'Pedal', modality: 'bike', distance_meters: 58350, duration_seconds: 9720, energy_kcal: 1063 } as never,
      { sport: 'bike', rate_unit: 'kmh', route: [[-19.5, -42.6], [-19.51, -42.61]], splits: [], summary: { avg_hr: 140, max_hr: 170, elevation_gain_m: 647, avg_cadence: 80, avg_power: 98 } } as never,
      'Move',
    );
    expect(routeBehindStats(a).map((s) => s.value)).toEqual(['58,35 km', '647 m', '2:42:00', '98 W', '21,6 km/h', '1.063 kcal']);
  });
});
