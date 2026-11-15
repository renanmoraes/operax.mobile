/**
 * Conversa paginada: `older` são as páginas antigas que a pessoa pediu; `latest` é a janela das
 * mensagens mais novas, que é atualizada a cada poucos segundos.
 */
type WithId = { id: string };

/** Versão mais nova de cada mensagem vem da janela atual; o resto vem do histórico guardado. */
export function mergeThread<T extends WithId>(older: T[], latest: T[]): T[] {
  const ids = new Set(latest.map((m) => m.id));
  return [...older.filter((o) => !ids.has(o.id)), ...latest];
}

/**
 * Com histórico carregado, guarda também a janela atual: quando chega mensagem nova, a mais antiga
 * da janela sai dela, mas continua na conversa (senão abriria um buraco que o "carregar anteriores"
 * não recupera, porque ele pede a partir da primeira mensagem da tela).
 */
export function retainWindow<T extends WithId>(older: T[], latest: T[]): T[] {
  if (older.length === 0) return older;
  const byId = new Map(latest.map((m) => [m.id, m]));
  // Mensagem já guardada que veio de novo na janela: fica a versão mais nova (edição, apagada), na mesma posição.
  let changed = false;
  const updated = older.map((o) => {
    const n = byId.get(o.id);
    if (n && n !== o) {
      changed = true;
      return n;
    }
    return o;
  });
  const ids = new Set(older.map((m) => m.id));
  const fresh = latest.filter((m) => !ids.has(m.id));
  if (!changed && !fresh.length) return older;
  return [...updated, ...fresh];
}
