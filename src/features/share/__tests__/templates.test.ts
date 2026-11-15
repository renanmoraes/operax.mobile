import { templatesFor } from '../templates';
import { fromRecording, fromStrength } from '../fromSources';

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
    expect(ids(a)).toEqual(['route', 'routeStats', 'stats', 'row', 'splits', 'map', 'card', 'photo']);
  });

  it('gravação sem rota não mostra modelos de rota nem mapa', () => {
    const a = fromRecording(base, { sport: 'run', preferSpeed: false, distanceM: 900, elevationGainM: 0, route: [], kmMarks: [] });
    expect(ids(a)).toEqual(['stats', 'row', 'card', 'photo']);
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
    expect(ids(a)).toEqual(['stats', 'row', 'volume', 'records', 'card', 'photo']);
  });

  it('academia sem dados extras fica só com os modelos gerais', () => {
    expect(ids(fromStrength(base, {}))).toEqual(['stats', 'row', 'card', 'photo']);
  });
});
