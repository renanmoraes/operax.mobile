export type Channel = 'whatsapp' | 'instagram' | 'messenger' | `hub:${string}`;
export type ConvSegment = 'active' | 'queue' | 'history';

export type Conversation = {
  id: string;
  contactName: string;
  contactId: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  queue: string;
  channel: Channel;
  urgency?: 'normal' | 'high' | 'critical';
  segment: ConvSegment;
  ownership: 'mine' | 'queue' | 'other' | 'closed';
  within24h: boolean;
  /** Número/conexão por onde a conversa chegou (empresa com vários números). */
  connectionId?: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  direction: 'in' | 'out';
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'pix';
  body: string;
  at: string;
  status?: 'sent' | 'delivered' | 'read';
  /** Legenda real de foto/vídeo/documento (o `body` pode trazer só o nome do arquivo). */
  caption?: string;
  /** Nome do arquivo, quando for documento. */
  fileName?: string;
  /** Id da mídia no servidor (áudio/foto/documento real); o link assinado é buscado ao tocar/abrir. */
  mediaId?: string;
  /** Arquivo local do áudio (gravado agora, antes de a API devolver o link). */
  audioUri?: string;
  durationS?: number;
  /** Chave Pix enviada pela conversa. */
  pix?: { key: string; key_type: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random' | 'copy_paste'; holder_name: string };
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  leadScore: number;
  notes: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  conversationId?: string;
  href?: string;
  at: string;
  read: boolean;
};

export type QuickReply = {
  id: string;
  slug: string;
  title: string;
  body: string;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  language: string;
  preview: string;
  status: 'approved' | 'pending';
};

export type KanbanCard = {
  id: string;
  title: string;
  contactName: string;
  stageId: string;
  value?: string;
};

export type KanbanStage = {
  id: string;
  name: string;
};

export type AgendaEvent = {
  id: string;
  title: string;
  contactName: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'pending' | 'done';
  location?: string;
};

export const currentUser = {
  id: 'u1',
  name: 'Ana Atendente',
  email: 'ana@clinica.exemplo',
  tenant: 'Clínica Horizonte',
  role: 'Atendente',
};

export const contacts: Contact[] = [
  {
    id: 'c1',
    name: 'Maria Silva',
    phone: '+55 11 98888-1001',
    email: 'maria@email.com',
    tags: ['paciente', 'retorno'],
    leadScore: 72,
    notes: 'Prefere horário da manhã. Convênio Unimed.',
  },
  {
    id: 'c2',
    name: 'João Pedro',
    phone: '+55 11 97777-2002',
    tags: ['novo'],
    leadScore: 45,
    notes: 'Chegou via Instagram.',
  },
  {
    id: 'c3',
    name: 'Carla Mendes',
    phone: '+55 21 96666-3003',
    tags: ['comercial'],
    leadScore: 88,
    notes: 'Interessada em plano anual.',
  },
  { id: 'c4', name: 'Fernanda Rocha', phone: '+55 11 95555-4004', email: 'fernanda@email.com', tags: ['paciente', 'convênio'], leadScore: 64, notes: 'Convênio Unimed. Retorno a cada 3 meses.' },
  { id: 'c5', name: 'Paulo Nunes', phone: '+55 11 94444-5005', tags: ['paciente'], leadScore: 51, notes: 'Bradesco Saúde.' },
  { id: 'c6', name: 'Lívia Torres', phone: '+55 11 93333-6006', tags: ['novo', 'particular'], leadScore: 39, notes: 'Primeira consulta marcada pelo app.' },
  { id: 'c7', name: 'Bruno Lima', phone: '+55 11 92222-7007', email: 'bruno@email.com', tags: ['paciente', 'academia'], leadScore: 70, notes: 'Treina na academia parceira.' },
  { id: 'c8', name: 'Dr. Ricardo Alves', phone: '+55 11 91111-8008', tags: ['parceiro'], leadScore: 90, notes: 'Médico parceiro, encaminha pacientes.' },
];

/** Equipe do demo para marcar com @ no chat interno. */
export const teamUsers = [
  { id: 'u2', name: 'Juliana Costa', email: 'juliana@clinica.exemplo' },
  { id: 'u3', name: 'Dr. Ricardo Alves', email: 'ricardo@clinica.exemplo' },
  { id: 'u4', name: 'Pedro Lima', email: 'pedro@clinica.exemplo' },
  { id: 'u5', name: 'Camila Rocha', email: 'camila@clinica.exemplo' },
];

export const conversations: Conversation[] = [
  {
    id: 'cv-ml',
    contactName: 'Bruno Almeida',
    contactId: '',
    lastMessage: 'O produto chega até sexta?',
    updatedAt: '11:20',
    unread: 1,
    queue: 'Vendas online',
    channel: 'hub:mercado-livre',
    segment: 'active',
    ownership: 'mine',
    within24h: true,
  },
  {
    id: 'cv1',
    contactName: 'Maria Silva',
    contactId: 'c1',
    lastMessage: 'Posso remarcar para quinta?',
    updatedAt: '10:42',
    unread: 2,
    queue: 'Recepção',
    channel: 'whatsapp',
    urgency: 'high',
    segment: 'active',
    ownership: 'mine',
    within24h: true,
  },
  {
    id: 'cv2',
    contactName: 'João Pedro',
    contactId: 'c2',
    lastMessage: 'Quero agendar uma avaliação',
    updatedAt: '09:15',
    unread: 1,
    queue: 'Comercial',
    channel: 'instagram',
    segment: 'queue',
    ownership: 'queue',
    within24h: true,
  },
  {
    id: 'cv3',
    contactName: 'Carla Mendes',
    contactId: 'c3',
    lastMessage: 'Obrigada pelo retorno!',
    updatedAt: 'Ontem',
    unread: 0,
    queue: 'Comercial',
    channel: 'whatsapp',
    segment: 'history',
    ownership: 'closed',
    within24h: false,
  },
  {
    id: 'cv4',
    contactName: 'Dr. Ricardo',
    contactId: 'c1',
    lastMessage: 'Paciente já está na recepção',
    updatedAt: '11:05',
    unread: 0,
    queue: 'Clínica',
    channel: 'whatsapp',
    urgency: 'critical',
    segment: 'active',
    ownership: 'mine',
    within24h: true,
  },
];

export const messages: Message[] = [
  { id: 'm-ml1', conversationId: 'cv-ml', direction: 'in', type: 'text', body: 'Oi! Comprei o tênis ontem. O produto chega até sexta?', at: '11:18' },
  { id: 'm-ml2', conversationId: 'cv-ml', direction: 'in', type: 'text', body: 'O produto chega até sexta?', at: '11:20' },
  {
    id: 'm1',
    conversationId: 'cv1',
    direction: 'in',
    type: 'text',
    body: 'Olá! Preciso remarcar minha consulta.',
    at: '10:30',
  },
  {
    id: 'm2',
    conversationId: 'cv1',
    direction: 'out',
    type: 'text',
    body: 'Claro, Maria. Qual dia fica melhor?',
    at: '10:35',
    status: 'read',
  },
  {
    id: 'm3',
    conversationId: 'cv1',
    direction: 'in',
    type: 'text',
    body: 'Posso remarcar para quinta?',
    at: '10:42',
  },
  {
    id: 'm4',
    conversationId: 'cv1',
    direction: 'in',
    type: 'image',
    body: 'pedido-exame.jpg',
    at: '10:43',
  },
  {
    id: 'm4b',
    conversationId: 'cv1',
    direction: 'in',
    type: 'document',
    body: 'Pedido de exame.pdf',
    fileName: 'Pedido de exame.pdf',
    at: '10:44',
  },
  {
    id: 'm5',
    conversationId: 'cv2',
    direction: 'in',
    type: 'text',
    body: 'Quero agendar uma avaliação',
    at: '09:15',
  },
];

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    type: 'conversation.message',
    title: 'Nova mensagem no atendimento',
    body: 'Maria Silva: Posso remarcar para quinta?',
    conversationId: 'cv1',
    at: '10:42',
    read: false,
  },
  {
    id: 'n2',
    type: 'queue.new',
    title: 'Novo atendimento na fila',
    body: 'João Pedro aguardando na fila Comercial',
    conversationId: 'cv2',
    at: '09:15',
    read: false,
  },
  {
    id: 'n3',
    type: 'chat_urgency',
    title: 'Atendimento perto do vencimento',
    body: 'Posse de Maria Silva em 85% do tempo — responda ou transfira.',
    conversationId: 'cv1',
    at: '10:55',
    read: false,
  },
  {
    id: 'n4',
    type: 'chat.message',
    title: 'Mensagem no chat interno',
    body: 'Dr. Ricardo: Paciente já está na recepção',
    href: '/(app)/notifications',
    at: '11:05',
    read: false,
  },
  {
    id: 'n5',
    type: 'chat.mention',
    title: 'Marcação no chat interno',
    body: '@Ana Atendente pode assumir a fila Clínica?',
    at: '11:06',
    read: false,
  },
  {
    id: 'n6',
    type: 'scheduling.booking_new',
    title: 'Novo agendamento',
    body: 'Consulta retorno — Maria Silva às 14:00',
    href: '/(app)/agenda',
    at: '08:40',
    read: true,
  },
  {
    id: 'n7',
    type: 'scheduling.booking_reschedule',
    title: 'Reagendamento',
    body: 'João Pedro pediu mudança para 15:00',
    href: '/(app)/agenda',
    at: '09:20',
    read: true,
  },
  {
    id: 'n8',
    type: 'scheduling.reminder',
    title: 'Lembrete',
    body: 'Em 30 min: Avaliação — João Pedro (Sala 1)',
    href: '/(app)/agenda',
    at: '14:30',
    read: true,
  },
  {
    id: 'n9',
    type: 'assignment.transferred',
    title: 'Transferência de conversa',
    body: 'Carla Mendes foi transferida para você',
    conversationId: 'cv3',
    at: 'Ontem',
    read: true,
  },
];

export const quickReplies: QuickReply[] = [
  {
    id: 'qr1',
    slug: 'saudacao',
    title: 'Saudação',
    body: 'Olá! Sou da equipe Operax. Como posso ajudar?',
  },
  {
    id: 'qr2',
    slug: 'horario',
    title: 'Horário de atendimento',
    body: 'Nosso horário é de segunda a sexta, das 8h às 18h.',
  },
  {
    id: 'qr3',
    slug: 'docs',
    title: 'Documentos',
    body: 'Por favor, envie documento com foto e pedido médico.',
  },
];

export const templates: Template[] = [
  {
    id: 't1',
    name: 'lembrete_consulta',
    category: 'UTILITY',
    language: 'pt_BR',
    preview: 'Olá {{1}}, lembramos sua consulta em {{2}} às {{3}}.',
    status: 'approved',
  },
  {
    id: 't2',
    name: 'pos_atendimento',
    category: 'MARKETING',
    language: 'pt_BR',
    preview: 'Olá {{1}}, como foi seu atendimento conosco?',
    status: 'approved',
  },
  {
    id: 't3',
    name: 'novo_fluxo',
    category: 'UTILITY',
    language: 'pt_BR',
    preview: 'Template em análise pela Meta…',
    status: 'pending',
  },
];

export const kanbanStages: KanbanStage[] = [
  { id: 's1', name: 'Novo' },
  { id: 's2', name: 'Qualificado' },
  { id: 's3', name: 'Proposta' },
  { id: 's4', name: 'Ganho' },
];

export const kanbanCards: KanbanCard[] = [
  { id: 'k1', title: 'Avaliação inicial', contactName: 'João Pedro', stageId: 's1' },
  { id: 'k2', title: 'Plano anual', contactName: 'Carla Mendes', stageId: 's2', value: 'R$ 2.400' },
  { id: 'k3', title: 'Retorno clínico', contactName: 'Maria Silva', stageId: 's3' },
  { id: 'k4', title: 'Fechamento Unimed', contactName: 'Empresa Alfa', stageId: 's4', value: 'R$ 8.900' },
];

export const agendaEvents: AgendaEvent[] = [
  { id: 'a-m1', title: 'Avaliação física', contactName: 'Bruno Lima', startsAt: '08:30', endsAt: '09:15', status: 'done', location: 'Sala 1' },
  { id: 'a-m2', title: 'Consulta', contactName: 'Fernanda Rocha', startsAt: '10:00', endsAt: '10:50', status: 'done', location: 'Sala 2' },
  { id: 'a-m3', title: 'Retorno', contactName: 'Paulo Nunes', startsAt: '11:45', endsAt: '12:40', status: 'confirmed', location: 'Sala 2' },
  { id: 'a-m4', title: 'Primeira consulta', contactName: 'Lívia Torres', startsAt: '15:15', endsAt: '16:00', status: 'confirmed', location: 'Sala 2' },
  {
    id: 'a1',
    title: 'Consulta — retorno',
    contactName: 'Maria Silva',
    startsAt: '14:00',
    endsAt: '14:30',
    status: 'confirmed',
    location: 'Sala 2',
  },
  {
    id: 'a2',
    title: 'Avaliação',
    contactName: 'João Pedro',
    startsAt: '15:00',
    endsAt: '15:45',
    status: 'pending',
    location: 'Sala 1',
  },
  {
    id: 'a3',
    title: 'Alinhamento comercial',
    contactName: 'Carla Mendes',
    startsAt: '16:30',
    endsAt: '17:00',
    status: 'confirmed',
  },
];

export function getConversation(id: string) {
  return conversations.find((c) => c.id === id);
}

export function getMessages(conversationId: string) {
  return messages.filter((m) => m.conversationId === conversationId);
}

export function getContact(id: string) {
  return contacts.find((c) => c.id === id);
}

/** Ficha dos agendamentos do demo (mesmos campos que a API manda para a agenda). */
export const agendaDetails: Record<string, Record<string, unknown>> = {
  'a-m1': { provider_name: 'Dr. Ricardo Alves', payment_type: 'private', visit_kind: 'primeira_consulta', client_phone_e164: '+5511981112233', reminder_offsets_minutes: [1440, 120] },
  'a-m2': { provider_name: 'Dr. Ricardo Alves', payment_type: 'insurance', plan_type_name: 'Unimed', visit_kind: 'retorno', client_phone_e164: '+5511982223344', staff_notes: 'Trazer exames de sangue do mês passado.' },
  'a-m3': { provider_name: 'Dr. Ricardo Alves', payment_type: 'insurance', plan_type_name: 'Bradesco Saúde', visit_kind: 'retorno', client_phone_e164: '+5511983334455', reminder_offsets_minutes: [1440] },
  a1: {
    provider_name: 'Dr. Ricardo Alves',
    payment_type: 'insurance',
    plan_type_name: 'SulAmérica',
    visit_kind: 'retorno',
    client_phone_e164: '+5511987654321',
    client_contact_id: 'c1',
    customer_note: 'Posso chegar uns 10 minutos atrasada, estou vindo do trabalho.',
    staff_notes: 'Ajustar a dose do anti-inflamatório conforme o retorno.',
    reminder_offsets_minutes: [1440, 120],
    series_id: 's-maria',
    occurrence_index: 3,
  },
  a2: {
    provider_name: 'Ana Ribeiro',
    visit_kind: 'primeira_consulta',
    client_phone_e164: '+5511976543210',
    customer_note: 'Primeira vez, quero entender os planos.',
    requested_by_contact_name: 'Carla (mãe)',
    sem_lembrete: true,
    sem_lembrete_motivo: 'o pedido veio pelo Instagram e o contato não tem WhatsApp',
  },
  'a-m4': { provider_name: 'Dr. Ricardo Alves', payment_type: 'private', visit_kind: 'primeira_consulta', is_encaixe: true, encaixe_justification: 'Encaixe pedido pelo Dr. Ricardo: dor aguda.', client_phone_e164: '+5511985556677' },
  a3: { provider_name: 'Equipe comercial', payment_type: 'private', staff_notes: 'Revisar metas do mês e campanhas de retorno.' },
};

