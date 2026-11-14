import { absoluteMediaUrl, mapApiChannel, mapApiMessage, messageTypeOf, previewOf, sortChannels, TeamChannel, timeLabel, unreadTotal } from '../model';

const ch = (p: Partial<TeamChannel>): TeamChannel => ({
  id: 'x',
  kind: 'group',
  title: 'X',
  preview: null,
  previewAuthor: null,
  lastAt: null,
  unread: 0,
  pinned: false,
  ...p,
});

describe('chat interno: modelo', () => {
  it('usa o nome do colega nas diretas e o nome do grupo nos grupos', () => {
    expect(mapApiChannel({ id: '1', type: 'dm', name: null, unread_count: 2, peer: { user_id: 'u2', name: 'Juliana' } }).title).toBe('Juliana');
    expect(mapApiChannel({ id: '2', type: 'group', name: 'Recepção', unread_count: 0, pinned_at: '2026-11-14T10:00:00Z' })).toMatchObject({ title: 'Recepção', kind: 'group', pinned: true });
  });

  it('ordena fixadas, depois com não lidas, depois mais recentes', () => {
    const list = sortChannels([
      ch({ id: 'old', lastAt: '2026-11-10T10:00:00Z' }),
      ch({ id: 'new', lastAt: '2026-11-14T10:00:00Z' }),
      ch({ id: 'unread', unread: 2, lastAt: '2026-11-01T10:00:00Z' }),
      ch({ id: 'pin', pinned: true }),
    ]);
    expect(list.map((c) => c.id)).toEqual(['pin', 'unread', 'new', 'old']);
  });

  it('soma as não lidas para o contador da aba Mais', () => {
    expect(unreadTotal([ch({ unread: 3 }), ch({ unread: 0 }), ch({ unread: 2 })])).toBe(5);
  });

  it('identifica o tipo pela mídia e monta o link absoluto do backend', () => {
    expect(messageTypeOf('image/png', true)).toBe('image');
    expect(messageTypeOf('audio/mp4', true)).toBe('audio');
    expect(messageTypeOf('application/pdf', true)).toBe('document');
    expect(messageTypeOf(null, false)).toBe('text');
    expect(absoluteMediaUrl('/api/media/abc/redirect', 'https://api.x/')).toBe('https://api.x/api/media/abc/redirect');
    expect(absoluteMediaUrl('https://cdn/x.jpg', 'https://api.x')).toBe('https://cdn/x.jpg');
  });

  it('marca como minha a mensagem do próprio usuário e esconde texto apagado', () => {
    const m = mapApiMessage({ id: 'm', channel_id: 'c', sender_id: 'u1', body: 'oi', created_at: '2026-11-14T10:00:00Z' }, 'u1', 'https://api');
    expect(m).toMatchObject({ mine: true, type: 'text', body: 'oi' });
    const gone = mapApiMessage({ id: 'm', channel_id: 'c', sender_id: 'u2', body: 'x', deleted_at: '2026-11-14T10:00:00Z', created_at: '2026-11-14T10:00:00Z' }, 'u1', 'https://api');
    expect(gone).toMatchObject({ mine: false, body: 'Mensagem apagada', senderName: 'Equipe' });
  });

  it('resume mídia na lista e no aviso', () => {
    expect(previewOf({ type: 'audio', body: 'Áudio' })).toBe('Áudio');
    expect(previewOf({ type: 'image', body: '' })).toBe('Foto');
    expect(previewOf({ type: 'document', body: '', fileName: 'laudo.pdf' })).toBe('laudo.pdf');
  });

  it('mostra hora hoje, "Ontem" e data antes da semana', () => {
    const now = new Date(2026, 10, 14, 15, 0);
    expect(timeLabel(new Date(2026, 10, 14, 9, 5).toISOString(), now)).toMatch(/09:05/);
    expect(timeLabel(new Date(2026, 10, 13, 9, 5).toISOString(), now)).toBe('Ontem');
    expect(timeLabel(new Date(2026, 10, 1, 9, 5).toISOString(), now)).toBe('01/11');
    expect(timeLabel(null, now)).toBe('');
  });
});
