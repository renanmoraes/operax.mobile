import { api } from './client';

/**
 * Ações do "+" da conversa (mesmos endereços do Operax web):
 * chave Pix (`type: 'pix'`), agendamento pela conversa e dados de agenda.
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random' | 'copy_paste';

export const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'phone', label: 'Celular' },
  { value: 'email', label: 'E-mail' },
  { value: 'random', label: 'Aleatória' },
  { value: 'copy_paste', label: 'Copia e cola' },
];

export const pixKeyTypeLabel = (t: PixKeyType) => PIX_KEY_TYPES.find((o) => o.value === t)?.label ?? 'Chave Pix';

export type PixData = { key: string; key_type: PixKeyType; holder_name: string };

export type SavedPixKey = PixData & { id: string; use_count?: number };

export async function listSavedPixKeys(): Promise<SavedPixKey[]> {
  const { data } = await api.get('/api/conversations/pix-keys');
  return (Array.isArray(data) ? data : data?.data ?? []) as SavedPixKey[];
}

export async function sendPixMessage(conversationId: string, pix: PixData & { save?: boolean }) {
  const { data } = await api.post(`/api/conversations/${conversationId}/messages`, {
    type: 'pix',
    pix_key: pix.key,
    pix_key_type: pix.key_type,
    pix_holder_name: pix.holder_name,
    ...(pix.save ? { pix_save: true } : {}),
  });
  return data as { queued: boolean; message_id?: string };
}

export type SchedProvider = { id: string; name: string; service_ids?: string[]; is_active?: boolean };
export type SchedService = { id: string; name: string; default_duration_min: number; is_active?: boolean; internal_only?: boolean };
export type SchedSlot = { provider_id: string; starts_at: string; ends_at: string };

async function allPages<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await api.get(url, { params: { page, limit: 100 } });
    const items = (Array.isArray(data) ? data : data?.data ?? data?.items ?? []) as T[];
    out.push(...items);
    const total = Number(data?.total ?? items.length);
    if (Array.isArray(data) || out.length >= total || items.length === 0) break;
  }
  return out;
}

export const listSchedProviders = () => allPages<SchedProvider>('/api/scheduling/providers');
export const listSchedServices = () => allPages<SchedService>('/api/scheduling/services');

/** O endpoint responde `{ slots: [{ starts_at, providers: [...] }] }`; aqui vira lista simples. */
export async function searchSlots(p: { service_id: string; provider_id: string; from: string; to: string }): Promise<SchedSlot[]> {
  const { data } = await api.post('/api/scheduling/slots/search', p);
  if (Array.isArray(data)) return data as SchedSlot[];
  const flat: SchedSlot[] = [];
  for (const slot of data?.slots ?? []) {
    for (const prov of slot.providers ?? []) {
      if (prov.provider_id !== p.provider_id) continue;
      flat.push({ provider_id: prov.provider_id, starts_at: slot.starts_at, ends_at: prov.ends_at });
    }
  }
  return flat;
}

export async function createQuickBooking(p: {
  provider_id: string;
  service_id: string;
  contact_id: string;
  client_name?: string;
  starts_at: string;
  ends_at: string;
  customer_note?: string;
}) {
  // Lembretes ficam no padrão da empresa (o backend aplica quando não vem nada).
  const { data } = await api.post('/api/scheduling/bookings', p);
  return data as { id: string; starts_at: string };
}
