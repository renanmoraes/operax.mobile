import { api } from './client';

/** Tipo de conversa no canal: conversa com o comprador, pós-venda, pergunta no anúncio ou atendimento do canal. */
export type HubThreadKind = 'buyer_chat' | 'post_sale' | 'product_question' | 'support_ticket';

/** Por qual loja a resposta sai e quais pedidos estão ligados à conversa de marketplace (mesma rota do site). */
export interface HubConversationContext {
  provider: string;
  account_name: string;
  thread_kind: HubThreadKind;
  /** O canal encerrou ou bloqueou a conversa: não dá para responder. */
  closed_remotely: boolean;
  /** Nulo quando o perfil não pode ver pedidos do Hub; vazio quando a conversa não tem pedido. */
  orders: { id: string; external_order_id: string; external_order_number: string | null; canonical_status: string }[] | null;
}

export async function getHubConversationContext(conversationId: string): Promise<HubConversationContext | null> {
  try {
    const { data } = await api.get(`/api/apps/commercial-hub/conversations/${conversationId}/context`);
    return data as HubConversationContext;
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    // Sem o app do Hub, sem acesso ao número ou conversa que não é de marketplace: a tela segue sem a faixa.
    if (status === 403 || status === 404) return null;
    throw e;
  }
}

/** Demonstração: a conversa de exemplo do Mercado Livre. */
export const DEMO_HUB_CONTEXT: HubConversationContext = {
  provider: 'mercado-livre',
  account_name: 'Loja Demo',
  thread_kind: 'post_sale',
  closed_remotely: false,
  orders: [{ id: 'demo-pedido', external_order_id: '2000012345678', external_order_number: '2000012345678', canonical_status: 'paid' }],
};
