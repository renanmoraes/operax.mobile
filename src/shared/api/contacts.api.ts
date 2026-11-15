import { api } from './client';

export type ApiContact = {
  id: string;
  name?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  lead_score?: number | null;
  tags?: (string | { tag?: string; name?: string })[];
  notes?: string | null;
};

export async function getContact(id: string): Promise<ApiContact> {
  const { data } = await api.get(`/api/contacts/${id}`);
  return data as ApiContact;
}

/** Lista/busca de contatos (pacientes e clientes), como a tela de Contatos do web. */
export async function listContacts(params?: { search?: string; page?: number; limit?: number }): Promise<{ items: ApiContact[]; total: number }> {
  const { data } = await api.get('/api/contacts', { params: { sort_by: 'name', sort_dir: 'asc', limit: 30, ...params } });
  const items = (Array.isArray(data) ? data : data?.data ?? data?.items ?? []) as ApiContact[];
  return { items, total: Number(data?.total ?? items.length) };
}

