import { sortForHome } from '../sortConversations';

describe('sortForHome', () => {
  it('puts unread before read', () => {
    const a = { id: '1', unread: 0, updatedAt: '11:00' };
    const b = { id: '2', unread: 2, updatedAt: '10:00' };
    expect(sortForHome([a, b]).map((c) => c.id)).toEqual(['2', '1']);
  });

  it('prioritizes critical urgency over unread count', () => {
    const a = { id: '1', unread: 5, updatedAt: '12:00', urgency: 'normal' as const };
    const b = { id: '2', unread: 0, updatedAt: '09:00', urgency: 'critical' as const };
    expect(sortForHome([a, b]).map((c) => c.id)).toEqual(['2', '1']);
  });
});
