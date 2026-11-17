import { mapApiMessage } from '../mapConversation';

const base = { id: 'm1', direction: 'outbound', body_text: 'Muito obrigado por entrar em contato!', created_at: '2026-11-17T17:15:00Z' };

describe('mensagem de outra conversa do contato', () => {
  it('da conversa aberta: nada a marcar', () => {
    expect(mapApiMessage({ ...base, conversation_id: 'c1' }, 'c1').otherConversation).toBeUndefined();
    expect(mapApiMessage(base, 'c1').otherConversation).toBeUndefined();
  });

  it('de outro número ou canal do mesmo contato: marca de onde veio', () => {
    const m = mapApiMessage({ ...base, conversation_id: 'c2', source_channel: 'webchat', source_connection_id: 'x1' }, 'c1');
    expect(m.otherConversation).toEqual({ channel: 'webchat', connectionId: 'x1' });
    expect(m.body).toBe('Muito obrigado por entrar em contato!');
  });
});
