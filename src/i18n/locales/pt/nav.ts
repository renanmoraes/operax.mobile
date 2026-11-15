/** Textos em português (base). As chaves valem para todos os idiomas. */
const nav = {
  staff: { inbox: 'Atendimento', agenda: 'Agenda', notifications: 'Avisos', more: 'Mais', kanban: 'Kanban', profile: 'Perfil', history: 'Histórico' },
  client: { home: 'Início', agenda: 'Agenda', fitness: 'Treino', chats: 'Conversas', profile: 'Perfil' },
  badge_one: '{{label}}, {{count}} mensagem nova',
  badge_other: '{{label}}, {{count}} mensagens novas',
  badgeDot: '{{label}}, novas mensagens',
} as const;

export default nav;
