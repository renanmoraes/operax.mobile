import { mapApiConversation, mapApiMessage, mediaIdFrom } from '../mapConversation';

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

describe('mensagens no formato atual da API', () => {
  it('lê body_text e message_type (a linha do tempo não manda body/type)', () => {
    const m = mapApiMessage({ id: '1', direction: 'inbound', message_type: 'text', body_text: 'Oi! Queria marcar um horário.', status: 'accepted', created_at: '2026-11-14T19:23:54Z' }, 'c');
    expect(m.body).toBe('Oi! Queria marcar um horário.');
    expect(m.type).toBe('text');
    expect(m.status).toBe('sent');
  });

  it('acha o id da mídia em media_url (relativo ou só o id); link externo não tem id', () => {
    expect(mediaIdFrom({ media_url: '/api/media/cd3e0e8d-950d-5a86-9d80-899af52e2432/redirect' })).toBe('cd3e0e8d-950d-5a86-9d80-899af52e2432');
    expect(mediaIdFrom({ media_url: 'cd3e0e8d-950d-5a86-9d80-899af52e2432' })).toBe('cd3e0e8d-950d-5a86-9d80-899af52e2432');
    expect(mediaIdFrom({ media_url: 'https://cdn.exemplo/x.pdf' })).toBeUndefined();
    const audio = mapApiMessage({ id: '2', direction: 'inbound', message_type: 'audio', media_url: 'cd3e0e8d-950d-5a86-9d80-899af52e2432', created_at: '2026-11-14T19:23:54Z' }, 'c');
    expect(audio.type).toBe('audio');
    expect(audio.mediaId).toBe('cd3e0e8d-950d-5a86-9d80-899af52e2432');
  });

  it('modelo sem texto salvo mostra o nome do modelo', () => {
    expect(mapApiMessage({ id: '3', direction: 'outbound', message_type: 'template', template_name: 'lembrete_consulta', created_at: '2026-11-14T19:23:54Z' }, 'c').body).toBe('Modelo: lembrete_consulta');
  });
});

describe('conversa de marketplace', () => {
  it('não tem janela de 24 h: responde enquanto o canal mantiver a conversa aberta', () => {
    const c = mapApiConversation(
      {
        id: 'h1',
        status: 'open',
        channel: 'hub:mercado-livre',
        assigned_user_id: 'u1',
        contact: { name: 'Comprador' },
        service_window_expires_at: new Date(Date.now() - 3600_000).toISOString(),
      },
      'u1',
    );
    expect(c.within24h).toBe(true);
    expect(c.channel).toBe('hub:mercado-livre');
  });
});
