import { toPermissionState } from '../permissionState';

describe('toPermissionState', () => {
  it('granted quando o sistema concedeu', () => {
    expect(toPermissionState({ status: 'granted', granted: true, canAskAgain: true })).toBe('granted');
  });

  it('undetermined quando ainda não perguntou', () => {
    expect(toPermissionState({ status: 'undetermined', granted: false, canAskAgain: true })).toBe('undetermined');
  });

  it('denied quando negou mas ainda dá para perguntar de novo', () => {
    expect(toPermissionState({ status: 'denied', granted: false, canAskAgain: true })).toBe('denied');
  });

  it('blocked quando negou e só dá para mudar nos ajustes do sistema', () => {
    expect(toPermissionState({ status: 'denied', granted: false, canAskAgain: false })).toBe('blocked');
  });

  it('granted mesmo com acesso limitado (fotos selecionadas no iOS)', () => {
    expect(toPermissionState({ status: 'granted', granted: true, canAskAgain: true, accessPrivileges: 'limited' })).toBe('granted');
  });
});
