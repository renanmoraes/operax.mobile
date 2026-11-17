import { maskPhone } from '@/src/features/pos/signup';

/**
 * Campo "E-mail ou celular": enquanto só tem número, mostra com a máscara de celular,
 * "(31) 99563-7020". Com letra ou "@" é e-mail: sempre em minúsculas e sem espaço, que é como
 * o sistema guarda (o teclado do celular costuma pôr a primeira letra em maiúscula).
 */
export function maskIdentifier(raw: string): string {
  if (!isPhoneLike(raw)) return raw.toLowerCase().replace(/\s/g, '');
  return maskPhone(raw);
}

/** Só número (com a máscara de celular): o campo mostra o ícone de telefone em vez do de e-mail. */
export function isPhoneLike(raw: string): boolean {
  return /\d/.test(raw) && /^[\d\s()+-]*$/.test(raw);
}
