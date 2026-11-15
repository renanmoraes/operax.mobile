import type { Shape } from '../../shape';
import type pt from '../pt/nav';

const nav: Shape<typeof pt> = {
  staff: { inbox: 'Inbox', agenda: 'Schedule', notifications: 'Alerts', more: 'More', kanban: 'Kanban', profile: 'Profile', history: 'History' },
  client: { home: 'Home', agenda: 'Schedule', fitness: 'Training', chats: 'Messages', profile: 'Profile' },
  badge_one: '{{label}}, {{count}} new message',
  badge_other: '{{label}}, {{count}} new messages',
  badgeDot: '{{label}}, new messages',
};

export default nav;
