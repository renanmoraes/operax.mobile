import i18n, { setVocabulary } from '@/src/i18n';
import { pluralPt, varsFor } from '../vocabulary';

afterEach(() => setVocabulary({}));

describe('vocabulário da empresa', () => {
  it('sem troca, o app usa o padrão do web em português', () => {
    expect(varsFor('pt')).toMatchObject({ contact: 'contato', contacts: 'contatos', Contacts: 'Contatos', bookingCreate: 'Novo agendamento', agenda: 'Agenda' });
    expect(i18n.t('inbox:patients.title')).toBe('Contatos');
    expect(i18n.t('inbox:patients.searchLabel')).toBe('Buscar contato');
  });

  it('um app de terminologia troca as palavras em todos os textos', () => {
    setVocabulary({ 'entity.contact': 'paciente', 'ui.page.contacts.title': 'Pacientes', 'ui.field.client': 'Paciente', 'ui.action.booking.create': 'Nova consulta' });
    expect(i18n.t('inbox:patients.title')).toBe('Pacientes');
    expect(i18n.t('inbox:patients.searchLabel')).toBe('Buscar paciente');
    expect(i18n.t('inbox:patients.noneYet')).toBe('Nenhum paciente ainda');
    expect(i18n.t('team:mention.itemContact', { name: 'Ana' })).toBe('Citar paciente Ana');
    expect(i18n.t('agenda:newBooking.title')).toBe('Nova consulta');
    expect(i18n.t('agenda:newBooking.patient')).toBe('Paciente');
  });

  it('trocou só o singular: o plural acompanha', () => {
    setVocabulary({ 'entity.contact': 'aluno' });
    expect(varsFor('pt', { 'entity.contact': 'aluno' })).toMatchObject({ contacts: 'alunos', Contacts: 'Alunos' });
    expect(i18n.t('inbox:patients.companyContacts')).toBe('Os alunos da empresa aparecem aqui.');
  });

  it('voltar ao padrão desfaz a troca', () => {
    setVocabulary({ 'entity.contact': 'paciente' });
    setVocabulary({});
    expect(i18n.t('inbox:patients.searchLabel')).toBe('Buscar contato');
  });

  it('a palavra da empresa é em português: inglês e espanhol seguem o padrão do idioma', () => {
    expect(varsFor('en', { 'entity.contact': 'paciente' })).toMatchObject({ contact: 'contact', Contacts: 'Contacts' });
    expect(varsFor('es', { 'entity.contact': 'paciente' }).contacts).toBe('contactos');
  });

  it('plural em português', () => {
    expect(pluralPt('paciente')).toBe('pacientes');
    expect(pluralPt('cliente')).toBe('clientes');
    expect(pluralPt('aluno')).toBe('alunos');
    expect(pluralPt('cidadão')).toBe('cidadões');
    expect(pluralPt('hóspede')).toBe('hóspedes');
    expect(pluralPt('mulher')).toBe('mulheres');
    expect(pluralPt('animal')).toBe('animais');
    expect(pluralPt('homem')).toBe('homens');
  });
});
