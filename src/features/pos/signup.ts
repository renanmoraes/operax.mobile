/** Validações e máscaras do cadastro rápido de cliente na venda (puras, com teste). */

export const digits = (s: string) => s.replace(/\D/g, '');

export function cpfValid(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function maskCpf(raw: string): string {
  const d = digits(raw).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** "(11) 98765-4321"; com DDI diferente de 55 deixa só os dígitos com "+". */
export function maskPhone(raw: string): string {
  let d = digits(raw);
  if (raw.trim().startsWith('+') && !d.startsWith('55')) return `+${d.slice(0, 15)}`;
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone para o servidor, com DDI: 10 ou 11 dígitos viram "55…". Nulo se não é um telefone. */
export function phoneForServer(raw: string): string | null {
  const d = digits(raw);
  if (raw.trim().startsWith('+') && !d.startsWith('55')) return d.length >= 8 && d.length <= 15 ? d : null;
  const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (local.length !== 10 && local.length !== 11) return null;
  return `55${local}`;
}

export function maskDate(raw: string): string {
  const d = digits(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "31/12/1990" → "1990-12-31"; nulo se a data não existe ou está no futuro. */
export function birthToIso(raw: string, now = new Date()): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  if (d > now || Number(yyyy) < 1900) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function maskZip(raw: string): string {
  const d = digits(raw).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const emailValid = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
