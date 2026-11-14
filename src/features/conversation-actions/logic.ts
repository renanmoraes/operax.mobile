import type { PixKeyType, SavedPixKey, SchedProvider, SchedService, SchedSlot } from '@/src/shared/api/conversation-actions.api';

const digits = (s: string) => s.replace(/\D/g, '');

/** Celular só com DDD + número: tira o 55 do país apenas quando ele veio junto (+55 ou 12–13 dígitos). */
function domesticPhone(key: string): string {
  const d = digits(key);
  const hasCountry = key.trim().startsWith('+') || d.length === 12 || d.length === 13;
  return hasCountry && d.startsWith('55') ? d.slice(2) : d;
}

/** Mesmas regras básicas do formulário do Operax web; `null` quando está certo. */
export function pixKeyError(type: PixKeyType, key: string): string | null {
  const k = key.trim();
  if (!k) return 'Informe a chave';
  switch (type) {
    case 'cpf':
      return digits(k).length === 11 ? null : 'CPF tem 11 números';
    case 'cnpj':
      return digits(k).length === 14 ? null : 'CNPJ tem 14 números';
    case 'phone': {
      const n = domesticPhone(k);
      return n.length === 10 || n.length === 11 ? null : 'Celular com DDD';
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k) ? null : 'E-mail inválido';
    case 'random':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k) ? null : 'Chave aleatória tem 32 letras e números';
    case 'copy_paste':
      return k.length >= 30 ? null : 'Cole o código Pix completo';
  }
}

/** Mostra a chave de um jeito legível na prévia e no cartão. */
export function formatPixKey(type: PixKeyType, key: string): string {
  const d = digits(key);
  if (type === 'cpf' && d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (type === 'cnpj' && d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (type === 'phone') {
    const n = domesticPhone(key);
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  if (type === 'copy_paste' && key.length > 42) return `${key.slice(0, 38)}…`;
  return key.trim();
}

/** Próximos `n` dias a partir de hoje (meia-noite local). */
export function nextDays(n: number, from = new Date()): Date[] {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Array.from({ length: n }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
}

export function dayLabel(d: Date, today = new Date()): { top: string; day: string } {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((d.getTime() - t0) / 86_400_000);
  const top = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return { top: top.charAt(0).toUpperCase() + top.slice(1), day: String(d.getDate()) };
}

/** Janela [00:00, 24:00) do dia, em ISO, para buscar horários livres. */
export function dayRange(d: Date): { from: string; to: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Só horários que ainda não passaram (com 15 min de folga), em ordem. */
export function upcomingSlots(slots: SchedSlot[], now = new Date()): SchedSlot[] {
  const limit = now.getTime() + 15 * 60_000;
  return slots.filter((s) => new Date(s.starts_at).getTime() >= limit).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function servicesFor(provider: SchedProvider | undefined, services: SchedService[]): SchedService[] {
  const active = services.filter((s) => s.is_active !== false && !s.internal_only);
  if (!provider?.service_ids?.length) return active;
  return active.filter((s) => provider.service_ids!.includes(s.id));
}

// ---------- modo demo ----------

export const DEMO_PROVIDERS: SchedProvider[] = [
  { id: 'p-ricardo', name: 'Dr. Ricardo Alves', service_ids: ['s-consulta', 's-retorno', 's-avaliacao'] },
  { id: 'p-ana', name: 'Ana Ribeiro', service_ids: ['s-avaliacao', 's-funcional'] },
];

export const DEMO_SERVICES: SchedService[] = [
  { id: 's-consulta', name: 'Consulta', default_duration_min: 50 },
  { id: 's-retorno', name: 'Retorno', default_duration_min: 30 },
  { id: 's-avaliacao', name: 'Avaliação física', default_duration_min: 45 },
  { id: 's-funcional', name: 'Funcional individual', default_duration_min: 60 },
];

export const DEMO_PIX_KEYS: SavedPixKey[] = [
  { id: 'k1', key: '12345678000199', key_type: 'cnpj', holder_name: 'Clínica Exemplo Ltda', use_count: 12 },
  { id: 'k2', key: 'financeiro@clinica.exemplo', key_type: 'email', holder_name: 'Clínica Exemplo Ltda', use_count: 3 },
];

/** Horários de 8h às 18h do tamanho do serviço, com alguns já ocupados (sempre os mesmos por dia). */
export function demoSlots(day: Date, providerId: string, durationMin: number): SchedSlot[] {
  const out: SchedSlot[] = [];
  const seed = day.getDate() + providerId.length;
  let i = 0;
  for (let min = 8 * 60; min + durationMin <= 18 * 60; min += Math.max(30, durationMin), i++) {
    if ((i + seed) % 4 === 0 || min === 12 * 60) continue;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(min / 60), min % 60);
    out.push({ provider_id: providerId, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + durationMin * 60_000).toISOString() });
  }
  return out;
}
