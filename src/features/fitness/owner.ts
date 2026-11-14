/**
 * Dono dos dados de treino guardados no aparelho (fila offline, rascunhos): a conta e a empresa ativas.
 * Tudo que fica no armazenamento local leva este dono na chave, para o treino de uma pessoa nunca ser
 * enviado nem aparecer na conta de outra que entrar depois no mesmo celular. Vazio: ninguém logado,
 * e nada é lido nem gravado.
 */
let owner = '';

export function setFitnessOwner(key: string) {
  owner = key;
}

export function fitnessOwner(): string {
  return owner;
}

/** Chave de armazenamento do dono atual; `null` sem conta (não grava nem lê). */
export function ownedKey(base: string): string | null {
  return owner ? `${base}:${owner}` : null;
}
