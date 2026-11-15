import { Platform } from 'react-native';
import i18n, { locale } from '@/src/i18n';
import type { ClientBooking } from '@/src/features/client/types';
import { getItem, setItem } from '@/src/shared/storage';
import { kvGet, kvSet } from '@/src/shared/db/localDb';

/**
 * Lembretes de agenda e aula do cliente, agendados NO APARELHO (notificação local).
 * Disparam com o app fechado ou em segundo plano — não dependem de servidor nem de internet na hora.
 * A cada atualização da agenda o conjunto é refeito: horário cancelado perde o lembrete,
 * horário novo ganha os seus.
 */

export const REMINDER_CHANNEL = 'operax-reminders';
const PREFIX = 'reminder:';
const KNOWN_KEY = 'operax_known_bookings';
const KNOWN_MAX = 1000;

/** Horários já vistos. Instalações antigas guardavam no armazenamento seguro: lê de lá uma vez. */
async function loadKnown(): Promise<string[] | null> {
  const cur = await kvGet<string[]>(KNOWN_KEY);
  if (cur) return cur;
  try {
    const raw = await getItem(KNOWN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
const saveKnown = (ids: string[]) => kvSet(KNOWN_KEY, ids);
/** iOS guarda no máximo 64 notificações agendadas por app: fica uma folga. */
const MAX_SCHEDULED = 56;
const HORIZON_DAYS = 14;

export type PlannedReminder = {
  identifier: string;
  at: number;
  title: string;
  body: string;
  url: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const hour = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function dayWord(start: Date, now: Date): string {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() - d0) / 86_400_000);
  if (diff === 0) return i18n.t('client:reminders.today');
  if (diff === 1) return i18n.t('client:reminders.tomorrow');
  return start.toLocaleDateString(locale(), { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function urlFor(b: ClientBooking): string {
  return b.kind === 'class' ? `/cliente/aula/${b.id}` : `/cliente/compromisso/${b.id}`;
}

/** Linha do aviso: serviço, quando, com quem e onde. */
export function describe(b: ClientBooking, start: Date, now: Date): string {
  const who = b.provider_name ? i18n.t('client:reminders.with', { name: b.provider_name }) : '';
  return i18n.t('client:reminders.line', {
    service: b.service_name ?? i18n.t('client:reminders.appointment'),
    day: dayWord(start, now),
    time: hour(start),
    who,
    tenant: b.tenant_name,
  });
}

/** Quais lembretes devem existir agora (função pura: dá para testar sem aparelho). */
export function planReminders(bookings: ClientBooking[], now = new Date()): PlannedReminder[] {
  const t0 = now.getTime();
  const horizon = t0 + HORIZON_DAYS * 86_400_000;
  const out: PlannedReminder[] = [];
  for (const b of bookings) {
    if (b.status !== 'confirmed' && b.status !== 'pending') continue;
    const start = new Date(b.starts_at);
    const s = start.getTime();
    if (!Number.isFinite(s) || s <= t0 || s > horizon) continue;
    const isClass = b.kind === 'class';
    const needsConfirm = b.status === 'pending' && b.can_confirm;
    const url = urlFor(b);
    const offsets: { min: number; title: string }[] = [
      {
        min: 24 * 60,
        title: i18n.t(
          needsConfirm
            ? isClass
              ? 'client:reminders.classTomorrowConfirm'
              : 'client:reminders.bookingTomorrowConfirm'
            : isClass
              ? 'client:reminders.classTomorrow'
              : 'client:reminders.bookingTomorrow',
        ),
      },
      { min: 60, title: i18n.t(isClass ? 'client:reminders.classInHour' : 'client:reminders.bookingInHour') },
      { min: 10, title: i18n.t(isClass ? 'client:reminders.classIn10' : 'client:reminders.bookingIn10') },
    ];
    for (const o of offsets) {
      const at = s - o.min * 60_000;
      if (at <= t0 + 30_000) continue; // já passou (ou é agora): não agenda no passado
      // O texto vale para a hora em que o aviso toca: o de 1 hora antes não pode dizer "amanhã".
      out.push({ identifier: `${PREFIX}${b.id}:${o.min}`, at, title: o.title, body: describe(b, start, new Date(at)), url });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}

/**
 * O lembrete já agendado ainda serve? Só se nada do que ele mostra mudou: hora, título, texto (serviço e
 * profissional) e para onde o toque leva. Senão é cancelado e agendado de novo com o conteúdo de agora.
 */
export function sameReminder(
  scheduled: { title?: string | null; body?: string | null; data?: unknown },
  wanted: { at: number; title: string; body: string; url: string },
): boolean {
  const data = scheduled.data as { at?: number; url?: string } | undefined;
  return data?.at === wanted.at && scheduled.title === wanted.title && scheduled.body === wanted.body && data?.url === wanted.url;
}

/** Horários novos desde a última vez (o primeiro sync só memoriza, para não avisar o que já existia). */
export function newBookings(bookings: ClientBooking[], known: string[] | null, now = new Date()): ClientBooking[] {
  if (!known) return [];
  const seen = new Set(known);
  return bookings.filter((b) => !seen.has(b.id) && (b.status === 'confirmed' || b.status === 'pending') && new Date(b.starts_at).getTime() > now.getTime());
}

type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null = null;
async function notifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    mod ??= await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

let channel: string | undefined;
let channelTried = false;
/** Canal "Lembretes" no Android. Se o aparelho recusar, usa o canal padrão (o lembrete não pode deixar de tocar). */
async function ensureChannel(N: NotificationsModule): Promise<string | undefined> {
  if (Platform.OS !== 'android' || channelTried) return channel;
  channelTried = true;
  try {
    await N.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: i18n.t('client:reminders.channel'),
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1e4ed8',
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      enableVibrate: true,
      showBadge: true,
    });
    channel = REMINDER_CHANNEL;
  } catch {
    channel = undefined;
  }
  return channel;
}

async function granted(N: NotificationsModule): Promise<boolean> {
  try {
    return (await N.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Aviso imediato (ex.: vaga na aula confirmada, horário novo marcado pela empresa). */
export async function notifyNow(title: string, body: string, url?: string): Promise<void> {
  const N = await notifications();
  if (!N || !(await granted(N))) return;
  const channelId = await ensureChannel(N);
  await N.scheduleNotificationAsync({
    content: { title, body, data: url ? { url } : {}, sound: 'default' },
    trigger: channelId ? ({ channelId } as never) : null,
  });
}

/** Refaz os lembretes agendados para bater com a agenda atual. Nunca lança. */
export async function syncBookingReminders(bookings: ClientBooking[], now = new Date()): Promise<{ scheduled: number; canceled: number }> {
  const N = await notifications();
  if (!N || !(await granted(N))) return { scheduled: 0, canceled: 0 };
  try {
    const channelId = await ensureChannel(N);
    const wanted = planReminders(bookings, now);
    const byId = new Map(wanted.map((r) => [r.identifier, r]));
    const current = (await N.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(PREFIX));
    let canceled = 0;
    const keep = new Set<string>();
    for (const n of current) {
      const w = byId.get(n.identifier);
      if (w && sameReminder(n.content, w)) keep.add(n.identifier);
      else {
        await N.cancelScheduledNotificationAsync(n.identifier);
        canceled += 1;
      }
    }
    let scheduled = 0;
    for (const r of wanted) {
      if (keep.has(r.identifier)) continue;
      await N.scheduleNotificationAsync({
        identifier: r.identifier,
        content: { title: r.title, body: r.body, data: { url: r.url, at: r.at }, sound: 'default' },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(r.at), ...(channelId ? { channelId } : {}) },
      });
      scheduled += 1;
    }

    // Horário novo marcado pela empresa: avisa na hora (só depois do primeiro sync).
    const known = await loadKnown();
    for (const b of newBookings(bookings, known, now).slice(0, 3)) {
      const start = new Date(b.starts_at);
      await notifyNow(i18n.t(b.kind === 'class' ? 'client:reminders.classBooked' : 'client:reminders.newBooking'), describe(b, start, now), urlFor(b));
    }
    // Banco local (sem o limite de 2 KB do armazenamento seguro): guarda todos os atuais e os já vistos,
    // para um horário que já existia nunca ser anunciado de novo como novo.
    await saveKnown([...new Set([...bookings.map((b) => b.id), ...(known ?? [])])].slice(0, KNOWN_MAX));
    return { scheduled, canceled };
  } catch {
    return { scheduled: 0, canceled: 0 };
  }
}

/** Saiu da conta de cliente: nenhum lembrete dela pode tocar depois. */
export async function clearBookingReminders(): Promise<void> {
  const N = await notifications();
  if (!N) return;
  try {
    const current = await N.getAllScheduledNotificationsAsync();
    await Promise.all(current.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => N.cancelScheduledNotificationAsync(n.identifier)));
    await kvSet(KNOWN_KEY, null);
    await setItem(KNOWN_KEY, '');
  } catch {
    // sem lembretes para limpar
  }
}
