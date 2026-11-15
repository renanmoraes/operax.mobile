/** Textos em português (base). As chaves valem para todos os idiomas. */
const settings = {
  language: {
    title: 'Idioma',
    subtitle: 'Idioma do app neste celular',
    choose: 'Escolha o idioma',
    staffNote: 'Também muda o idioma do seu perfil no Operax.',
  },
  profile: {
    title: 'Perfil',
    user: 'Usuário',
    online: 'Online',
    demo: 'Demo',
    pushTitle: 'Notificações neste aparelho',
    pushBody: 'Avisamos quando alguém entra na fila, quando te mencionam e quando um horário muda.',
    pushOn: 'Ativadas',
    pushAppOnly: 'Disponível no app do celular',
    pushEnable: 'Ativar notificações',
    permissions: 'Permissões do aparelho',
    permissionsSub: 'Notificações, câmera, fotos e microfone',
    notifPrefs: 'Preferências de notificação',
    quickReplies: 'Respostas rápidas',
    templates: 'Templates Meta',
    accounts: 'Contas',
    logout: 'Sair desta conta',
  },
  updateTag: ' · atualização {{id}}',
  version: 'Versão {{version}}',
} as const;

export default settings;
