import { maskPhone } from '@/src/features/pos/signup';

/**
 * Campo "E-mail ou celular": enquanto só tem número, mostra com a máscara de celular,
 * "(31) 99563-7020". Com letra ou "@" é e-mail e fica do jeito que a pessoa digitou.
 */
export function maskIdentifier(raw: string): string {
  if (!/^[\d\s()+-]*$/.test(raw)) return raw;
  return /\d/.test(raw) ? maskPhone(raw) : raw;
}
