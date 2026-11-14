import { firstStaffTab, hasPermission, PERMS } from '../permissions';

describe('hasPermission', () => {
  it('sem permissão exigida, libera pra todo staff', () => {
    expect(hasPermission([], undefined)).toBe(true);
    expect(hasPermission(undefined, undefined)).toBe(true);
  });

  it('bloqueia quando falta a permissão exigida', () => {
    expect(hasPermission(['conversations:read_own'], 'kanban:manage')).toBe(false);
    expect(hasPermission(undefined, 'kanban:read')).toBe(false);
  });

  it('libera quando a permissão exigida está na lista', () => {
    expect(hasPermission(['conversations:read_own', 'kanban:manage'], 'kanban:manage')).toBe(true);
  });

  it('com várias opções, basta uma (ver as próprias ou todas as conversas)', () => {
    expect(hasPermission(['conversations:read_all'], PERMS.inbox)).toBe(true);
    expect(hasPermission(['chat:read'], PERMS.inbox)).toBe(false);
  });

  it('o curinga do super admin libera tudo', () => {
    expect(hasPermission(['*'], 'qualquer:coisa')).toBe(true);
  });

  it('abre na primeira aba permitida', () => {
    expect(firstStaffTab(['conversations:read_own'])).toBe('/(app)/inbox');
    expect(firstStaffTab(['scheduling:read_own'])).toBe('/(app)/agenda');
    expect(firstStaffTab([])).toBe('/(app)/notifications');
  });
});
