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

/**
 * Chave de armazenamento de um dono (o atual, se não for dito); `null` sem conta (não grava nem lê).
 * Só letras, números, `.`, `-` e `_`: é o que o armazenamento seguro do celular aceita como chave.
 */
export function ownedKey(base: string, who: string = owner): string | null {
  return who ? `${base}.${who.replace(/[^A-Za-z0-9._-]/g, '_')}` : null;
}
