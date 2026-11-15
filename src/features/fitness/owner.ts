/**
 * Dono dos dados de treino guardados no aparelho (fila offline, rascunhos): a conta e a empresa ativas.
 * Tudo que fica no armazenamento local leva este dono na chave, para o treino de uma pessoa nunca ser
 * enviado nem aparecer na conta de outra que entrar depois no mesmo celular. Vazio: ninguém logado,
 * e nada é lido nem gravado.
 */
let owner = '';
/** Trocas de conta/empresa em andamento: enquanto houver uma, não há dono (nada é lido, gravado nem enviado). */
let suspended = 0;

export function setFitnessOwner(key: string) {
  owner = key;
}

export function fitnessOwner(): string {
  return suspended ? '' : owner;
}

/**
 * Troca de conta ou de empresa: o token muda antes de a conta nova virar dono. Nesse intervalo um reenvio
 * da fila sairia com os treinos da conta antiga e o token da nova. Chamar antes de trocar o token; a
 * função devolvida solta (uma vez só) depois que a conta nova foi instalada.
 */
export function suspendFitnessOwner(): () => void {
  suspended += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suspended -= 1;
  };
}

/**
 * Chave de armazenamento de um dono (o atual, se não for dito); `null` sem conta (não grava nem lê).
 * Só letras, números, `.`, `-` e `_`: é o que o armazenamento seguro do celular aceita como chave.
 */
export function ownedKey(base: string, who: string = fitnessOwner()): string | null {
  return who ? `${base}.${who.replace(/[^A-Za-z0-9._-]/g, '_')}` : null;
}
