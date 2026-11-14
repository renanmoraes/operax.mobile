import { linkToAppRoute } from '../linkRoute';

const id = '2f3a4b89-70fd-4bf3-af64-f383c60a52bf';

describe('link do push → tela do app', () => {
  it('atendimento, chat da equipe, contato, agenda e kanban', () => {
    expect(linkToAppRoute(`/inbox/${id}`)).toBe(`/conversation/${id}`);
    expect(linkToAppRoute(`/chat/${id}`)).toBe(`/equipe/${id}`);
    expect(linkToAppRoute(`/contacts/${id}`)).toBe(`/contact/${id}`);
    expect(linkToAppRoute('/agenda')).toBe('/agenda');
    expect(linkToAppRoute('/kanban?card=1')).toBe('/kanban');
  });

  it('sem link usa os dados do aviso; o resto vai para Avisos', () => {
    expect(linkToAppRoute(null, { conversation_id: id })).toBe(`/conversation/${id}`);
    expect(linkToAppRoute(undefined, { channel_id: id })).toBe(`/equipe/${id}`);
    expect(linkToAppRoute('/apps/finance/payables?due=soon')).toBe('/notifications');
    expect(linkToAppRoute('https://externo')).toBe('/notifications');
  });
});
