import { api } from './client';

export type ContactTag = { id?: string; tag: string; source?: string };
export type ContactPhone = { id: string; phone_e164: string; label: string | null };

export type ApiContact = {
  id: string;
  name?: string | null;
  phone_e164?: string | null;
  wa_id?: string | null;
  email?: string | null;
  lead_score?: number | null;
  tags?: (string | { tag?: string; name?: string })[];
  notes?: string | null;
  company_name?: string | null;
  document_number?: string | null;
  /** `AAAA-MM-DD` */
  birth_date?: string | null;
  sex?: 'female' | 'male' | null;
  lifecycle_stage?: string | null;
  source?: string | null;
  created_at?: string | null;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  phones?: ContactPhone[];
};

export async function getContact(id: string): Promise<ApiContact> {
  const { data } = await api.get(`/api/contacts/${id}`);
  return data as ApiContact;
}

/** Campos que a ficha edita. `null` apaga o valor; o que não vai na lista não muda. */
export type ContactUpdate = Partial<
  Pick<
    ApiContact,
    | 'name' | 'email' | 'phone_e164' | 'company_name' | 'document_number' | 'birth_date' | 'sex' | 'lifecycle_stage'
    | 'address_zip' | 'address_street' | 'address_number' | 'address_complement' | 'address_district' | 'address_city' | 'address_state'
  >
>;

export async function updateContact(id: string, payload: ContactUpdate): Promise<ApiContact> {
  const { data } = await api.patch(`/api/contacts/${id}`, payload);
  return data as ApiContact;
}

/** Lista/busca de contatos (pacientes e clientes), como a tela de Contatos do web. */
export async function listContacts(params?: { search?: string; page?: number; limit?: number }): Promise<{ items: ApiContact[]; total: number }> {
  const { data } = await api.get('/api/contacts', { params: { sort_by: 'name', sort_dir: 'asc', limit: 30, ...params } });
  const items = (Array.isArray(data) ? data : data?.data ?? data?.items ?? []) as ApiContact[];
  return { items, total: Number(data?.total ?? items.length) };
}

export async function addContactTag(contactId: string, tag: string): Promise<ContactTag> {
  const { data } = await api.post(`/api/contacts/${contactId}/tags`, { tag });
  return data as ContactTag;
}

export async function removeContactTag(contactId: string, tag: string): Promise<void> {
  await api.delete(`/api/contacts/${contactId}/tags/${encodeURIComponent(tag)}`);
}

/** Etiquetas que a empresa já usa (para sugerir ao marcar). */
export async function listDistinctTags(): Promise<string[]> {
  const { data } = await api.get('/api/contacts/tags');
  return Array.isArray(data) ? (data as string[]) : [];
}

export async function addContactPhone(contactId: string, payload: { phone_e164: string; label?: string }): Promise<ContactPhone> {
  const { data } = await api.post(`/api/contacts/${contactId}/phones`, payload);
  return data as ContactPhone;
}

export async function removeContactPhone(contactId: string, phoneId: string): Promise<void> {
  await api.delete(`/api/contacts/${contactId}/phones/${phoneId}`);
}

export async function blockContact(contactId: string, reason?: string) {
  const { data } = await api.post(`/api/contacts/${contactId}/block`, { reason });
  return data;
}

export async function unblockContact(contactId: string) {
  const { data } = await api.post(`/api/contacts/${contactId}/unblock`);
  return data;
}

/** Notas da equipe e interesses detectados (a mesma resposta que o web usa nas notas do dossiê). */
export type ContactNote = { id: string; body: string; created_at: string; author_name: string | null; conversation_id: string; is_global: boolean };
export type ContactInterest = { id: string; interest_code: string; score: number; confidence?: number | null; last_source?: string; detected_at?: string };

export async function getContactChatPreview(id: string): Promise<{ interests: ContactInterest[]; operator_notes: ContactNote[] }> {
  const { data } = await api.get(`/api/contacts/${id}/chat-preview`);
  return { interests: data?.interests ?? [], operator_notes: data?.operator_notes ?? [] };
}

export async function getContactInterests(id: string): Promise<ContactInterest[]> {
  const { data } = await api.get(`/api/contacts/${id}/interests`);
  return Array.isArray(data) ? (data as ContactInterest[]) : [];
}

export type TagEvent = { id: string; tag: string; action: 'applied' | 'removed'; source: string; reason: string | null; created_at: string };
export async function listTagEvents(id: string): Promise<{ items: TagEvent[]; total: number }> {
  const { data } = await api.get(`/api/contacts/${id}/tag-events`, { params: { limit: 100 } });
  return { items: data?.items ?? [], total: Number(data?.total ?? 0) };
}

export type ContactDependent = { id: string; full_name: string; birth_date: string; cpf: string; relationship: string; phone_e164: string | null };
export type ContactDependentInput = { full_name: string; birth_date: string; cpf: string; relationship: string; phone_e164?: string | null };

export async function listDependents(contactId: string): Promise<ContactDependent[]> {
  const { data } = await api.get(`/api/contacts/${contactId}/dependents`);
  return Array.isArray(data) ? (data as ContactDependent[]) : [];
}
export async function createDependent(contactId: string, input: ContactDependentInput): Promise<ContactDependent> {
  const { data } = await api.post(`/api/contacts/${contactId}/dependents`, input);
  return data as ContactDependent;
}
export async function updateDependent(contactId: string, id: string, input: ContactDependentInput): Promise<ContactDependent> {
  const { data } = await api.patch(`/api/contacts/${contactId}/dependents/${id}`, input);
  return data as ContactDependent;
}
export async function removeDependent(contactId: string, id: string): Promise<void> {
  await api.delete(`/api/contacts/${contactId}/dependents/${id}`);
}

export type ContactDocument = { id: string; description: string; file_name: string; mime_type: string | null; size: number | null; created_at: string };

export async function listContactDocuments(contactId: string): Promise<ContactDocument[]> {
  const { data } = await api.get(`/api/contacts/${contactId}/documents`);
  return Array.isArray(data) ? (data as ContactDocument[]) : [];
}
export async function getDocumentDownloadUrl(contactId: string, documentId: string): Promise<{ url: string; file_name: string }> {
  const { data } = await api.get(`/api/contacts/${contactId}/documents/${documentId}/download-url`);
  return data as { url: string; file_name: string };
}
export async function removeContactDocument(contactId: string, documentId: string): Promise<void> {
  await api.delete(`/api/contacts/${contactId}/documents/${documentId}`);
}
