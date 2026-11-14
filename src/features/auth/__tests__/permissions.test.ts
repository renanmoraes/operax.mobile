import { hasPermission } from '../permissions';

describe('hasPermission', () => {
  it('sem permissão exigida, libera pra todo staff', () => {
    expect(hasPermission([], undefined)).toBe(true);
    expect(hasPermission(undefined, undefined)).toBe(true);
  });

  it('bloqueia quando falta a permissão exigida', () => {
    expect(hasPermission(['conversations:read_own'], 'kanban:manage')).toBe(false);
  });

  it('libera quando a permissão exigida está na lista', () => {
    expect(hasPermission(['conversations:read_own', 'kanban:manage'], 'kanban:manage')).toBe(
      true,
    );
  });
});
