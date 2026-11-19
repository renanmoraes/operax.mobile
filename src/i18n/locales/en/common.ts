import type { Shape } from '../../shape';
import type pt from '../pt/common';

const common: Shape<typeof pt> = {
  actions: {
    back: 'Back',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
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
  offline: {
    title: "You're offline",
    body: 'This screen needs a connection. Check your Wi-Fi or mobile data: it loads by itself when the internet is back.',
    retry: 'Try again',
    banner: 'No internet',
    bannerHint: "You're seeing what already loaded. The rest returns with the connection.",
    back: 'Back online',
    serverTitle: "Couldn't load",
    serverBody: 'Something failed on our side. Try again in a moment.',
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
  pushChannels: {
    fila: 'New conversation in queue',
    assumido: 'Message in a claimed chat',
    alerta: 'Chat cooling down or lost',
  },
};

export default common;
