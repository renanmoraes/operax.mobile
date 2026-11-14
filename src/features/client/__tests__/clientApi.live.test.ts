import * as portal from '@/src/shared/api/portal.api';
import * as clientApi from '../clientApi';
import { setClientDataMode } from '../dataMode';

jest.mock('@/src/shared/api/portal.api', () => ({
  portalHome: jest.fn(),
  portalMyCompanies: jest.fn(),
  portalChat: jest.fn(),
  portalChatMedia: jest.fn(),
  portalSendChat: jest.fn(),
  portalConfirmBooking: jest.fn(),
  portalCancelBooking: jest.fn(),
  portalClassAction: jest.fn(),
}));

const m = portal as jest.Mocked<typeof portal>;

const home = (over: Partial<portal.PortalHome> = {}): portal.PortalHome => ({
  tenant_slug: 'clinica',
  brand_name: 'Clínica Exemplo',
  logo_url: null,
  contact: { id: 'c1', name: 'Ana', email: null },
  capabilities: { scheduling: true, chat: true, training: false },
  bookings: [
    { id: 'b1', starts_at: '2026-11-20T13:00:00Z', ends_at: '2026-11-20T14:00:00Z', status: 'approved', service_name: 'Consulta', provider_name: 'Dr. R', can_confirm: true, can_cancel: true },
    { id: 'k1', starts_at: '2026-11-19T10:00:00Z', ends_at: '2026-11-19T11:00:00Z', status: 'offered', service_name: 'Funcional', provider_name: null, can_confirm: false, can_cancel: false, kind: 'class', can_accept: true },
  ],
  badges: { chat: 0, training: 0 },
  ...over,
});

describe('dados do cliente com o login real (portal)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    clientApi.resetClientCache();
    setClientDataMode('live');
  });
  afterAll(() => setClientDataMode('mock'));

  it('agenda vem de me/home, em ordem e com os status do app', async () => {
    m.portalHome.mockResolvedValue(home());
    const list = await clientApi.fetchBookings();
    expect(list.map((b) => [b.id, b.status])).toEqual([
      ['k1', 'offer'],
      ['b1', 'pending'],
    ]);
  });

  it('cancelar aula usa a rota da turma; compromisso usa me/bookings', async () => {
    m.portalHome.mockResolvedValue(home());
    await clientApi.cancelBooking('k1', 'x');
    expect(m.portalClassAction).toHaveBeenCalledWith('k1', 'cancel');
    await clientApi.cancelBooking('b1', 'Imprevisto');
    expect(m.portalCancelBooking).toHaveBeenCalledWith('b1', 'Imprevisto');
  });

  it('desfazer não existe no portal: explica em vez de fingir', async () => {
    await expect(clientApi.unconfirmBooking('b1')).rejects.toThrow(/chat/);
    await expect(clientApi.changeClassBooking('k1', 'reset')).rejects.toThrow(/equipe/);
  });

  it('a lista de conversas não abre a conversa quando há mensagem nova (abrir marca como lida)', async () => {
    m.portalHome.mockResolvedValue(home({ badges: { chat: 2, training: 0 } }));
    const [chat] = await clientApi.fetchChats();
    expect(chat.unread).toBe(2);
    expect(m.portalChat).not.toHaveBeenCalled();
  });

  it('abrir a conversa busca o histórico e o link dos anexos', async () => {
    m.portalHome.mockResolvedValue(home());
    m.portalChat.mockResolvedValue({
      service_hours_text: null,
      whatsapp_url: null,
      messages: [
        { id: 'm1', from: 'team', text: 'Oi', at: '2026-11-14T10:00:00Z', attachment: null },
        { id: 'm2', from: 'team', text: '', at: '2026-11-14T10:01:00Z', attachment: { kind: 'image' } },
      ],
    });
    m.portalChatMedia.mockResolvedValue({ url: 'https://cdn/x.jpg' });
    const chat = await clientApi.fetchChatThread('clinica');
    expect(chat?.messages[1].attachment).toMatchObject({ kind: 'image', uri: 'https://cdn/x.jpg' });
    expect(m.portalChatMedia).toHaveBeenCalledTimes(1);
  });

  it('envia só texto e leva o pedido de outro horário junto', async () => {
    await clientApi.sendChatMessage('clinica', { text: 'Posso trocar?', reschedule: { booking_id: 'b1', title: 'Consulta', original_at: '2026-11-20T13:00:00Z' } });
    expect(m.portalSendChat.mock.calls[0][0]).toMatch(/^Posso trocar\?\n\nSobre: Consulta/);
    await expect(clientApi.sendChatMessage('clinica', { text: '', attachment: { kind: 'image', uri: 'file://a' } })).rejects.toThrow(/texto/);
  });

  it('a prévia guardada de uma pessoa não aparece para outra na mesma empresa', async () => {
    m.portalHome.mockResolvedValue(home());
    m.portalChat.mockResolvedValue({ service_hours_text: null, whatsapp_url: null, messages: [{ id: 'm1', from: 'me', text: 'segredo da Ana', at: '2026-11-14T10:00:00Z', attachment: null }] });
    await clientApi.fetchChatThread('clinica');
    m.portalHome.mockResolvedValue(home({ contact: { id: 'c2', name: 'Bia', email: null }, badges: { chat: 1, training: 0 } }));
    const [chat] = await clientApi.fetchChats();
    expect(chat.messages).toEqual([]);
    expect(chat.unread).toBe(1);
  });
});
