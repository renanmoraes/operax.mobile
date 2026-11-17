import { routeOfNotification, shouldSilenceInForeground } from '../presence';

const UUID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

describe('aviso com o app aberto', () => {
  it('descobre a tela que o aviso abre, do aluno (url) e da equipe (link)', () => {
    expect(routeOfNotification({ url: '/cliente/chat/rota40?x=1' })).toBe('/cliente/chat/rota40');
    expect(routeOfNotification({ notificationId: 'n1', link: `/inbox/${UUID}` })).toBe(`/conversation/${UUID}`);
    expect(routeOfNotification({ notificationId: 'n1', conversation_id: UUID })).toBe(`/conversation/${UUID}`);
    expect(routeOfNotification({})).toBeNull();
    expect(routeOfNotification(null)).toBeNull();
  });

  it('já está no chat da empresa do aluno: não avisa; em outra tela ou outra empresa: avisa', () => {
    const data = { url: '/cliente/chat/rota40', type: 'chat_message', tenant_slug: 'rota40' };
    expect(shouldSilenceInForeground(data, '/cliente/chat/rota40')).toBe(true);
    expect(shouldSilenceInForeground(data, '/inicio')).toBe(false);
    expect(shouldSilenceInForeground(data, '/cliente/chat/vida')).toBe(false);
    expect(shouldSilenceInForeground(data, '')).toBe(false);
  });

  it('equipe: na conversa do aviso não avisa, em outra conversa avisa', () => {
    const data = { notificationId: 'n1', link: `/inbox/${UUID}` };
    expect(shouldSilenceInForeground(data, `/conversation/${UUID}`)).toBe(true);
    expect(shouldSilenceInForeground(data, `/conversation/${OTHER}`)).toBe(false);
    expect(shouldSilenceInForeground(data, '/inbox')).toBe(false);
  });

  it('aviso que só abre uma lista nunca é silenciado', () => {
    expect(shouldSilenceInForeground({ notificationId: 'n1', link: '/kanban' }, '/notifications')).toBe(false);
    expect(shouldSilenceInForeground({ notificationId: 'n1' }, '/notifications')).toBe(false);
  });
});
