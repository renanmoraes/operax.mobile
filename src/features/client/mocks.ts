import type { ClientBooking, ClientChat, ClientCompany } from './types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DEMO_VOICE: number = require('@/assets/audio/demo-recado.wav');

/** Dados de exemplo até existir o login mobile de cliente (/auth/client/*). Datas relativas a hoje. */

function at(dayOffset: number, hh: number, mm = 0) {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}

function minutesFromNow(m: number) {
  const fiveMin = 5 * 60_000;
  return new Date(Math.round((Date.now() + m * 60_000) / fiveMin) * fiveMin).toISOString();
}

export const mockCompanies: ClientCompany[] = [
  { slug: 'move-studio', name: 'Move Studio', segment: 'Academia e personal', initials: 'MV', capabilities: { scheduling: true, chat: true, training: true } },
  { slug: 'bela-vista', name: 'Studio Bela Vista', segment: 'Salão de beleza', initials: 'BV', capabilities: { scheduling: true, chat: true, training: false } },
  { slug: 'clinica-vitta', name: 'Clínica Vitta', segment: 'Estética e bem-estar', initials: 'CV', capabilities: { scheduling: true, chat: true, training: false } },
];

export function buildMockBookings(): ClientBooking[] {
  return [
    { id: 'b-past', tenant_slug: 'move-studio', tenant_name: 'Move Studio', starts_at: at(-3, 7), ends_at: at(-3, 8), status: 'done', service_name: 'Treino com personal', provider_name: 'Carlos Mendes', can_confirm: false, can_cancel: false, category: 'session', location: 'Av. Paulista, 1500 · sala 2' },
    { id: 'b-next', tenant_slug: 'move-studio', tenant_name: 'Move Studio', starts_at: minutesFromNow(45), ends_at: minutesFromNow(105), status: 'pending', service_name: 'Treino com personal', provider_name: 'Carlos Mendes', can_confirm: true, can_cancel: true, category: 'session', location: 'Av. Paulista, 1500 · sala 2' },
    { id: 'b-class', tenant_slug: 'move-studio', tenant_name: 'Move Studio', starts_at: at(0, 18, 30), ends_at: at(0, 19, 20), status: 'offer', service_name: 'Funcional em grupo', provider_name: 'Ana Ribeiro', can_confirm: false, can_cancel: false, kind: 'class', can_accept: true, cancel_counts: true, category: 'class', location: 'Sala multiuso', class_capacity: 12, class_enrolled: 10, waitlist_position: 2, offer_expires_at: minutesFromNow(15) },
    { id: 'b-eval', tenant_slug: 'move-studio', tenant_name: 'Move Studio', starts_at: at(2, 9), ends_at: at(2, 9, 40), status: 'confirmed', service_name: 'Avaliação física', provider_name: 'Carlos Mendes', can_confirm: false, can_cancel: true, category: 'evaluation', location: 'Av. Paulista, 1500 · sala 1' },
    { id: 'b-hair', tenant_slug: 'bela-vista', tenant_name: 'Studio Bela Vista', starts_at: at(5, 14), ends_at: at(5, 15, 30), status: 'confirmed', service_name: 'Coloração e corte', provider_name: 'Bia Nunes', can_confirm: false, can_cancel: true, category: 'service', location: 'Rua das Orquídeas, 120' },
    { id: 'b-skin', tenant_slug: 'clinica-vitta', tenant_name: 'Clínica Vitta', starts_at: at(8, 10), ends_at: at(8, 11), status: 'pending', service_name: 'Limpeza de pele', provider_name: 'Dra. Paula Reis', can_confirm: true, can_cancel: true, category: 'service', location: 'Av. Brasil, 88' },
  ];
}

export function buildMockChats(): ClientChat[] {
  return [
    {
      tenant_slug: 'move-studio',
      tenant_name: 'Move Studio',
      team_label: 'Carlos, Ana e recepção',
      service_hours_text: 'Seg a sex, 6h às 21h',
      whatsapp_url: null,
      unread: 2,
      messages: [
        { id: 'm1', from: 'team', author_name: 'Carlos Mendes', text: 'Bom dia, Marina! Separei o vídeo do búlgaro para você ver antes da próxima perna.', at: minutesFromNow(-55), attachment: null },
        { id: 'm2', from: 'team', author_name: 'Carlos Mendes', text: '', at: minutesFromNow(-54), attachment: { kind: 'video', uri: '', duration_s: 42, title: 'Agachamento búlgaro' } },
        { id: 'm3', from: 'me', text: 'Meu joelho fica assim no final. Tá certo?', at: minutesFromNow(-50), attachment: { kind: 'image', uri: '' }, status: 'read' },
        { id: 'm4', from: 'team', author_name: 'Carlos Mendes', text: 'Tá ótimo! Só não deixa o joelho passar da ponta do pé. Segue sua avaliação de outubro:', at: minutesFromNow(-48), attachment: null },
        { id: 'm5', from: 'team', author_name: 'Carlos Mendes', text: '', at: minutesFromNow(-48), attachment: { kind: 'document', uri: '', name: 'Avaliação física — outubro.pdf', size_bytes: 1_250_000, pages: 4 } },
        { id: 'm6', from: 'team', author_name: 'Carlos Mendes', text: '', at: minutesFromNow(-46), attachment: { kind: 'audio', uri: '', duration_s: 4, asset: DEMO_VOICE } },
      ],
    },
    {
      tenant_slug: 'bela-vista',
      tenant_name: 'Studio Bela Vista',
      team_label: 'Bia e recepção',
      service_hours_text: 'Ter a sáb, 9h às 19h',
      whatsapp_url: null,
      unread: 0,
      messages: [
        { id: 'n1', from: 'me', text: 'Referência da cor que eu quero', at: at(-1, 17, 10), attachment: { kind: 'image', uri: '' }, status: 'read' },
        { id: 'n2', from: 'team', author_name: 'Bia Nunes', text: 'Linda! Dá para fazer em uma sessão.', at: at(-1, 17, 40), attachment: null },
      ],
    },
    {
      tenant_slug: 'clinica-vitta',
      tenant_name: 'Clínica Vitta',
      team_label: 'Dra. Paula e recepção',
      service_hours_text: null,
      whatsapp_url: null,
      unread: 0,
      messages: [
        { id: 'v1', from: 'team', author_name: 'Recepção', text: 'Orientações antes da limpeza de pele', at: at(-4, 11), attachment: { kind: 'document', uri: '', name: 'Orientações pré-procedimento.pdf', size_bytes: 380_000, pages: 2 } },
      ],
    },
  ];
}
