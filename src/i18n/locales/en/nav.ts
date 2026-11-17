import type { Shape } from '../../shape';
import type pt from '../pt/nav';

const nav: Shape<typeof pt> = {
  staff: { inbox: '$t(vocab:attendance)', agenda: '$t(vocab:agenda)', notifications: 'Alerts', more: 'More', kanban: '$t(vocab:kanban)', profile: 'Profile', pos: 'POS', people: '$t(vocab:Contacts)', history: 'History' },
  client: { home: 'Home', agenda: 'Schedule', fitness: 'Training', chats: 'Messages', profile: 'Profile' },
  badge_one: '{{label}}, {{count}} new message',
  badge_other: '{{label}}, {{count}} new messages',
  badgeDot: '{{label}}, new messages',
};

export default nav;
