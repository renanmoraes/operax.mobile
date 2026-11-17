import type { Shape } from '../../shape';
import type pt from '../pt/nav';

const nav: Shape<typeof pt> = {
  staff: { inbox: '$t(vocab:attendance)', agenda: '$t(vocab:agenda)', notifications: 'Avisos', more: 'Más', kanban: '$t(vocab:kanban)', profile: 'Perfil', pos: 'PDV', people: '$t(vocab:Contacts)', history: 'Historial' },
  client: { home: 'Inicio', agenda: 'Agenda', fitness: 'Entreno', chats: 'Mensajes', profile: 'Perfil' },
  badge_one: '{{label}}, {{count}} mensaje nuevo',
  badge_other: '{{label}}, {{count}} mensajes nuevos',
  badgeDot: '{{label}}, mensajes nuevos',
};

export default nav;
