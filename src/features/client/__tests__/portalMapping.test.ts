import { mapPortalBooking, mapPortalChat, mapPortalStatus, portalUser, portalUserWithoutSession } from '../portalMapping';

const home = {
  tenant_slug: 'move-studio',
  brand_name: 'Move Studio',
  logo_url: null,
  contact: { id: 'ct1', name: 'Marina Duarte', email: 'marina@email.com' },
  capabilities: { scheduling: true, chat: true, training: true },
  bookings: [],
  badges: { chat: 2, training: 0 },
};
const companies = [
  { access_id: 'a1', tenant_slug: 'move-studio', brand_name: 'Move Studio', logo_url: null, primary_color: null },
  { access_id: 'a2', tenant_slug: 'bela-vista', brand_name: 'Studio Bela Vista', logo_url: null, primary_color: null },
];

describe('portal do cliente → app', () => {
  it('traduz os status do portal para os do app', () => {
    expect(mapPortalStatus('approved')).toBe('pending');
    expect(mapPortalStatus('pending_approval')).toBe('pending');
    expect(mapPortalStatus('confirmed')).toBe('confirmed');
    expect(mapPortalStatus('offered')).toBe('offer');
    expect(mapPortalStatus('completed')).toBe('done');
    expect(mapPortalStatus('late_cancelled')).toBe('cancelled');
    expect(mapPortalStatus('no_show')).toBe('cancelled');
  });

  it('monta o usuário com a empresa ativa pelo slug da sessão', () => {
    const u = portalUser(home, companies);
    expect(u).toMatchObject({ kind: 'client', id: 'ct1', name: 'Marina Duarte', active_tenant_id: 'a1' });
    expect(u.memberships.map((m) => m.tenant_name)).toEqual(['Move Studio', 'Studio Bela Vista']);
    expect(portalUserWithoutSession(companies).active_tenant_id).toBeNull();
  });

  it('agendamento ganha empresa e categoria (aula ou sessão)', () => {
    const b = mapPortalBooking(
      { id: 'b1', starts_at: '2026-11-14T13:00:00Z', ends_at: '2026-11-14T14:00:00Z', status: 'approved', service_name: 'Treino', provider_name: 'Carlos', can_confirm: true, can_cancel: true, kind: 'class' },
      home,
    );
    expect(b).toMatchObject({ tenant_slug: 'move-studio', tenant_name: 'Move Studio', status: 'pending', category: 'class', can_confirm: true });
  });

  it('chat da empresa com as não lidas do início', () => {
    const c = mapPortalChat({ messages: [{ id: 'm1', from: 'team', text: 'Oi!', at: '2026-11-14T10:00:00Z', attachment: { kind: 'image' } }], service_hours_text: null, whatsapp_url: null }, home);
    expect(c).toMatchObject({ tenant_slug: 'move-studio', unread: 2 });
    expect(c.messages[0].attachment?.kind).toBe('image');
  });
});
