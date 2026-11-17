import { api } from './client';

/** Leituras da ficha do contato que vêm de outros módulos (cobrança, lembretes, campanhas, pós-venda, compliance). */

export type CobrancaCard = {
  id: string;
  contact_id?: string;
  contact_name?: string | null;
  pipeline_id: string | null;
  pipeline_name: string;
  stage_name: string;
  sale_status: string;
  value_estimated: number | null;
  cobranca_json: { due_dates?: string[] | null } | null;
  updated_at: string;
};
export async function listCobrancaCards(contactId: string): Promise<CobrancaCard[]> {
  const { data } = await api.get(`/api/kanban/cobranca/contacts/${contactId}/cards`);
  return Array.isArray(data) ? (data as CobrancaCard[]) : [];
}

export type Reminder = {
  id: string;
  title: string;
  content: string | null;
  first_fire_at: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  recurrence?: { unit?: string; interval?: number } | null;
};
export async function listContactReminders(contactId: string): Promise<Reminder[]> {
  const { data } = await api.get('/api/apps/reminders', { params: { target_type: 'contact', target_id: contactId, limit: 50 } });
  return Array.isArray(data) ? (data as Reminder[]) : [];
}

export type CampaignScore = { campaign_id: string; campaign_name: string; campaign_status: 'draft' | 'active' | 'paused' | 'finished'; original_score: number; weighted_score: number; recalculated_at: string };
export async function listCampaignScores(contactId: string): Promise<CampaignScore[]> {
  const { data } = await api.get(`/api/contacts/${contactId}/campaign-scores`);
  return Array.isArray(data) ? (data as CampaignScore[]) : [];
}

export type CsScore = { id: string; metric: string; score: number; band: string; source: string; recorded_at: string };
export async function listCsScores(contactId: string): Promise<CsScore[]> {
  const { data } = await api.get(`/api/apps/customer-success/contacts/${contactId}/scores`);
  return Array.isArray(data) ? (data as CsScore[]) : [];
}

export type Consent = { id: string; consent_type: string; source_description?: string | null; granted_at: string; active: boolean };
export type TermAcceptance = { id: string; termVersion: { title: string; version: string }; source_channel?: string | null; accepted_at: string; acceptance_level: string };
export async function listConsents(contactId: string): Promise<Consent[]> {
  const { data } = await api.get(`/api/contacts/${contactId}/consents`);
  return Array.isArray(data) ? (data as Consent[]) : [];
}
export async function listTermAcceptances(contactId: string): Promise<TermAcceptance[]> {
  const { data } = await api.get(`/api/contacts/${contactId}/term-acceptances`);
  return Array.isArray(data) ? (data as TermAcceptance[]) : [];
}

export type ServiceOrder = {
  id: string;
  display_code: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  responsible?: { name?: string | null } | null;
};
export async function listContactServiceOrders(contactId: string): Promise<ServiceOrder[]> {
  const { data } = await api.get('/api/apps/service-orders/orders', { params: { contact_id: contactId, page: 1, limit: 50, sort_by: 'updated_at', sort_dir: 'desc' } });
  return Array.isArray(data?.data) ? (data.data as ServiceOrder[]) : [];
}

export type Vehicle = { id: string; plate: string; vehicle_type: string; brand: string | null; model: string | null; year: number | null; color: string | null };
export async function listContactVehicles(contactId: string): Promise<Vehicle[]> {
  const { data } = await api.get('/api/apps/workshop/vehicles', { params: { customer_id: contactId } });
  return Array.isArray(data) ? (data as Vehicle[]) : [];
}

export type ContactAccess = {
  perfil: { id: string; situacao: string; valido_desde: string | null; valido_ate: string | null; motivo_da_suspensao: string | null } | null;
  grupos: { id: string; nome: string; situacao: string; valido_desde: string | null; valido_ate: string | null }[];
  credenciais: { id: string; tipo: string; rotulo: string; valor_mascarado: string | null; situacao: string; valido_desde: string | null; valido_ate: string | null }[];
};
export async function getContactAccess(contactId: string): Promise<ContactAccess> {
  const { data } = await api.get(`/api/apps/access-control/people/contacts/${contactId}/access`);
  return { perfil: data?.perfil ?? null, grupos: data?.grupos ?? [], credenciais: data?.credenciais ?? [] };
}

export type Contract = { id: string; number: string; title: string; status: string; effective_start: string | null; effective_end: string | null; completed_at: string | null };
export async function listContactContracts(contactId: string): Promise<Contract[]> {
  const { data } = await api.get('/api/apps/contracts', { params: { contact_id: contactId } });
  return Array.isArray(data) ? (data as Contract[]) : [];
}

export type MemberCard = {
  id: string;
  card_code: string;
  member_status: 'active' | 'pending_payment' | 'cancelled';
  status: 'active' | 'revoked';
  plan_name: string | null;
  issued_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
};
export async function listMemberCards(contactId: string): Promise<MemberCard[]> {
  const { data } = await api.get(`/api/apps/associados/contacts/${contactId}/cards`);
  return Array.isArray(data) ? (data as MemberCard[]) : [];
}
export async function issueMemberCard(contactId: string): Promise<MemberCard> {
  const { data } = await api.post(`/api/apps/associados/contacts/${contactId}/cards`, {});
  return data as MemberCard;
}
export async function revokeMemberCard(cardId: string, reason?: string): Promise<void> {
  await api.post(`/api/apps/associados/cards/${cardId}/revoke`, { reason });
}

export type MemberContract = {
  id: string;
  number: string;
  plan_name: string | null;
  monthly_cents: string | null;
  due_day: number | null;
  payment_method: string | null;
  seller_name: string | null;
  status: 'active' | 'pending_payment' | 'cancelled';
  signed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};
export async function listMemberContracts(contactId: string): Promise<MemberContract[]> {
  const { data } = await api.get(`/api/apps/associados/contacts/${contactId}/contracts`);
  return Array.isArray(data) ? (data as MemberContract[]) : [];
}
export async function cancelMemberContract(contractId: string, reason?: string): Promise<void> {
  await api.post(`/api/apps/associados/contracts/${contractId}/cancel`, { reason });
}

export type FitnessStudent = {
  contact_id: string;
  last_activity_on: string | null;
  name: string | null;
  attendance_mode: 'in_person' | 'online' | string;
  contracts: { id: string; status: 'active' | 'pending_payment'; plan_name: string | null }[];
};
export async function getFitnessStudent(contactId: string): Promise<FitnessStudent | null> {
  const { data } = await api.get('/api/apps/fitness/students', { params: { contact_id: contactId, limit: 1 } });
  return (Array.isArray(data?.data) ? data.data[0] : null) ?? null;
}
export async function getFitnessLink(contactId: string): Promise<string | null> {
  const { data } = await api.get(`/api/apps/fitness/students/${contactId}/link`);
  return data?.url ?? null;
}
export async function rotateFitnessLink(contactId: string): Promise<void> {
  await api.post(`/api/apps/fitness/students/${contactId}/link/rotate`, {});
}
export async function revokeFitnessLink(contactId: string): Promise<void> {
  await api.delete(`/api/apps/fitness/students/${contactId}/link`);
}

export type MensalidadeStatus = 'paid' | 'scheduled' | 'failed' | 'overdue' | 'open';
export type Mensalidade = {
  receivable_id: string;
  contract_number: string;
  plan_name: string | null;
  competence: string;
  due_date: string;
  amount_cents: number;
  paid_amount_cents: number;
  status: MensalidadeStatus;
  forma: string;
  bank: string | null;
  reason: string | null;
};
export type ContratoCobranca = { contract_id: string; number: string; plan_name: string | null; monthly_cents: number; due_day: number | null; status: string; forma: string; bank: string | null; pix: { status: string; bank: string } | null };
export async function getMensalidades(contactId: string): Promise<{ contratos: ContratoCobranca[]; meses: Mensalidade[] }> {
  const { data } = await api.get(`/api/apps/finance/mensalidades/contato/${contactId}`);
  return { contratos: data?.contratos ?? [], meses: data?.meses ?? [] };
}

export type Insurance = { id: string; insurer_name: string; card_number: string; plan_name: string | null; is_default: boolean; active: boolean };
export type ClinicalPatient = {
  id: string;
  cpf: string | null;
  cns: string | null;
  birth_date: string | null;
  sex: string | null;
  social_name: string | null;
  blood_type: string | null;
  allergies_summary: string | null;
  notes: string | null;
  priority_flag: boolean;
  restricted_access: boolean;
  prefers_dynamic_care: boolean;
  injectable_nutrition_adept: boolean;
  insurances: Insurance[];
};
/** Nulo quando o contato ainda não é paciente (o servidor responde 404). */
export async function getClinicalPatient(contactId: string): Promise<ClinicalPatient | null> {
  try {
    const { data } = await api.get(`/api/apps/clinica/patients/by-contact/${contactId}`);
    return { ...data, insurances: data?.insurances ?? [] } as ClinicalPatient;
  } catch (e) {
    if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
    throw e;
  }
}

export type ExamRequest = { request_id: string; requested_at: string; status: 'requested' | 'collected' | 'resulted' | 'cancelled'; priority: 'eletivo' | 'urgente'; items: { name: string }[]; doctor_name: string | null; laboratory: string | null };
export type ExamResult = { id: string; exam_name: string; status: string; released_at: string | null; abnormal_count: number; exam_request_id: string | null; portal_released_at: string | null };
export async function listPatientExamRequests(patientId: string): Promise<ExamRequest[]> {
  const { data } = await api.get('/api/apps/clinica/exam-requests', { params: { patient_id: patientId } });
  return Array.isArray(data) ? (data as ExamRequest[]) : [];
}
export async function listPatientExamResults(patientId: string): Promise<ExamResult[]> {
  const { data } = await api.get('/api/apps/clinica/lab/results', { params: { patient_id: patientId } });
  return Array.isArray(data) ? (data as ExamResult[]) : [];
}
export async function setExamPortalRelease(id: string, released: boolean): Promise<void> {
  await api.post(`/api/apps/clinica/lab/results/${id}/portal-release`, { released });
}
