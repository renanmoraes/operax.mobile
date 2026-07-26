import { api } from './client';

export type ApiContact = {
  id: string;
  name?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  lead_score?: number | null;
  tags?: Array<string | { tag?: string; name?: string }>;
  notes?: string | null;
};

export async function getContact(id: string): Promise<ApiContact> {
  const { data } = await api.get(`/api/contacts/${id}`);
  return data as ApiContact;
}
