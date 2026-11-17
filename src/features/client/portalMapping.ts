import type { ClientUser } from '@/src/shared/api/auth.api';
import type { PortalBooking, PortalChat, PortalCompany, PortalHome } from '@/src/shared/api/portal.api';
import i18n from '@/src/i18n';
import type { BookingStatus, ClientBooking, ClientChat, ClientCompany } from './types';

/** Status do portal → status que as telas do app usam (mesmos rótulos do portal web). */
export function mapPortalStatus(status: string): BookingStatus {
  const s = status.toLowerCase();
  if (s === 'confirmed') return 'confirmed';
  if (s === 'offered') return 'offer';
  if (['completed', 'done', 'present', 'checked_in', 'attended'].includes(s)) return 'done';
  if (['canceled', 'cancelled', 'late_cancelled', 'rejected', 'no_show', 'absent', 'expired'].includes(s)) return 'cancelled';
  // pending_approval, approved (falta o cliente confirmar), waitlisted, reschedule_pending_manual…
  return 'pending';
}

export function mapPortalBooking(b: PortalBooking, home: Pick<PortalHome, 'tenant_slug' | 'brand_name'>): ClientBooking {
  return {
    id: b.id,
    tenant_slug: home.tenant_slug,
    tenant_name: home.brand_name || home.tenant_slug,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: mapPortalStatus(b.status),
    service_name: b.service_name,
    provider_name: b.provider_name,
    can_confirm: !!b.can_confirm,
    can_cancel: !!b.can_cancel,
    kind: b.kind,
    can_accept: b.can_accept,
    cancel_counts: b.cancel_counts,
    category: b.kind === 'class' ? 'class' : 'session',
    location: null,
  };
}

/** Pessoa logada no app a partir do portal: empresas viram "memberships" (id = access_id). */
export function portalUser(home: PortalHome, companies: PortalCompany[]): ClientUser {
  const active = companies.find((c) => c.tenant_slug === home.tenant_slug);
  return {
    kind: 'client',
    id: home.contact.id,
    name: home.contact.name || i18n.t('auth:shared.client'),
    email: home.contact.email ?? undefined,
    active_tenant_id: active?.access_id ?? null,
    memberships: companies.map((c) => ({ tenant_id: c.access_id, tenant_name: c.brand_name || c.tenant_slug, tenant_slug: c.tenant_slug, logo_url: c.logo_url })),
    ...(home.account ? { account: { hasIdentity: home.account.has_identity, hasPassword: home.account.has_password, email: home.account.email } } : {}),
  };
}

/** Antes de escolher a empresa: só a lista, sem empresa ativa. */
export function portalUserWithoutSession(companies: PortalCompany[], name = i18n.t('auth:shared.client')): ClientUser {
  return {
    kind: 'client',
    id: companies[0]?.access_id ?? 'portal',
    name,
    active_tenant_id: null,
    memberships: companies.map((c) => ({ tenant_id: c.access_id, tenant_name: c.brand_name || c.tenant_slug, tenant_slug: c.tenant_slug, logo_url: c.logo_url })),
  };
}

export function mapPortalCompany(c: PortalCompany, home?: PortalHome): ClientCompany {
  const name = c.brand_name || c.tenant_slug;
  const caps = home && home.tenant_slug === c.tenant_slug ? home.capabilities : undefined;
  return {
    slug: c.tenant_slug,
    name,
    segment: '',
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join(''),
    capabilities: { scheduling: caps?.scheduling ?? true, chat: caps?.chat ?? true, training: caps?.training ?? false },
  };
}

export function mapPortalChat(chat: PortalChat, home: Pick<PortalHome, 'tenant_slug' | 'brand_name' | 'badges'>): ClientChat {
  return {
    tenant_slug: home.tenant_slug,
    tenant_name: home.brand_name || home.tenant_slug,
    team_label: i18n.t('auth:shared.team'),
    service_hours_text: chat.service_hours_text,
    whatsapp_url: chat.whatsapp_url,
    unread: home.badges?.chat ?? 0,
    messages: chat.messages.map((m) => ({
      id: m.id,
      from: m.from,
      text: m.text,
      at: m.at,
      // Anexos vêm sem link: o link assinado é pedido ao abrir (me/chat/media/:id).
      attachment: m.attachment ? (m.attachment.kind === 'document' ? { kind: 'document', uri: '', name: i18n.t('client:viewer.document'), size_bytes: 0 } : m.attachment.kind === 'image' ? { kind: 'image', uri: '' } : m.attachment.kind === 'audio' ? { kind: 'audio', uri: '', duration_s: 0 } : { kind: 'video', uri: '', duration_s: 0 }) : null,
    })),
  };
}
