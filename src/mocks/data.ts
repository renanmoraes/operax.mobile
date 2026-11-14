export type Channel = 'whatsapp' | 'instagram' | 'messenger';
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
};

export type Message = {
  id: string;
  conversationId: string;
  direction: 'in' | 'out';
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  body: string;
  at: string;
  status?: 'sent' | 'delivered' | 'read';
  /** Legenda real de foto/vídeo/documento (o `body` pode trazer só o nome do arquivo). */
  caption?: string;
  /** Nome do arquivo, quando for documento. */
  fileName?: string;
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
];

export const conversations: Conversation[] = [
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
