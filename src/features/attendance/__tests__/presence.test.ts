import { presenceOf, sortByPresence } from '../presence';
import type { TeamMember } from '@/src/shared/api/attendance.api';

const m = (name: string, availability_status: TeamMember['availability_status'], connected: boolean): TeamMember => ({ id: name, name, availability_status, connected });

describe('presença da equipe', () => {
  it('só está atendendo quem está disponível e com o Operax aberto', () => {
    expect(presenceOf(m('a', 'online', true))).toBe('online');
    expect(presenceOf(m('b', 'busy', true))).toBe('busy');
    expect(presenceOf(m('c', 'offline', true))).toBe('away');
  });

  it('disponível com tudo fechado vira aviso, não "atendendo"', () => {
    expect(presenceOf(m('d', 'online', false))).toBe('stale');
    expect(presenceOf(m('e', 'busy', false))).toBe('closed');
  });

  it('ordena quem pode receber primeiro', () => {
    const order = sortByPresence([m('Zé', 'offline', false), m('Ana', 'online', false), m('Bia', 'busy', true), m('Caio', 'online', true)]).map((x) => x.name);
    expect(order).toEqual(['Caio', 'Bia', 'Ana', 'Zé']);
  });
});
