/** Textos em português (base). As chaves valem para todos os idiomas. */
const common = {
  actions: {
    back: 'Voltar',
    showPassword: 'Mostrar senha',
    hidePassword: 'Ocultar senha',
    close: 'Fechar',
    cancel: 'Cancelar',
    save: 'Salvar',
    confirm: 'Confirmar',
    retry: 'Tentar de novo',
    continue: 'Continuar',
    done: 'Concluir',
    understood: 'Entendi',
    delete: 'Excluir',
    edit: 'Editar',
    send: 'Enviar',
    search: 'Buscar',
    seeAll: 'Ver tudo',
    openSettings: 'Abrir ajustes do celular',
  },
  states: {
    loading: 'Carregando',
    offline: 'Sem conexão agora. Confira a internet e tente de novo.',
    genericError: 'Algo deu errado. Tente de novo em instantes.',
    noResults: 'Nada encontrado',
  },
  time: {
    now: 'agora',
    minutesAgo: 'há {{count}} min',
    hoursAgo: 'há {{count}} h',
    yesterday: 'ontem',
    daysAgo: 'há {{count}} dias',
    inMinutes: 'em {{count}} min',
    inHoursMinutes: 'em {{h}}h {{m}}',
  },
  errorBoundary: {
    title: 'Algo deu errado nesta tela',
    body: 'Já avisamos a equipe Operax com os detalhes para corrigir. Tente de novo.',
  },
  errors: {
    agendaLocked: 'A agenda não está incluída no plano desta empresa.',
    agendaLoad: 'Não foi possível carregar a agenda.',
  },
  greeting: {
    morning: 'Bom dia',
    afternoon: 'Boa tarde',
    evening: 'Boa noite',
  },
  ui: {
    openQueue: 'Abrir fila',
    openQueueCount: 'Abrir fila, {{count}} na fila',
  },
  update: {
    ready: 'Nova versão do Operax pronta',
    apply: 'Atualizar',
  },
} as const;

export default common;
