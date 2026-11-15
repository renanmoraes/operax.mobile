import { colors } from '@/src/design-system/tokens';
import type { TeamMember } from '@/src/shared/api/attendance.api';

/**
 * "Atendendo" exige as duas coisas: marcado como disponível E com o Operax aberto (web ou app).
 * Marcado como disponível com tudo fechado vira um aviso: a fila pode estar mandando conversa para ninguém.
 */
export type PresenceState = 'online' | 'busy' | 'away' | 'stale' | 'closed';

export function presenceOf(m: Pick<TeamMember, 'availability_status' | 'connected'>): PresenceState {
  if (!m.connected) return m.availability_status === 'online' ? 'stale' : 'closed';
  if (m.availability_status === 'online') return 'online';
  return m.availability_status === 'busy' ? 'busy' : 'away';
}

const ORDER: Record<PresenceState, number> = { online: 0, busy: 1, away: 2, stale: 3, closed: 4 };

export const PRESENCE_COLOR: Record<PresenceState, string> = {
  online: colors.success,
  busy: '#d97706',
  away: '#94a3b8',
  stale: '#d97706',
  closed: '#cbd5e1',
};

export function sortByPresence(list: TeamMember[]) {
  return [...list].sort((a, b) => ORDER[presenceOf(a)] - ORDER[presenceOf(b)] || a.name.localeCompare(b.name));
}
