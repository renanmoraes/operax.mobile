import {
  categoryForType,
  defaultNotificationPrefs,
  PUSH_CATEGORIES,
} from '../catalog';

describe('push catalog', () => {
  it('tem categorias obrigatórias do produto', () => {
    const ids = PUSH_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'queue_new',
        'claimed_message',
        'ownership_expiring',
        'chat_message',
        'chat_mention',
        'booking_new',
        'booking_reschedule',
        'reminder',
      ]),
    );
  });

  it('defaults todos ligados', () => {
    const prefs = defaultNotificationPrefs();
    expect(prefs.push).toBe(true);
    expect(prefs.sound).toBe(true);
    for (const cat of PUSH_CATEGORIES) {
      expect(prefs.categories[cat.id]).toBe(true);
    }
  });

  it('mapeia types para categorias', () => {
    expect(categoryForType('queue.new')).toBe('queue_new');
    expect(categoryForType('conversation.message')).toBe('claimed_message');
    expect(categoryForType('chat.mention')).toBe('chat_mention');
    expect(categoryForType('scheduling.booking_reschedule')).toBe('booking_reschedule');
  });
});
