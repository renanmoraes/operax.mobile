/**
 * Catálogo canônico de push/in-app do Operax Mobile.
 * Default: tudo LIGADO. Push deve chegar com tela bloqueada (FCM/APNs).
 */

export type PushCategoryId =
  | 'queue_new'
  | 'claimed_message'
  | 'ownership_expiring'
  | 'assignment_expired'
  | 'chat_message'
  | 'chat_mention'
  | 'booking_new'
  | 'booking_reschedule'
  | 'reminder'
  | 'transfer'
  | 'urgency'
  | 'kanban_followup';

export type PushCategory = {
  id: PushCategoryId;
  label: string;
  description: string;
  /** Tipos `notifications.type` que mapeiam para esta categoria */
  types: string[];
  defaultEnabled: true;
};

export const PUSH_CATEGORIES: PushCategory[] = [
  {
    id: 'queue_new',
    label: 'Novo atendimento na fila',
    description: 'Conversa entrou na fila do seu setor e precisa ser assumida.',
    types: ['queue.new', 'conversation.queued'],
    defaultEnabled: true,
  },
  {
    id: 'claimed_message',
    label: 'Nova mensagem no atendimento',
    description: 'Cliente falou em conversa que você assumiu.',
    types: ['conversation.message', 'message', 'inbox'],
    defaultEnabled: true,
  },
  {
    id: 'ownership_expiring',
    label: 'Atendimento perto do vencimento',
    description: 'Sua posse está perto de expirar por inatividade.',
    types: ['chat_urgency', 'assignment.expiring'],
    defaultEnabled: true,
  },
  {
    id: 'assignment_expired',
    label: 'Posse expirada',
    description: 'A conversa voltou à fila porque o tempo de posse acabou.',
    types: ['assignment.expired'],
    defaultEnabled: true,
  },
  {
    id: 'chat_message',
    label: 'Mensagem no chat interno',
    description: 'Nova mensagem em canal interno da equipe.',
    types: ['chat.message'],
    defaultEnabled: true,
  },
  {
    id: 'chat_mention',
    label: 'Marcação no chat interno',
    description: 'Alguém mencionou você (@) no chat interno.',
    types: ['chat.mention', 'mention'],
    defaultEnabled: true,
  },
  {
    id: 'booking_new',
    label: 'Novo agendamento',
    description: 'Compromisso criado na agenda.',
    types: ['scheduling.booking_new', 'booking.created'],
    defaultEnabled: true,
  },
  {
    id: 'booking_reschedule',
    label: 'Reagendamento',
    description: 'Horário alterado ou reagendamento pendente.',
    types: ['scheduling.booking_reschedule', 'scheduling.reschedule_pending_manual'],
    defaultEnabled: true,
  },
  {
    id: 'reminder',
    label: 'Lembretes',
    description: 'Lembretes de agenda, follow-up e tarefas.',
    types: ['reminder', 'scheduling.reminder', 'kanban.followup_due'],
    defaultEnabled: true,
  },
  {
    id: 'transfer',
    label: 'Transferência de conversa',
    description: 'Conversa transferida para você ou para sua fila.',
    types: ['assignment.transferred', 'conversation.transferred'],
    defaultEnabled: true,
  },
  {
    id: 'urgency',
    label: 'Urgência no atendimento',
    description: 'Escalonamento crítico de conversa ativa.',
    types: ['chat_urgency'],
    defaultEnabled: true,
  },
  {
    id: 'kanban_followup',
    label: 'Follow-up do funil',
    description: 'Card com follow-up vencendo ou ganho/perda relevante.',
    types: ['kanban.followup_due', 'kanban.card_won', 'kanban.card_lost'],
    defaultEnabled: true,
  },
];

export type NotificationPrefsState = {
  sound: boolean;
  /** Master push — default true */
  push: boolean;
  desktop: boolean;
  email_digest: boolean;
  categories: Record<PushCategoryId, boolean>;
};

export function defaultNotificationPrefs(): NotificationPrefsState {
  const categories = Object.fromEntries(
    PUSH_CATEGORIES.map((c) => [c.id, true]),
  ) as Record<PushCategoryId, boolean>;
  return {
    sound: true,
    push: true,
    desktop: false,
    email_digest: false,
    categories,
  };
}

export function categoryForType(type: string): PushCategoryId | null {
  for (const cat of PUSH_CATEGORIES) {
    if (cat.types.includes(type)) return cat.id;
    const prefix = type.split('.')[0];
    if (cat.types.some((t) => t.endsWith('.*') && t.startsWith(prefix))) return cat.id;
  }
  // prefix heuristics
  if (type.startsWith('conversation.')) return 'claimed_message';
  if (type.startsWith('chat.')) return type.includes('mention') ? 'chat_mention' : 'chat_message';
  if (type.startsWith('scheduling.') || type.startsWith('booking.')) return 'booking_new';
  if (type.startsWith('kanban.')) return 'kanban_followup';
  return null;
}
