import type { Ionicons } from '@expo/vector-icons';
import { hasPermission, type PermissionNeed } from '@/src/features/auth/permissions';

type IconName = keyof typeof Ionicons.glyphMap;

export type SectionId = 'profile' | 'conversations' | 'notes' | 'agendamentos' | 'crediario' | 'dependents' | 'documents' | 'interests' | 'tag_history';
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
  { id: 'crediario', icon: 'wallet-outline', group: 'finance', perm: 'pos:receivables_read', app: 'pos' },
  { id: 'dependents', icon: 'people-outline', group: 'registry', perm: 'contacts:read' },
  { id: 'documents', icon: 'folder-open-outline', group: 'registry', perm: 'contacts:read' },
  { id: 'interests', icon: 'locate-outline', group: 'registry', perm: 'contacts:view_interests' },
  { id: 'tag_history', icon: 'pricetags-outline', group: 'registry', perm: 'contacts:read' },
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
    return true;
  });
}

export const isSectionId = (v: unknown): v is SectionId => SECTIONS.some((s) => s.id === v);
