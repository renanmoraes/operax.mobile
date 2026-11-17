/** Espelha os tipos da API do portal do cliente (operax-frontend/.../portal/api/me.ts). */

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'done' | 'offer';

export type ClientBooking = {
  id: string;
  tenant_slug: string;
  tenant_name: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  service_name: string | null;
  provider_name: string | null;
  can_confirm: boolean;
  can_cancel: boolean;
  kind?: 'class';
  can_accept?: boolean;
  cancel_counts?: boolean;
  category: 'session' | 'class' | 'evaluation' | 'service';
  location: string | null;
  class_capacity?: number;
  class_enrolled?: number;
  waitlist_position?: number;
  offer_expires_at?: string;
};

export type ChatAttachment =
  | { kind: 'image'; uri: string; width?: number; height?: number; /** Arquivo embutido no app (só no demo). */ asset?: number }
  | { kind: 'video'; uri: string; duration_s: number; title?: string }
  | { kind: 'document'; uri: string; name: string; size_bytes: number; pages?: number; /** Arquivo embutido no app (só no demo). */ asset?: number }
  | { kind: 'audio'; uri: string; duration_s: number; /** Arquivo embutido no app (só no demo). */ asset?: number };

export type ChatMessage = {
  id: string;
  from: 'me' | 'team';
  author_name?: string;
  text: string;
  at: string;
  attachment: ChatAttachment | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  reschedule?: { booking_id: string; title: string; original_at: string };
};

export type ClientChat = {
  tenant_slug: string;
  tenant_name: string;
  team_label: string;
  messages: ChatMessage[];
  service_hours_text: string | null;
  whatsapp_url: string | null;
  unread: number;
};

export type ClientCompany = {
  slug: string;
  name: string;
  segment: string;
  initials: string;
  capabilities: { scheduling: boolean; chat: boolean; training: boolean };
};

export type OutgoingAttachment = {
  kind: 'image' | 'video' | 'document' | 'audio';
  uri: string;
  name?: string;
  size_bytes?: number;
  duration_s?: number;
};
