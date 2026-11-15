/**
 * Catálogo canônico de push/in-app do Operax Mobile.
 * Default: tudo LIGADO. Push deve chegar com tela bloqueada (FCM/APNs).
 */

import i18n from '@/src/i18n';

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
    get label() {
      return i18n.t('staff:push.queue_new.label');
    },
    get description() {
      return i18n.t('staff:push.queue_new.description');
    },
    types: ['queue.new', 'conversation.queued'],
    defaultEnabled: true,
  },
  {
    id: 'claimed_message',
    get label() {
      return i18n.t('staff:push.claimed_message.label');
    },
    get description() {
      return i18n.t('staff:push.claimed_message.description');
    },
    types: ['conversation.message', 'message', 'inbox'],
    defaultEnabled: true,
  },
  {
    id: 'ownership_expiring',
    get label() {
      return i18n.t('staff:push.ownership_expiring.label');
    },
    get description() {
      return i18n.t('staff:push.ownership_expiring.description');
    },
    types: ['chat_urgency', 'assignment.expiring'],
    defaultEnabled: true,
  },
  {
    id: 'assignment_expired',
    get label() {
      return i18n.t('staff:push.assignment_expired.label');
    },
    get description() {
      return i18n.t('staff:push.assignment_expired.description');
    },
    types: ['assignment.expired'],
    defaultEnabled: true,
  },
  {
    id: 'chat_message',
    get label() {
      return i18n.t('staff:push.chat_message.label');
    },
    get description() {
      return i18n.t('staff:push.chat_message.description');
    },
    types: ['chat.message'],
    defaultEnabled: true,
  },
  {
    id: 'chat_mention',
    get label() {
      return i18n.t('staff:push.chat_mention.label');
    },
    get description() {
      return i18n.t('staff:push.chat_mention.description');
    },
    types: ['chat.mention', 'mention'],
    defaultEnabled: true,
  },
  {
    id: 'booking_new',
    get label() {
      return i18n.t('staff:push.booking_new.label');
    },
    get description() {
      return i18n.t('staff:push.booking_new.description');
    },
    types: ['scheduling.booking_new', 'booking.created'],
    defaultEnabled: true,
  },
  {
    id: 'booking_reschedule',
    get label() {
      return i18n.t('staff:push.booking_reschedule.label');
    },
    get description() {
      return i18n.t('staff:push.booking_reschedule.description');
    },
    types: ['scheduling.booking_reschedule', 'scheduling.reschedule_pending_manual'],
    defaultEnabled: true,
  },
  {
    id: 'reminder',
    get label() {
      return i18n.t('staff:push.reminder.label');
    },
    get description() {
      return i18n.t('staff:push.reminder.description');
    },
    types: ['reminder', 'scheduling.reminder', 'kanban.followup_due'],
    defaultEnabled: true,
  },
  {
    id: 'transfer',
    get label() {
      return i18n.t('staff:push.transfer.label');
    },
    get description() {
      return i18n.t('staff:push.transfer.description');
    },
    types: ['assignment.transferred', 'conversation.transferred'],
    defaultEnabled: true,
  },
  {
    id: 'urgency',
    get label() {
      return i18n.t('staff:push.urgency.label');
    },
    get description() {
      return i18n.t('staff:push.urgency.description');
    },
    types: ['chat_urgency'],
    defaultEnabled: true,
  },
  {
    id: 'kanban_followup',
    get label() {
      return i18n.t('staff:push.kanban_followup.label');
    },
    get description() {
      return i18n.t('staff:push.kanban_followup.description');
    },
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
