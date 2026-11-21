import { expandEarnedCards, type AchievementView } from '../achievements';

jest.mock('@/src/shared/api/client', () => ({ api: {} }));
jest.mock('@/src/features/client/dataMode', () => ({ clientDataMode: () => 'live' }));
jest.mock('@/src/features/client/useClientData', () => ({ useClientCapabilities: () => ({}) }));

const base = { name: 'x', color: '#000', xp: 1, tier: 1, progress: { current: 1, target: 1 }, requirements: [], new: false } as unknown as AchievementView;
const always = { kind: 'always', active: true, starts_on: null, ends_on: null, next_starts_on: null } as const;
const annual = { kind: 'annual', active: false, starts_on: null, ends_on: null, next_starts_on: null } as const;
const mk = (o: Partial<AchievementView>): AchievementView => ({ ...base, earned_editions: [], period: always, earned_at: null, ...o }) as AchievementView;

describe('cartas das conquistas', () => {
  it('ignora as não ganhas e ordena da mais recente para a mais antiga', () => {
    const cards = expandEarnedCards([mk({ ref: 'a', earned_at: '2026-03-01T10:00:00Z' }), mk({ ref: 'b' }), mk({ ref: 'c', earned_at: '2026-09-01T10:00:00Z' })]);
    expect(cards.map((c) => c.ref)).toEqual(['c', 'a']);
  });

  it('conquista que se repete vira uma carta por edição; só a mais recente tem data real e "nova"', () => {
    const cards = expandEarnedCards([mk({ ref: 'natal', period: annual, earned_at: '2026-12-10T10:00:00Z', earned_editions: [2024, 2026, 2025], new: true })]);
    expect(cards.map((c) => [c.editionYear, c.exact, c.new])).toEqual([[2026, true, true], [2025, false, false], [2024, false, false]]);
    expect(new Set(cards.map((c) => c.key)).size).toBe(3);
  });

  it('edição antiga ganha entra mesmo sem a edição atual ganha', () => {
    const cards = expandEarnedCards([mk({ ref: 'natal', period: annual, earned_at: null, earned_editions: [2025] })]);
    expect(cards.map((c) => [c.editionYear, c.exact])).toEqual([[2025, false]]);
  });

  it('edição única fica com uma carta só', () => {
    expect(expandEarnedCards([mk({ ref: 'a', earned_at: '2026-01-01T00:00:00Z', earned_editions: [] })])).toHaveLength(1);
  });
});
