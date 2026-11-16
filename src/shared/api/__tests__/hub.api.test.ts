import { getHubConversationContext } from '../hub.api';

const mockGet = jest.fn();
jest.mock('../client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }));

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

describe('contexto da conversa de marketplace', () => {
  beforeEach(() => mockGet.mockReset());

  it('busca a mesma rota do site', async () => {
    mockGet.mockResolvedValue({ data: { provider: 'mercado-livre', account_name: 'Loja', thread_kind: 'buyer_chat', closed_remotely: false, orders: [] } });
    const ctx = await getHubConversationContext('c1');
    expect(mockGet.mock.calls[0][0]).toBe('/api/apps/commercial-hub/conversations/c1/context');
    expect(ctx?.account_name).toBe('Loja');
  });

  it('sem o app do Hub ou sem acesso, a tela segue sem a faixa', async () => {
    mockGet.mockRejectedValueOnce(httpError(403));
    await expect(getHubConversationContext('c1')).resolves.toBeNull();
    mockGet.mockRejectedValueOnce(httpError(404));
    await expect(getHubConversationContext('c1')).resolves.toBeNull();
  });

  it('erro de rede ou de servidor sobe para tentar de novo', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));
    await expect(getHubConversationContext('c1')).rejects.toThrow();
  });
});
