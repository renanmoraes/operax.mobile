import { create } from 'axios';
import { API_URL, MOBILE_CLIENT_HEADER } from '@/src/shared/config';
import { api } from './client';

/**
 * Portal do cliente (mesmas rotas do portal web: `/api/public/portal`).
 * Dois tokens: o de identidade (a pessoa, sem empresa; só lista/escolhe empresa) e o de sessão
 * (uma empresa; usado em `me/*` e `fitness/*`). Não existe renovação: sessão vencida = entrar de novo.
 */

const BASE = '/api/public/portal';

/** Chamadas sem sessão (login, código, escolher empresa): cliente HTTP sem os interceptores do app. */
const publicApi = create({ baseURL: API_URL, timeout: 30_000, headers: { 'X-Client': MOBILE_CLIENT_HEADER, Accept: 'application/json' } });

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

export type PortalHome = {
  tenant_slug: string;
  brand_name: string | null;
  logo_url: string | null;
  service_hours_text?: string | null;
  contact: { id: string; name: string | null; email: string | null };
  capabilities: { scheduling: boolean; chat: boolean; training: boolean } & Record<string, boolean>;
  bookings: PortalBooking[];
  badges: { chat: number; training: number } & Record<string, number>;
};

export const portalHome = async () => (await api.get(`${BASE}/me/home`)).data as PortalHome;
export const portalMyCompanies = async () => (await api.get(`${BASE}/me/companies`)).data as PortalCompany[];
export const portalSwitch = async (access_id: string) => (await api.post(`${BASE}/me/switch`, { access_id })).data as PortalLoginResult;
export const portalLogout = async () => void (await api.post(`${BASE}/me/logout`, {}));

export const portalConfirmBooking = async (id: string) => (await api.post(`${BASE}/me/bookings/${id}/confirm`, {})).data as { status: string };
export const portalCancelBooking = async (id: string, reason?: string) =>
  (await api.post(`${BASE}/me/bookings/${id}/cancel`, { reason: reason?.slice(0, 300) })).data as { status: string };
/** Aula: aceitar vaga ou cancelar passam pelas regras da turma (rotas do Fitness). */
export const portalClassAction = async (id: string, action: 'accept' | 'cancel') => (await api.post(`${BASE}/fitness/bookings/${id}/${action}`, {})).data;

export type PortalChatMessage = { id: string; from: 'me' | 'team'; text: string; at: string; attachment: { kind: 'image' | 'document' | 'audio' | 'video' } | null };
export type PortalChat = { messages: PortalChatMessage[]; service_hours_text: string | null; whatsapp_url: string | null };

export const portalChat = async () => (await api.get(`${BASE}/me/chat`)).data as PortalChat;
/** Limite do portal por mensagem. Quem chama confere antes: cortar em silêncio perderia o fim do texto. */
export const PORTAL_CHAT_MAX = 1000;
export const portalSendChat = async (text: string) => void (await api.post(`${BASE}/me/chat`, { text }));
export const portalChatMedia = async (messageId: string) => (await api.get(`${BASE}/me/chat/media/${messageId}`)).data as { url: string };
