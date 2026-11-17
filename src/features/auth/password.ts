/**
 * Regras da senha do cliente, as mesmas do servidor (`passwordProblem` do portal): pelo menos 8
 * caracteres, no máximo 72, com letra e número. Devolve a chave do texto do que falta, ou `null`.
 * O servidor confere de novo (e recusa senha igual ao e-mail ou ao nome); a mensagem dele vale.
 */
export type PasswordRuleKey = 'password.ruleLength' | 'password.ruleLetter' | 'password.ruleNumber';

export function passwordProblemKey(password: string): PasswordRuleKey | null {
  if (password.length < 8) return 'password.ruleLength';
  if (password.length > 72) return 'password.ruleLength';
  if (!/[A-Za-z]/.test(password)) return 'password.ruleLetter';
  if (!/\d/.test(password)) return 'password.ruleNumber';
  return null;
}

/** De quanto em quanto tempo o aviso "Crie uma senha" volta depois de um "Agora não". */
export const PASSWORD_PROMPT_EVERY_MS = 7 * 24 * 3_600_000;

/** O aviso aparece? Só para quem tem identidade, ainda sem senha, e não disse "Agora não" há pouco. */
export function shouldPromptPassword(
  account: { hasIdentity: boolean; hasPassword: boolean } | undefined,
  lastDismissedAt: number | null,
  now = Date.now(),
): boolean {
  if (!account?.hasIdentity || account.hasPassword) return false;
  return lastDismissedAt == null || now - lastDismissedAt >= PASSWORD_PROMPT_EVERY_MS;
}
