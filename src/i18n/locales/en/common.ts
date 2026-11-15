import type { Shape } from '../../shape';
import type pt from '../pt/common';

const common: Shape<typeof pt> = {
  actions: {
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    confirm: 'Confirm',
    retry: 'Try again',
    continue: 'Continue',
    done: 'Done',
    understood: 'Got it',
    delete: 'Delete',
    edit: 'Edit',
    send: 'Send',
    search: 'Search',
    seeAll: 'See all',
    openSettings: 'Open phone settings',
  },
  states: {
    loading: 'Loading',
    offline: "You're offline right now. Check your connection and try again.",
    genericError: 'Something went wrong. Please try again in a moment.',
    noResults: 'Nothing found',
  },
  time: {
    now: 'now',
    minutesAgo: '{{count}} min ago',
    hoursAgo: '{{count}} h ago',
    yesterday: 'yesterday',
    daysAgo: '{{count}} days ago',
    inMinutes: 'in {{count}} min',
    inHoursMinutes: 'in {{h}}h {{m}}',
  },
  errorBoundary: {
    title: 'Something went wrong on this screen',
    body: "We've already sent the details to the Operax team so they can fix it. Please try again.",
  },
  errors: {
    agendaLocked: 'The schedule isn\'t included in this company\'s plan.',
    agendaLoad: "Couldn't load the schedule.",
  },
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  },
  ui: {
    openQueue: 'Open queue',
    openQueueCount: 'Open queue, {{count}} waiting',
  },
  update: {
    ready: 'A new version of Operax is ready',
    apply: 'Update',
  },
};

export default common;
