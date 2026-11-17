import type { Ionicons } from '@expo/vector-icons';
import { hasPermission, type PermissionNeed } from '@/src/features/auth/permissions';

type IconName = keyof typeof Ionicons.glyphMap;

export type SectionId =
  | 'profile' | 'conversations' | 'notes' | 'agendamentos' | 'reminders' | 'nps' | 'campaigns'
  | 'crediario' | 'cobranca'
  | 'fitness' | 'mensalidades' | 'clinical' | 'exams'
  | 'service_orders' | 'workshop' | 'access' | 'contracts' | 'member_cards' | 'member_contracts'
  | 'dependents' | 'documents' | 'interests' | 'tag_history' | 'compliance';
export type SectionGroup = 'relation' | 'finance' | 'registry';

type Def = {
  id: SectionId;
  icon: IconName;
  group: SectionGroup;
  /** Mesmas permissões do Operax web (basta uma). */
  perm: PermissionNeed;
  /** App que a empresa precisa ter instalado, quando a seção vem de um app. */
  app?: string;
};

/** Ordem de cima para baixo na tela do contato. As permissões e os apps são os do web (`dossier/sections.ts`). */
export const SECTIONS: readonly Def[] = [
  { id: 'profile', icon: 'person-circle-outline', group: 'registry', perm: 'contacts:read' },
  { id: 'conversations', icon: 'chatbubbles-outline', group: 'relation', perm: 'conversations:read_own' },
  { id: 'notes', icon: 'document-text-outline', group: 'relation', perm: 'conversations:read_own' },
  { id: 'agendamentos', icon: 'calendar-outline', group: 'relation', perm: ['scheduling:read_all', 'scheduling:read_own'], app: 'agenda' },
  { id: 'reminders', icon: 'alarm-outline', group: 'relation', perm: 'contacts:read', app: 'reminders' },
  { id: 'nps', icon: 'star-outline', group: 'relation', perm: 'cs:read', app: 'customer-success' },
  { id: 'campaigns', icon: 'megaphone-outline', group: 'relation', perm: 'campaigns:read' },
  { id: 'crediario', icon: 'wallet-outline', group: 'finance', perm: 'pos:receivables_read', app: 'pos' },
  { id: 'cobranca', icon: 'cash-outline', group: 'finance', perm: 'cobranca:read' },
  { id: 'service_orders', icon: 'clipboard-outline', group: 'relation', perm: 'service_orders:read', app: 'service-orders' },
  { id: 'contracts', icon: 'document-attach-outline', group: 'registry', perm: 'contracts:read', app: 'contracts' },
  { id: 'member_contracts', icon: 'document-text-outline', group: 'finance', perm: 'members:read', app: 'associados' },
  { id: 'member_cards', icon: 'card-outline', group: 'registry', perm: 'members:read', app: 'associados' },
  { id: 'workshop', icon: 'car-outline', group: 'registry', perm: 'workshop:read', app: 'workshop' },
  { id: 'access', icon: 'enter-outline', group: 'registry', perm: 'access_control:read', app: 'access-control' },
  { id: 'mensalidades', icon: 'calendar-number-outline', group: 'finance', perm: ['members:read', 'members:issue', 'finance:read', 'finance:manage', 'finance:settings'], app: 'associados' },
  { id: 'fitness', icon: 'barbell-outline', group: 'registry', perm: 'fitness:read', app: 'fitness' },
  { id: 'clinical', icon: 'medkit-outline', group: 'registry', perm: 'clinical:patients_read', app: 'clinica' },
  { id: 'exams', icon: 'flask-outline', group: 'registry', perm: 'clinical:exams_read', app: 'clinica' },
  { id: 'dependents', icon: 'people-outline', group: 'registry', perm: 'contacts:read' },
  { id: 'documents', icon: 'folder-open-outline', group: 'registry', perm: 'contacts:read' },
  { id: 'interests', icon: 'locate-outline', group: 'registry', perm: 'contacts:view_interests' },
  { id: 'tag_history', icon: 'pricetags-outline', group: 'registry', perm: 'contacts:read' },
  { id: 'compliance', icon: 'shield-checkmark-outline', group: 'registry', perm: 'compliance:read' },
];

export const GROUP_ORDER: readonly SectionGroup[] = ['relation', 'finance', 'registry'];

export type SectionContext = {
  permissions: readonly string[] | undefined;
  /** Slugs dos apps instalados (null enquanto ainda não chegou). */
  apps: readonly string[] | null;
  /** O PDV da empresa vende a prazo (crediário ligado). */
  crediario: boolean;
};

/** Seções que a pessoa pode abrir neste contato, na ordem da tela. Quem não tem a permissão ou o app nem vê a linha. */
export function visibleSections(ctx: SectionContext): Def[] {
  return SECTIONS.filter((s) => {
    if (!hasPermission(ctx.permissions, s.perm)) return false;
    if (s.app && !(ctx.apps ?? []).includes(s.app)) return false;
    if (s.id === 'crediario' && !ctx.crediario) return false;
    // Mensalidades vêm do Financeiro: sem o app instalado não há o que mostrar.
    if (s.id === 'mensalidades' && !(ctx.apps ?? []).includes('finance')) return false;
    return true;
  });
}

export const isSectionId = (v: unknown): v is SectionId => SECTIONS.some((s) => s.id === v);
