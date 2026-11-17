import type { Shape } from '../../shape';
import type pt from '../pt/settings';

const settings: Shape<typeof pt> = {
  language: {
    title: 'Language',
    subtitle: 'App language on this phone',
    choose: 'Choose a language',
    staffNote: 'This also changes the language of your Operax profile.',
  },
  profile: {
    title: 'Profile',
    user: 'User',
    online: 'Online',
    demo: 'Demo',
    pushTitle: 'Notifications on this device',
    pushBody: 'We\'ll let you know when someone joins the queue, when you\'re mentioned and when an appointment changes.',
    pushOn: 'On',
    pushAppOnly: 'Available in the phone app',
    pushEnable: 'Turn on notifications',
    notifPrivacy: 'Notifications and privacy',
    notifPrivacySub: 'Alerts, camera, photos and microphone',
    quickReplies: 'Quick replies',
    templates: 'Meta templates',
    accounts: 'Accounts',
    logout: 'Sign out of this account',
  },
  updateTag: ' · update {{id}}',
  version: 'Version {{version}}',
};

export default settings;
