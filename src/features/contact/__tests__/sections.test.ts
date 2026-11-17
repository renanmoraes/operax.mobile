import { isSectionId, visibleSections } from '../sections';

const ids = (ctx: Parameters<typeof visibleSections>[0]) => visibleSections(ctx).map((s) => s.id);

describe('seções do contato', () => {
  it('quem só lê contatos vê o cadastro, sem nada de app', () => {
    expect(ids({ permissions: ['contacts:read'], apps: [], crediario: true })).toEqual(['profile', 'dependents', 'documents', 'tag_history']);
  });

  it('crediário pede o app do PDV, a permissão e a empresa vender a prazo', () => {
    const base = { permissions: ['contacts:read', 'pos:receivables_read'] };
    expect(ids({ ...base, apps: ['pos'], crediario: true })).toContain('crediario');
    expect(ids({ ...base, apps: [], crediario: true })).not.toContain('crediario');
    expect(ids({ ...base, apps: ['pos'], crediario: false })).not.toContain('crediario');
    expect(ids({ permissions: ['contacts:read'], apps: ['pos'], crediario: true })).not.toContain('crediario');
  });

  it('agendamentos vale com ler os próprios ou todos, e só com o app da agenda', () => {
    expect(ids({ permissions: ['scheduling:read_own'], apps: ['agenda'], crediario: false })).toEqual(['agendamentos']);
    expect(ids({ permissions: ['scheduling:read_own'], apps: [], crediario: false })).toEqual([]);
  });

  it('curinga vê tudo o que os apps instalados liberam', () => {
    expect(ids({ permissions: ['*'], apps: ['pos', 'agenda'], crediario: true })).toHaveLength(9);
  });

  it('conhece os ids para rota', () => {
    expect(isSectionId('crediario')).toBe(true);
    expect(isSectionId('x')).toBe(false);
  });
});
