import type { Shape } from '../../shape';
import type pt from '../pt/settings';

const settings: Shape<typeof pt> = {
  language: {
    title: 'Idioma',
    subtitle: 'Idioma de la app en este teléfono',
    choose: 'Elige el idioma',
    staffNote: 'También cambia el idioma de tu perfil en Operax.',
  },
  profile: {
    title: 'Perfil',
    user: 'Usuario',
    online: 'En línea',
    demo: 'Demo',
    pushTitle: 'Notificaciones en este dispositivo',
    pushBody: 'Te avisamos cuando alguien entra en la cola, cuando te mencionan y cuando cambia un horario.',
    pushOn: 'Activadas',
    pushAppOnly: 'Disponible en la app del teléfono',
    pushEnable: 'Activar notificaciones',
    notifPrivacy: 'Notificaciones y privacidad',
    notifPrivacySub: 'Avisos, cámara, fotos y micrófono',
    quickReplies: 'Respuestas rápidas',
    templates: 'Plantillas de Meta',
    accounts: 'Cuentas',
    logout: 'Cerrar sesión en esta cuenta',
  },
  updateTag: ' · actualización {{id}}',
  version: 'Versión {{version}}',
};

export default settings;
