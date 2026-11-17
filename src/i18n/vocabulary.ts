/**
 * Vocabulário do tenant (app de terminologia, ex.: "Pacientes" no lugar de "Contatos").
 * O servidor devolve só o que a empresa trocou; o resto fica com a palavra padrão do app, no idioma dele.
 * As palavras viram variáveis do i18next (`{{contacts}}`, `{{Contacts}}`...), então qualquer texto do app que as use
 * muda junto, sem passar nada em cada chamada. Só vale em português: a palavra da empresa é escrita em português.
 */
export type VocabMap = Record<string, string>;
type Lang = 'pt' | 'en' | 'es';

type Words = {
  contact: string; contacts: string; client: string;
  booking: string; bookings: string; service: string; services: string;
  provider: string; providers: string; location: string; locations: string;
  bookingCreate: string; bookingCreated: string; agenda: string; kanban: string; attendance: string;
  /** Título da lista de contatos (pode diferir do plural: "Pacientes" vs "pacientes"). */
  contactsTitle: string;
};

/** O que o app mostra sem nenhuma troca. Em português, o mesmo padrão do Operax web (Contatos, Agendamento…). */
const DEFAULTS: Record<Lang, Words> = {
  pt: { contact: 'contato', contacts: 'contatos', client: 'cliente', booking: 'agendamento', bookings: 'agendamentos', service: 'serviço', services: 'serviços', provider: 'profissional', providers: 'profissionais', location: 'unidade', locations: 'unidades', bookingCreate: 'Novo agendamento', bookingCreated: 'Agendamento criado', agenda: 'Agenda', kanban: 'Kanban', attendance: 'Atendimento', contactsTitle: 'Contatos' },
  en: { contact: 'contact', contacts: 'contacts', client: 'client', booking: 'appointment', bookings: 'appointments', service: 'service', services: 'services', provider: 'professional', providers: 'professionals', location: 'location', locations: 'locations', bookingCreate: 'New appointment', bookingCreated: 'Appointment created', agenda: 'Schedule', kanban: 'Kanban', attendance: 'Service', contactsTitle: 'Contacts' },
  es: { contact: 'contacto', contacts: 'contactos', client: 'cliente', booking: 'cita', bookings: 'citas', service: 'servicio', services: 'servicios', provider: 'profesional', providers: 'profesionales', location: 'unidad', locations: 'unidades', bookingCreate: 'Nueva cita', bookingCreated: 'Cita creada', agenda: 'Agenda', kanban: 'Kanban', attendance: 'Atención', contactsTitle: 'Contactos' },
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** Plural simples em português, para quando a empresa troca o singular e não o plural. */
export function pluralPt(word: string): string {
  const w = word.trim();
  if (/ão$/i.test(w)) return `${w.slice(0, -2)}ões`;
  if (/m$/i.test(w)) return `${w.slice(0, -1)}ns`;
  if (/[rz]$/i.test(w)) return `${w}es`;
  if (/l$/i.test(w)) return `${w.slice(0, -1)}is`;
  if (/s$/i.test(w)) return w;
  return `${w}s`;
}

const clean = (v: string | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Variáveis de interpolação para o idioma, com as trocas da empresa por cima (só em português). */
export function varsFor(lang: string, map: VocabMap = {}): Record<string, string> {
  const l: Lang = lang === 'en' || lang === 'es' ? lang : 'pt';
  const d = DEFAULTS[l];
  const o = l === 'pt' ? map : {};
  const pick = (key: string) => clean(o[key]);

  const entity = (singularKey: string, pluralKey: string, ds: string, dp: string) => {
    const s = pick(singularKey);
    const p = pick(pluralKey);
    const singular = lower(s ?? ds);
    return { singular, plural: lower(p ?? (s ? pluralPt(s) : dp)) };
  };
  const contact = entity('entity.contact', 'entity.contact.plural', d.contact, d.contacts);
  const booking = entity('entity.booking', 'entity.booking.plural', d.booking, d.bookings);
  const service = entity('entity.service', 'entity.service.plural', d.service, d.services);
  const provider = entity('entity.provider', 'entity.provider.plural', d.provider, d.providers);
  const location = entity('entity.location', 'entity.location.plural', d.location, d.locations);
  const client = lower(pick('ui.field.client') ?? d.client);
  const contactsTitle = pick('ui.page.contacts.title') ?? pick('nav.item.contacts') ?? cap(contact.plural === d.contacts ? d.contactsTitle : contact.plural);

  return {
    contact: contact.singular, Contact: cap(contact.singular), contacts: contact.plural, Contacts: contactsTitle,
    client, Client: cap(client),
    booking: booking.singular, Booking: cap(booking.singular), bookings: booking.plural, Bookings: cap(booking.plural),
    service: service.singular, Service: cap(service.singular), services: service.plural, Services: cap(service.plural),
    provider: provider.singular, Provider: cap(provider.singular), providers: provider.plural, Providers: cap(provider.plural),
    location: location.singular, Location: cap(location.singular), locations: location.plural, Locations: cap(location.plural),
    bookingCreate: pick('ui.action.booking.create') ?? d.bookingCreate,
    bookingCreated: pick('ui.toast.booking.created') ?? d.bookingCreated,
    agenda: pick('ui.page.agenda.title') ?? d.agenda,
    kanban: pick('ui.page.kanban.title') ?? d.kanban,
    attendance: pick('nav.group.atendimento') ?? d.attendance,
  };
}
