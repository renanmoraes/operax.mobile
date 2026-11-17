/** Curinga do Operax (super admin): concede qualquer permissão. */
export const WILDCARD_PERMISSION = '*';

/** Uma permissão, ou várias em que basta ter qualquer uma (ex.: ver as próprias OU todas as conversas). */
export type PermissionNeed = string | readonly string[];

export function hasPermission(permissions: readonly string[] | undefined, required?: PermissionNeed): boolean {
  if (!required) return true;
  const list = permissions ?? [];
  if (list.includes(WILDCARD_PERMISSION)) return true;
  const any = typeof required === 'string' ? [required] : required;
  return any.length === 0 || any.some((code) => list.includes(code));
}

/**
 * O que cada parte do app exige — mesmos códigos do Operax web (`nav-config.ts` e telas).
 * Quem não tem a permissão nem vê a aba, o item do menu ou o botão.
 */
export const PERMS = {
  // Abas e menu
  inbox: ['conversations:read_own', 'conversations:read_all'],
  agenda: ['scheduling:read_own', 'scheduling:read_all'],
  contacts: 'contacts:read',
  kanban: 'kanban:read',
  history: 'conversations:view_history',
  quickReplies: 'quick_replies:read',
  templates: 'conversations:send_template',
  teamChat: 'chat:read',
  // Chat da equipe
  teamChatSend: 'chat:send_message',
  teamChatMedia: 'chat:send_media',
  // Atendimento
  claim: 'conversations:claim',
  release: 'conversations:release',
  transfer: 'conversations:transfer',
  /** Mandar a conversa para outra fila (o web chama de "encaminhar para a fila"). */
  transferQueue: 'conversations:send_handoff',
  queuesRead: 'queues:read',
  /** Ver quem da equipe está online e mudar a própria disponibilidade. */
  teamPresence: 'users:view_availability',
  /** Cadastro de usuários: lista da equipe para transferir quando falta a permissão de ver presença. */
  usersRead: 'users:read',
  /** Usar a IA (resumo, sugestões, melhorar o texto). Também precisa do app de IA na empresa. */
  aiUse: 'ai:use',
  // PDV (venda em campo)
  posSell: 'pos:sell',
  posRead: 'pos:read',
  posDiscountLine: 'pos:discount_line',
  posDiscountOrder: 'pos:discount_order',
  posPriceOverride: 'pos:price_override',
  posVoid: 'pos:void',
  posPaymentEdit: 'pos:payment_edit',
  posShiftsOpen: 'pos:shifts_open',
  posShiftsClose: 'pos:shifts_close',
  posCashMovement: 'pos:cash_movement',
  /** Cadastrar produto (catálogo) e, com o Estoque, lançar o saldo inicial. */
  productsManage: 'products:manage',
  inventoryManage: 'inventory:manage',
  contactsCreate: 'contacts:create',
  contactsUpdate: 'contacts:update',
  complianceWrite: 'compliance:write',
  close: 'conversations:close',
  sendMessage: 'conversations:send_message',
  sendMedia: 'conversations:send_media',
  comment: 'conversations:comment_internal',
  pixKeysManage: 'conversations:manage_pix_keys',
  // Eventos: check-in na entrada (ler o ingresso do aluno)
  eventsCheckin: 'events:register',
  // Kanban
  kanbanMove: 'kanban:move_card',
  // Agenda
  bookingCreate: ['scheduling:create', 'scheduling:create_own'],
  bookingApprove: 'scheduling:approve',
  bookingCancel: 'scheduling:cancel',
} as const satisfies Record<string, PermissionNeed>;

export type PermKey = keyof typeof PERMS;

/** Primeira aba que a pessoa pode abrir (sem atendimento nem agenda, sobra Avisos). */
export function firstStaffTab(permissions: readonly string[] | undefined): '/(app)/inbox' | '/(app)/agenda' | '/(app)/notifications' {
  if (hasPermission(permissions, PERMS.inbox)) return '/(app)/inbox';
  if (hasPermission(permissions, PERMS.agenda)) return '/(app)/agenda';
  return '/(app)/notifications';
}
