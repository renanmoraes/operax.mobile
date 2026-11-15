import { api } from './client';

/**
 * Atendimento da equipe: números/canais, equipe online, filas e IA, nas mesmas rotas do Operax web.
 */

/** Número (conexão) da empresa. `display_name` é o nome dado nos ajustes; `external_display_name`, o telefone. */
export type InboxConnection = { id: string; channel_type: string; display_name: string | null; external_display_name: string | null };

export async function listInboxConnections(): Promise<InboxConnection[]> {
  const { data } = await api.get('/api/conversations/inbox-connections');
  return (Array.isArray(data) ? data : data?.data ?? []) as InboxConnection[];
}

export type Availability = 'online' | 'busy' | 'offline';
export type TeamMember = {
  id: string;
  name: string;
  email?: string | null;
  role_name?: string | null;
  availability_status: Availability;
  availability_updated_at?: string | null;
  active_conversation_count?: number;
  /** Com o Operax aberto agora (web ou app). */
  connected: boolean;
};

export async function getTeamPresence(): Promise<TeamMember[]> {
  const { data } = await api.get('/api/users/team-presence');
  return (Array.isArray(data) ? data : data?.data ?? []) as TeamMember[];
}

export async function getMyAvailability(): Promise<{ status: Availability; active_conversation_count?: number }> {
  const { data } = await api.get('/api/users/me/availability');
  return data;
}

export async function setMyAvailability(status: Availability) {
  const { data } = await api.patch('/api/users/me/availability', { status });
  return data as { status: Availability };
}

export type Queue = { id: string; name: string; sector?: string | null; is_default?: boolean; active?: boolean; member_count?: number };

export async function listQueues(): Promise<Queue[]> {
  const { data } = await api.get('/api/queues');
  const list = (Array.isArray(data) ? data : data?.data ?? []) as Queue[];
  return list.filter((q) => q.active !== false);
}

/** Apps instalados na empresa (`ia`, `agenda`, `payments`…): liga e desliga recursos como no web. */
export async function getActiveApps(): Promise<string[]> {
  const { data } = await api.get('/api/tenant/apps/ui-contributions');
  return (data?.active_slugs ?? []) as string[];
}

// ---------- IA ----------
export type CopilotBatch = { suggestions: string[]; batch_id: string };

export async function suggestReplies(conversationId: string, sourceMessageId?: string): Promise<CopilotBatch> {
  const { data } = await api.post(`/api/conversations/${conversationId}/copilot/suggest`, sourceMessageId ? { source_message_id: sourceMessageId } : {});
  return { suggestions: data?.suggestions ?? [], batch_id: data?.batch_id ?? '' };
}

export async function polishDraft(conversationId: string, text: string): Promise<CopilotBatch> {
  const { data } = await api.post(`/api/conversations/${conversationId}/copilot/polish-draft`, { text });
  return { suggestions: data?.suggestions ?? [], batch_id: data?.batch_id ?? '' };
}

export async function copilotFeedback(conversationId: string, body: { batch_id: string; suggestion_index?: number; action?: 'picked' | 'dismissed' | 'regenerated' }) {
  await api.post(`/api/conversations/${conversationId}/copilot/feedback`, body);
}

export async function regenerateSummary(conversationId: string) {
  await api.post(`/api/conversations/${conversationId}/summary/regenerate`, {});
}

export async function rateSummary(conversationId: string, rating: 'up' | 'down') {
  const { data } = await api.post(`/api/conversations/${conversationId}/summary/feedback`, { rating });
  return data as { rating: 'up' | 'down' | null };
}
