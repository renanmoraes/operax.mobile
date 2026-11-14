/**
 * Fonte dos dados do cliente: 'live' busca no portal real, 'mock' usa o demo em memória.
 * O AuthContext atualiza ao entrar, sair ou trocar de conta; as funções de dados leem daqui.
 */
let current: 'live' | 'mock' = 'mock';

export function setClientDataMode(mode: 'live' | 'mock') {
  current = mode;
}

export function clientDataMode(): 'live' | 'mock' {
  return current;
}
