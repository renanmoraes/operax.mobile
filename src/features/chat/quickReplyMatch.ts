/**
 * Atalho "/" das respostas rápidas, com as mesmas regras do Operax web
 * (`operax-frontend/src/shared/lib/quick-reply.ts` e `InboxPage.handleBodyChange`).
 */

export type QuickReplyLike = { id: string; slug: string; title: string; body: string };
export type QuickReplyContact = { name?: string | null; phone?: string | null; company?: string | null };

const SLASH_AT_END = /(?:^|\n)(\/([a-z0-9_]*))$/i;

/** Termo depois da "/" no fim do texto (no começo ou depois de quebra de linha); `null` se não há atalho. */
export function slashTerm(text: string): string | null {
  const m = text.match(SLASH_AT_END);
  return m ? m[2].toLowerCase() : null;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Atalhos que começam com o termo primeiro; depois os que têm o termo no atalho ou no título. */
export function filterQuickReplies<T extends QuickReplyLike>(list: T[], term: string, limit = 10): T[] {
  const t = fold(term);
  if (!t) return list.slice(0, limit);
  const starts = list.filter((q) => fold(q.slug).startsWith(t));
  const contains = list.filter((q) => !starts.includes(q) && (fold(q.slug).includes(t) || fold(q.title).includes(t)));
  return [...starts, ...contains].slice(0, limit);
}

export function resolveQuickReplyVariables(body: string, contact: QuickReplyContact, agentName: string): string {
  return body
    .replace(/\{\{contact\.name\}\}/g, contact.name ?? '')
    .replace(/\{\{contact\.phone\}\}/g, contact.phone ?? '')
    .replace(/\{\{contact\.company\}\}/g, contact.company ?? '')
    .replace(/\{\{agent\.name\}\}/g, agentName);
}

/** Troca o "/termo" do fim do texto pelo conteúdo da resposta rápida. */
export function applyQuickReply(text: string, body: string): string {
  return text.replace(/\/[a-z0-9_]*$/i, body);
}
