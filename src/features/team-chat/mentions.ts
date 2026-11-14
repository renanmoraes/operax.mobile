/**
 * Marcações no chat da equipe, com as mesmas regras do Operax web (TeamChatPage):
 * "@" marca alguém da equipe (o backend notifica) e "#" marca um paciente/cliente.
 */

export type Picker = { kind: 'none' } | { kind: 'user' | 'contact'; query: string; start: number };
export type MentionUser = { id: string; name: string; email?: string };
export type ContactRef = { contact_id: string; label: string };

/** O que está sendo digitado no fim do texto: "@ju" busca equipe, "#mar" busca paciente. */
export function detectPicker(text: string): Picker {
  const at = text.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u);
  const hash = text.match(/(?:^|\s)#([\p{L}\p{N}_.-]*)$/u);
  const atPos = text.lastIndexOf('@');
  const hashPos = text.lastIndexOf('#');
  if (hash && (!at || hashPos > atPos)) return { kind: 'contact', query: hash[1], start: hashPos };
  if (at) return { kind: 'user', query: at[1], start: atPos };
  return { kind: 'none' };
}

/** Nome sem acento e sem espaço, como o web grava: "Maria Silva" → "MariaSilva". */
export function compactName(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '');
}

/** Troca o "@ju"/"#mar" do fim pelo nome escolhido, com espaço depois. */
export function applyPick(text: string, picker: Picker, name: string): string {
  if (picker.kind === 'none') return text;
  const sign = picker.kind === 'user' ? '@' : '#';
  return `${text.slice(0, picker.start)}${sign}${compactName(name)} `;
}

/** Só vai no envio quem continua escrito no texto (a pessoa pode ter apagado a marcação). */
export function mentionsInBody(body: string, users: MentionUser[], refs: ContactRef[]) {
  const mentions = users.filter((u) => body.includes(`@${compactName(u.name)}`)).map((u) => u.id);
  const contact_refs = refs.filter((r) => r.label && body.includes(`#${r.label}`));
  return { mentions: [...new Set(mentions)], contact_refs };
}

/** Partes do texto para desenhar marcações em destaque dentro do balão. */
export function splitMentions(body: string): { text: string; kind: 'plain' | 'user' | 'contact' }[] {
  const out: { text: string; kind: 'plain' | 'user' | 'contact' }[] = [];
  const re = /(^|\s)([@#])([\p{L}\p{N}_.-]+)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ text: body.slice(last, start), kind: 'plain' });
    out.push({ text: `${m[2]}${m[3]}`, kind: m[2] === '@' ? 'user' : 'contact' });
    last = start + 1 + m[3].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), kind: 'plain' });
  return out;
}
