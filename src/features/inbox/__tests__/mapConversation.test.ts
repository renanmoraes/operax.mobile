import { mapApiConversation, mapApiMessage } from '../mapConversation';

describe('mapConversation', () => {
  it('marca fila quando sem assigned', () => {
    const c = mapApiConversation(
      {
        id: '1',
        status: 'open',
        assigned_user_id: null,
        current_queue_name: 'Recepção',
        contact: { name: 'Maria' },
        service_window_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
      'u1',
    );
    expect(c.ownership).toBe('queue');
    expect(c.segment).toBe('queue');
    expect(c.contactName).toBe('Maria');
    expect(c.within24h).toBe(true);
  });

  it('marca mine quando assigned ao user', () => {
    const c = mapApiConversation(
      {
        id: '2',
        status: 'open',
        assigned_user_id: 'u1',
        contact: { name: 'João' },
      },
      'u1',
    );
    expect(c.ownership).toBe('mine');
    expect(c.segment).toBe('active');
  });

  it('mapeia mensagem inbound/outbound', () => {
    const m = mapApiMessage(
      {
        id: 'm1',
        direction: 'inbound',
        type: 'text',
        body: 'oi',
        created_at: '2026-07-25T12:00:00.000Z',
      },
      'cv1',
    );
    expect(m.direction).toBe('in');
    expect(m.body).toBe('oi');
  });

  it('mídia sem legenda não vira texto da bolha', () => {
    const m = mapApiMessage({ id: 'm2', direction: 'inbound', type: 'image', body: null, media_id: 'x1', created_at: '2026-07-25T12:00:00.000Z' }, 'cv1');
    expect(m.type).toBe('image');
    expect(m.caption).toBeUndefined();
    expect(m.body).toBe('[image]');
  });

  it('mídia com legenda guarda a legenda', () => {
    const m = mapApiMessage({ id: 'm3', direction: 'outbound', type: 'image', caption: 'Olha o resultado', media_id: 'x2', created_at: '2026-07-25T12:00:00.000Z' }, 'cv1');
    expect(m.caption).toBe('Olha o resultado');
  });
});
