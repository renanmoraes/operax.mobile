import type { Shape } from '../../shape';
import type pt from '../pt/common';

const common: Shape<typeof pt> = {
  actions: {
    back: 'Volver',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    close: 'Cerrar',
    cancel: 'Cancelar',
    save: 'Guardar',
    confirm: 'Confirmar',
    retry: 'Intentar de nuevo',
    continue: 'Continuar',
    done: 'Listo',
    understood: 'Entendido',
    delete: 'Eliminar',
    edit: 'Editar',
    send: 'Enviar',
    search: 'Buscar',
    seeAll: 'Ver todo',
    openSettings: 'Abrir ajustes del teléfono',
  },
  states: {
    loading: 'Cargando',
    offline: 'Sin conexión en este momento. Revisa tu internet e inténtalo de nuevo.',
    genericError: 'Algo salió mal. Inténtalo de nuevo en unos instantes.',
    noResults: 'No se encontró nada',
  },
  time: {
    now: 'ahora',
    minutesAgo: 'hace {{count}} min',
    hoursAgo: 'hace {{count}} h',
    yesterday: 'ayer',
    daysAgo: 'hace {{count}} días',
    inMinutes: 'en {{count}} min',
    inHoursMinutes: 'en {{h}} h {{m}}',
  },
  errorBoundary: {
    title: 'Algo salió mal en esta pantalla',
    body: 'Ya avisamos al equipo de Operax con los detalles para corregirlo. Inténtalo de nuevo.',
  },
  errors: {
    agendaLocked: 'La agenda no está incluida en el plan de esta empresa.',
    agendaLoad: 'No se pudo cargar la agenda.',
  },
  offline: {
    title: 'Estás sin internet',
    body: 'Esta pantalla necesita conexión. Revisa el Wi-Fi o los datos móviles: carga sola cuando vuelva internet.',
    retry: 'Intentar de nuevo',
    banner: 'Sin internet',
    bannerHint: 'Ves lo que ya cargó. Lo demás vuelve con la conexión.',
    back: 'Conexión de vuelta',
    serverTitle: 'No se pudo cargar',
    serverBody: 'Algo falló de nuestro lado. Inténtalo de nuevo en unos instantes.',
  },
  greeting: {
    morning: 'Buenos días',
    afternoon: 'Buenas tardes',
    evening: 'Buenas noches',
  },
  ui: {
    openQueue: 'Abrir cola',
    openQueueCount: 'Abrir cola, {{count}} en espera',
  },
  update: {
    ready: 'Nueva versión de Operax lista',
    apply: 'Actualizar',
  },
  pushChannels: {
    fila: 'Conversación nueva en la cola',
    assumido: 'Mensaje en chat asumido',
    alerta: 'Chat enfriándose o perdido',
  },
};

export default common;
