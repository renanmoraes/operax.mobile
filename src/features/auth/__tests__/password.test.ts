import { PASSWORD_PROMPT_EVERY_MS, passwordProblemKey, shouldPromptPassword } from '../password';

describe('passwordProblemKey', () => {
  it('pede 8 caracteres, letra e número, como o servidor', () => {
    expect(passwordProblemKey('abc12')).toBe('password.ruleLength');
    expect(passwordProblemKey('12345678')).toBe('password.ruleLetter');
    expect(passwordProblemKey('abcdefgh')).toBe('password.ruleNumber');
    expect(passwordProblemKey('a'.repeat(72) + '1')).toBe('password.ruleLength');
    expect(passwordProblemKey('treino2026')).toBeNull();
  });
});

describe('shouldPromptPassword', () => {
  const now = 1_800_000_000_000;
  it('só para quem tem identidade e ainda não tem senha', () => {
    expect(shouldPromptPassword({ hasIdentity: true, hasPassword: false }, null, now)).toBe(true);
    expect(shouldPromptPassword({ hasIdentity: true, hasPassword: true }, null, now)).toBe(false);
    expect(shouldPromptPassword({ hasIdentity: false, hasPassword: false }, null, now)).toBe(false);
    expect(shouldPromptPassword(undefined, null, now)).toBe(false);
  });

  it('depois de um "Agora não", volta só passados 7 dias', () => {
    const acc = { hasIdentity: true, hasPassword: false };
    expect(shouldPromptPassword(acc, now - 1000, now)).toBe(false);
    expect(shouldPromptPassword(acc, now - PASSWORD_PROMPT_EVERY_MS, now)).toBe(true);
  });
});
