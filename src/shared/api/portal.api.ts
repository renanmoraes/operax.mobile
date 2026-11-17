import { create } from 'axios';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { appVersionHeader } from '@/src/shared/updates/versionInfo';
import { api } from './client';
import { deviceId } from './deviceId';

/**
 * Portal do cliente (mesmas rotas do portal web: `/api/public/portal`).
 * Dois tokens: o de identidade (a pessoa, sem empresa; só lista/escolhe empresa) e o de sessão
 * (uma empresa; usado em `me/*` e `fitness/*`). Não existe renovação: sessão vencida = entrar de novo.
 */

const BASE = '/api/public/portal';

/** Chamadas sem sessão (login, código, escolher empresa): cliente HTTP sem os interceptores do app. */
const publicApi = create({ baseURL: API_URL, timeout: 30_000, headers: { 'X-Client': MOBILE_CLIENT_HEADER, 'X-App-Version': appVersionHeader(), Accept: 'application/json' } });
// O login leva o identificador do aparelho: entrar de novo neste celular mantém a vaga dele (ver `deviceId.ts`).
publicApi.interceptors.request.use(async (config) => {
  config.headers['X-Device-Id'] = await deviceId();
  return config;
});

export type PortalCompany = {
  access_id: string;
  tenant_slug: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  contact_label?: string | null;
  last_login_at?: string | null;
};

export type PortalLoginResult = {
  identity_token: string | null;
  companies: PortalCompany[];
  session: { access_token: string; tenant_slug: string } | null;
};

export type PortalPasswordStep = { step: 'password'; setup_ticket: string };

export async function portalPasswordLogin(identifier: string, password: string): Promise<PortalLoginResult> {
  const { data } = await publicApi.post(`${BASE}/auth/password`, { identifier, password });
  return data as PortalLoginResult;
}

export async function portalRequestCode(identifier: string, opts?: { first_access?: boolean; forgot?: boolean }) {
  const { data } = await publicApi.post(`${BASE}/auth/code/request`, { identifier, ...opts });
  return data as { challenge_id: string; sent_to: string; channel: 'email' | 'whatsapp' };
}

/** Código certo: entra direto, ou (primeiro acesso) pede para criar a senha. */
export async function portalVerifyCode(challenge_id: string, code: string): Promise<PortalLoginResult | PortalPasswordStep> {
  const { data } = await publicApi.post(`${BASE}/auth/code/verify`, { challenge_id, code });
  return data as PortalLoginResult | PortalPasswordStep;
}

export async function portalSetPassword(setup_ticket: string, password: string): Promise<PortalLoginResult> {
  const { data } = await publicApi.post(`${BASE}/link/password`, { setup_ticket, password });
  return data as PortalLoginResult;
}

/** Com o token de identidade: abre a sessão de uma empresa. */
export async function portalSelectCompany(identity: string, access_id: string): Promise<PortalLoginResult> {
  const { data } = await publicApi.post(`${BASE}/auth/select`, { access_id }, { headers: { Authorization: `Bearer ${identity}` } });
  return data as PortalLoginResult;
}

export async function portalIdentityCompanies(identity: string): Promise<PortalCompany[]> {
  const { data } = await publicApi.get(`${BASE}/auth/companies`, { headers: { Authorization: `Bearer ${identity}` } });
  return (Array.isArray(data) ? data : []) as PortalCompany[];
}

// ---------- com a sessão da empresa (token de cliente guardado no aparelho) ----------

export type PortalBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string | null;
  provider_name: string | null;
  can_confirm: boolean;
  can_cancel: boolean;
  kind?: 'class';
  can_accept?: boolean;
  cancel_counts?: boolean;
};

export type PortalOrder = {
  id: string;
  display_code: string;
  title: string;
  status: string;
  estimated_amount: string | null;
  final_amount: string | null;
  currency: string | null;
  updated_at: string;
  quote_state: 'none' | 'awaiting' | 'accepted' | 'declined' | 'revising';
  can_respond: boolean;
  can_approve: boolean;
};
export type PortalQuote = {
  company: { name: string };
  order: { code: string; kind: 'quote' | 'work'; title: string; vehicle: string | null; customer_first_name: string };
  state: 'awaiting' | 'accepted' | 'declined' | 'revising' | 'closed';
  can_respond: boolean;
  version: {
    id: string;
    version_no: number;
    total_cents: number;
    items: { category: string; description: string; quantity: number; unit: string | null; unit_price_cents: number; total_cents: number }[];
    responded_at: string | null;
  } | null;
};
export type PortalDocument = { id: string; title: string; kind: string; released_at: string | null; has_file: boolean };
export type PortalReminder = { id: string; title: string; next_at: string | null; last_sent_at: string | null; dismissed: boolean };
export type PortalExamItem = { id: string; exam_name: string; status: 'final' | 'rectified'; collected_at: string | null; released_at: string; outside_range: number; has_pdf: boolean };
export type PortalExamDetail = PortalExamItem & { analytes: { name: string; value: string; unit: string | null; reference: string | null; abnormal: boolean }[] };
export type PortalPayment = { id: string; description: string | null; amount_cents: number; method: 'pix' | 'card'; status: 'pending' | 'paid' | 'refunded'; created_at: string; paid_at: string | null; pix_copy_paste: string | null; payment_link: string | null };
export type PortalMemberCard = { id: string; kind: 'titular' | 'dependente'; name: string; relationship: string | null; code: string; plan: string | null; situation: 'active' | 'pending_payment' | 'cancelled'; issued_at: string };
export type PortalMemberCardList = { cards: PortalMemberCard[]; without_card: { id: string; name: string; relationship: string | null }[] };
export type PortalProfile = {
  name: string | null;
  name_locked: boolean;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
};

export type PortalHome = {
  tenant_slug: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_color?: string | null;
  service_hours_text?: string | null;
  contact: { id: string; name: string | null; email: string | null };
  capabilities: { scheduling: boolean; chat: boolean; training: boolean } & Record<string, boolean>;
  bookings: PortalBooking[];
  /** Serviços (ordens de serviço) no nome do cliente. Só vem quando a empresa usa o módulo. */
  service_orders?: PortalOrder[];
  documents?: PortalDocument[];
  member_card?: { numero: string; plano: string | null; situacao: string; emitida_em: string; dependentes: number } | null;
  badges: { chat: number; training: number } & Record<string, number>;
  /** A conta da pessoa: sem identidade (entrou por link da empresa) não dá para criar senha. */
  account?: { has_identity: boolean; has_password: boolean; email?: string | null };
};

export const portalHome = async () => (await api.get(`${BASE}/me/home`)).data as PortalHome;
/** Endereço do calendário pessoal do cliente (Google Agenda, assinatura webcal ou https). */
export type PortalCalendarLink = { https_url: string; webcal_url: string; google_url: string };
export const portalCalendarLink = async () => (await api.get(`${BASE}/me/calendar-link`)).data as PortalCalendarLink;
export const portalMyCompanies = async () => (await api.get(`${BASE}/me/companies`)).data as PortalCompany[];
export const portalSwitch = async (access_id: string) => (await api.post(`${BASE}/me/switch`, { access_id })).data as PortalLoginResult;
export const portalLogout = async () => void (await api.post(`${BASE}/me/logout`, {}));
/**
 * Liga um e-mail à conta da pessoa: pede o código (vai para o e-mail novo) e confirma. Depois disso o e-mail
 * entra em todas as empresas da conta. O servidor só aceita em conta que ainda não tem e-mail.
 */
export const portalEmailLinkRequest = async (email: string) => (await api.post(`${BASE}/me/email/request`, { email })).data as { challenge_id: string; sent_to: string };
export const portalEmailLinkVerify = async (challenge_id: string, code: string) => (await api.post(`${BASE}/me/email/verify`, { challenge_id, code })).data as { ok: true; email: string };
/**
 * Cria (sem senha atual) ou troca a senha da pessoa. A senha é da pessoa no Operax e vale em todas
 * as empresas dela. Os outros aparelhos saem; este recebe uma sessão nova, que precisa ser guardada.
 */
export const portalChangePassword = async (new_password: string, current_password?: string) =>
  (await api.post(`${BASE}/me/password`, { new_password, ...(current_password ? { current_password } : {}) })).data as PortalLoginResult;

/** Aparelho do aluno nesta empresa: o servidor manda por push as conquistas (e os próximos avisos do portal). */
export type PortalPushTokenInput = { token: string; platform: 'ios' | 'android' | 'unknown'; app_version?: string; lang: 'pt' | 'en' | 'es' };
export const portalRegisterPushToken = async (body: PortalPushTokenInput) => void (await api.post(`${BASE}/me/push-tokens`, body));
export const portalRevokePushToken = async (token: string) => void (await api.delete(`${BASE}/me/push-tokens`, { data: { token } }));

export const portalConfirmBooking = async (id: string) => (await api.post(`${BASE}/me/bookings/${id}/confirm`, {})).data as { status: string };
export const portalCancelBooking = async (id: string, reason?: string) =>
  (await api.post(`${BASE}/me/bookings/${id}/cancel`, { reason: reason?.slice(0, 300) })).data as { status: string };
/** Aula: aceitar vaga ou cancelar passam pelas regras da turma (rotas do Fitness). */
export const portalClassAction = async (id: string, action: 'accept' | 'cancel') => (await api.post(`${BASE}/fitness/bookings/${id}/${action}`, {})).data;

/** `status` só nas mensagens do cliente: `delivered` = a equipe recebeu, `read` = a equipe abriu a conversa depois. */
export type PortalChatMessage = { id: string; from: 'me' | 'team'; text: string; at: string; attachment: { kind: 'image' | 'document' | 'audio' | 'video' } | null; status?: 'delivered' | 'read' };
export type PortalChat = { messages: PortalChatMessage[]; service_hours_text: string | null; whatsapp_url: string | null };

export const portalChat = async () => (await api.get(`${BASE}/me/chat`)).data as PortalChat;
/** Limite do portal por mensagem. Quem chama confere antes: cortar em silêncio perderia o fim do texto. */
export const PORTAL_CHAT_MAX = 1000;
export const portalSendChat = async (text: string) => void (await api.post(`${BASE}/me/chat`, { text }));
export const portalChatMedia = async (messageId: string) => (await api.get(`${BASE}/me/chat/media/${messageId}`)).data as { url: string };

// ---- Serviços e o resto do portal (mesmas rotas do portal web)
export const portalServiceOrder = async (id: string) => (await api.get(`${BASE}/me/service-orders/${id}`)).data as { order: PortalOrder; quote: PortalQuote | null };
export const portalRespondQuote = async (id: string, body: { version_id: string; decision: 'accepted' | 'declined' }) =>
  (await api.post(`${BASE}/me/service-orders/${id}/quote`, body)).data as { state: 'accepted' | 'declined'; already: boolean };
export const portalApproveOrder = async (id: string) => (await api.post(`${BASE}/me/service-orders/${id}/approve`, {})).data as { id: string; display_code: string; status: string };
/** O PDF do orçamento exige a sessão no cabeçalho: o endereço fica aqui para quem baixa montar a requisição. */
export const portalServiceOrderPdfUrl = (id: string) => `${API_URL}${BASE}/me/service-orders/${id}/pdf`;

export const portalReminders = async () => (await api.get(`${BASE}/me/reminders`)).data as PortalReminder[];
export const portalDismissReminder = async (id: string) => void (await api.post(`${BASE}/me/reminders/${id}/dismiss`, {}));
export const portalExams = async () => (await api.get(`${BASE}/me/exams`)).data as PortalExamItem[];
export const portalExam = async (id: string) => (await api.get(`${BASE}/me/exams/${id}`)).data as PortalExamDetail;
export const portalExamPdf = async (id: string) => (await api.get(`${BASE}/me/exams/${id}/pdf`)).data as { url: string };
export const portalPayments = async () => (await api.get(`${BASE}/me/payments`)).data as { open: PortalPayment[]; paid: PortalPayment[] };
export const portalOpenDocument = async (id: string) => (await api.get(`${BASE}/me/documents/${id}/open`)).data as { url: string };
export const portalCards = async () => (await api.get(`${BASE}/me/cards`)).data as PortalMemberCardList;
export const portalProfile = async () => (await api.get(`${BASE}/me/profile`)).data as PortalProfile;
export const portalUpdateProfile = async (body: Partial<Record<keyof PortalProfile, string | null>>) => (await api.patch(`${BASE}/me/profile`, body)).data as PortalProfile;
/** Sai de todos os aparelhos da pessoa nesta empresa (a sessão deste também deixa de valer). */
export const portalLogoutAll = async () => void (await api.post(`${BASE}/me/logout-all`, {}));
