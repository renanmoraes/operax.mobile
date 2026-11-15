import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/src/i18n';
import { api } from '@/src/shared/api/client';
import { addDays, isoDate, startOfDay } from '@/src/shared/format';
import { clientDataMode } from '@/src/features/client/dataMode';
import { useClientCapabilities } from '@/src/features/client/useClientData';
import { DEMO_ICONS } from './achievementIcons';
import { fetchSummary } from './fitnessApi';

/**
 * Conquistas do aluno (`/api/public/portal/fitness/achievements`). O backend confere, entrega as cumpridas e devolve o
 * progresso, o nível e o XP; o app só mostra. No modo demonstração, o mesmo formato sai dos dados de exemplo.
 * Regras: operax-backend `fitness-achievements.ts`.
 */

export type AchievementTier = 1 | 2 | 3 | 4 | 5;
export type AchievementPeriodKind = 'always' | 'window' | 'annual' | 'editions';

export interface AchievementView {
  ref: string;
  origin: 'platform' | 'tenant';
  theme: string | null;
  name: string;
  description: string;
  how_to_earn: string;
  tier: AchievementTier;
  icon: { kind: 'library' | 'media'; name: string | null; svg: string | null; url: string | null };
  color: string;
  xp: number;
  goal: { type: string; target: number };
  progress: { current: number; target: number };
  period: { kind: AchievementPeriodKind; active: boolean; starts_on: string | null; ends_on: string | null; next_starts_on: string | null };
  edition: number;
  secret: boolean;
  earned_at: string | null;
  earned_editions: number[];
  new: boolean;
  /** Prêmio da academia e se já foi entregue na edição ganha. */
  prize: string | null;
  prize_status: 'none' | 'pending' | 'delivered';
  /** Medalha que depende de outras: cada exigida com quantas vezes o aluno tem e quantas precisa. */
  requirements: { ref: string; name: string; have: number; times: number }[];
}

export interface AchievementProfile { xp: number; workout_xp: number; achievement_xp: number; level: number; level_xp: number; next_level_xp: number; earned: number }
export interface AchievementsResponse { profile: AchievementProfile; items: AchievementView[] }

export interface EventTicket {
  registration_id: string;
  event: { id: string; name: string; starts_at: string | null; ends_at: string | null; has_achievement: boolean };
  checked_in_at: string | null;
  ticket: { code: string; expires_at: string };
}

export interface CheckinResult { registration_id: string; event: { id: string; name: string }; first: boolean; achievement: { ref: string; name: string; created: boolean } | null }

const F = '/api/public/portal/fitness';
const live = () => clientDataMode() === 'live';
const lang = () => { const l = (i18n.language ?? 'pt').slice(0, 2); return l === 'en' || l === 'es' ? l : 'pt'; };

/** XP total para chegar ao nível L (mesma curva do backend): `100 × (L−1)^1,6`, de 10 em 10. */
export function xpForLevel(level: number) { return level <= 1 ? 0 : Math.round((100 * (level - 1) ** 1.6) / 10) * 10; }
export function levelFor(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 999) level++;
  return { level, level_xp: xpForLevel(level), next_level_xp: xpForLevel(level + 1) };
}

const LABELS: [number, 'beginner' | 'steady' | 'intermediate' | 'advanced' | 'elite'][] = [[1, 'beginner'], [4, 'steady'], [6, 'intermediate'], [10, 'advanced'], [15, 'elite']];

/** Nível para a tela: nome, XP dentro do nível e quanto o nível pede. */
export function levelView(p: Pick<AchievementProfile, 'xp' | 'level' | 'level_xp' | 'next_level_xp'>) {
  const name = LABELS.reduce((acc, [min, n]) => (p.level >= min ? n : acc), LABELS[0][1]);
  return { level: p.level, label: i18n.t(`fitness:level.${name}`), current: p.xp - p.level_xp, next: Math.max(1, p.next_level_xp - p.level_xp), xp: p.xp };
}

// ---------------------------------------------------------------- demonstração

type DemoKey = 'pilgrim' | 'first' | 'ten' | 'week' | 'streak7' | 'record' | 'fifty' | 'hundred' | 'streak30' | 'month' | 'christmas' | 'newYear' | 'jericho' | 'david' | 'emmaus' | 'sinai' | 'nehemiah' | 'hanukkah' | 'race';

let seenDemo = false;
let demoCheckins: string[] = [];

async function demoAchievements(): Promise<AchievementsResponse> {
  const s = await fetchSummary();
  const today = startOfDay(new Date());
  const year = today.getFullYear();
  const md = (m: number, d: number) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const inDec = today.getMonth() === 11 && today.getDate() <= 25;
  const tr = (key: DemoKey) => ({ name: i18n.t(`fitness:achDemo.${key}.name`), description: i18n.t(`fitness:achDemo.${key}.desc`), how_to_earn: i18n.t(`fitness:achDemo.${key}.how`) });
  const tierColor: Record<AchievementTier, string> = { 1: '#B87333', 2: '#8E9AAB', 3: '#D4A017', 4: '#4C8FB0', 5: '#E0662E' };
  const tierXp: Record<AchievementTier, number> = { 1: 50, 2: 100, 3: 200, 4: 400, 5: 800 };
  const always = { kind: 'always' as const, active: true, starts_on: '2000-01-01', ends_on: null, next_starts_on: null };
  const earnedAt = isoDate(addDays(today, -12));
  const item = (key: DemoKey, o: { theme: string | null; tier: AchievementTier; icon: string; current: number; target: number; origin?: 'platform' | 'tenant'; period?: AchievementView['period']; editions?: number[]; color?: string; isNew?: boolean; prize?: string; requirements?: AchievementView['requirements'] }): AchievementView => {
    const won = o.current >= o.target;
    return {
      ref: `${o.origin === 'tenant' ? 't' : 'p'}:demo-${key}`, origin: o.origin ?? 'platform', theme: o.theme, ...tr(key), tier: o.tier,
      icon: { kind: 'library', name: o.icon, svg: DEMO_ICONS[o.icon] ?? DEMO_ICONS.medal, url: null }, color: o.color ?? tierColor[o.tier], xp: tierXp[o.tier],
      goal: { type: 'sessions', target: o.target }, progress: { current: Math.min(o.current, o.target), target: o.target }, period: o.period ?? always,
      edition: o.period && o.period.kind !== 'always' ? year : 0, secret: false, earned_at: won ? `${earnedAt}T08:00:00Z` : null, earned_editions: o.editions ?? [], new: won && !!o.isNew && !seenDemo,
      prize: o.prize ?? null, prize_status: o.prize ? (won ? 'pending' : 'none') : 'none', requirements: o.requirements ?? [],
    };
  };
  const natal = inDec
    ? { kind: 'annual' as const, active: true, starts_on: md(12, 1), ends_on: md(12, 25), next_starts_on: null }
    : { kind: 'annual' as const, active: false, starts_on: `${year - 1}-12-01`, ends_on: `${year - 1}-12-25`, next_starts_on: today.getMonth() === 11 ? `${year + 1}-12-01` : md(12, 1) };
  const hanukkah = { kind: 'editions' as const, active: false, starts_on: null, ends_on: null, next_starts_on: `${year}-12-05` < isoDate(today) ? `${year + 1}-12-25` : `${year}-12-05` };
  const items: AchievementView[] = [
    item('first', { theme: 'general', tier: 1, icon: 'flag', current: s.totalSessions, target: 1 }),
    item('ten', { theme: 'general', tier: 1, icon: 'medal', current: s.totalSessions, target: 10 }),
    item('week', { theme: 'general', tier: 2, icon: 'star', current: 6, target: 1 }),
    item('streak7', { theme: 'general', tier: 2, icon: 'flame', current: s.bestStreak, target: 7 }),
    item('record', { theme: 'general', tier: 2, icon: 'zap', current: s.records, target: 1 }),
    item('fifty', { theme: 'general', tier: 3, icon: 'trophy', current: s.totalSessions, target: 50, isNew: true }),
    item('hundred', { theme: 'general', tier: 4, icon: 'trophy', current: s.totalSessions, target: 100 }),
    item('streak30', { theme: 'general', tier: 4, icon: 'flame', current: s.streak, target: 30 }),
    item('month', { theme: 'general', tier: 3, icon: 'calendar-days', current: s.monthCount, target: 20 }),
    item('christmas', { theme: 'dates', tier: 3, icon: 'tree-pine', current: inDec ? Math.min(5, s.monthCount) : 0, target: 12, period: natal, editions: [year - 1] }),
    item('newYear', { theme: 'dates', tier: 2, icon: 'party-popper', current: 1, target: 1, period: { kind: 'annual', active: false, starts_on: md(1, 1), ends_on: md(1, 1), next_starts_on: `${year + 1}-01-01` }, editions: [year] }),
    item('jericho', { theme: 'bible', tier: 3, icon: 'brick-wall', current: s.bestStreak, target: 7 }),
    item('david', { theme: 'bible', tier: 3, icon: 'sling', current: s.records, target: 3 }),
    item('emmaus', { theme: 'bible', tier: 3, icon: 'route', current: 8, target: 11 }),
    item('sinai', { theme: 'bible', tier: 4, icon: 'mountain-snow', current: 1240, target: 2285 }),
    item('nehemiah', { theme: 'bible', tier: 5, icon: 'castle', current: 31, target: 52 }),
    item('hanukkah', { theme: 'bible', tier: 4, icon: 'menorah', current: 0, target: 8, period: hanukkah }),
    item('race', { theme: null, tier: 3, icon: 'ticket', current: demoCheckins.length ? 1 : 0, target: 1, origin: 'tenant', color: '#E4572E', prize: i18n.t('fitness:achDemo.race.prize') }),
  ];
  // Medalha que depende de outras: todas as de Israel e Bíblia.
  const bible = items.filter((i) => i.theme === 'bible');
  const reqs = bible.map((b) => ({ ref: b.ref, name: b.name, have: b.earned_at ? 1 : 0, times: 1 }));
  items.push(item('pilgrim', { theme: 'bible', tier: 5, icon: 'star-david', current: reqs.filter((r) => r.have).length, target: reqs.length, requirements: reqs }));
  const won = items.filter((i) => i.earned_at);
  const workoutXp = s.totalSessions * 10;
  const achievementXp = won.reduce((n, i) => n + i.xp, 0) + 100;
  const xp = workoutXp + achievementXp;
  return { profile: { xp, workout_xp: workoutXp, achievement_xp: achievementXp, ...levelFor(xp), earned: won.length + 1 }, items };
}

// ---------------------------------------------------------------- API

export async function fetchAchievements(): Promise<AchievementsResponse> {
  if (live()) return (await api.get<AchievementsResponse>(`${F}/achievements`, { params: { lang: lang() } })).data;
  return demoAchievements();
}

export async function markAchievementsSeen() {
  if (live()) { await api.post(`${F}/achievements/seen`, {}); return; }
  seenDemo = true;
}

export async function eventCheckin(code: string): Promise<CheckinResult> {
  if (live()) return (await api.post<CheckinResult>(`${F}/achievements/checkin`, { code })).data;
  await new Promise((r) => setTimeout(r, 400));
  const first = !demoCheckins.includes(code);
  if (first) demoCheckins = [...demoCheckins, code];
  return { registration_id: 'demo', event: { id: 'demo', name: i18n.t('fitness:achDemo.race.event') }, first, achievement: { ref: 't:demo-race', name: i18n.t('fitness:achDemo.race.name'), created: first } };
}

export async function fetchTickets(): Promise<EventTicket[]> {
  if (live()) return (await api.get<EventTicket[]>(`${F}/events/tickets`)).data;
  const start = addDays(startOfDay(new Date()), 6);
  start.setHours(7, 0, 0, 0);
  return [{
    registration_id: 'demo-reg', event: { id: 'demo', name: i18n.t('fitness:achDemo.race.event'), starts_at: start.toISOString(), ends_at: null, has_achievement: true },
    checked_in_at: demoCheckins.length ? new Date().toISOString() : null,
    ticket: { code: `tk1.demo.${Math.floor(Date.now() / 600_000)}.operax-demo-ticket-qr`, expires_at: new Date(Date.now() + 600_000).toISOString() },
  }];
}

const KEY = ['fitness', 'achievements'] as const;

/** Conquistas só existem para quem tem Fitness no portal (`caps.training`); sem ele, nada é pedido. */
export function useAchievements() {
  const caps = useClientCapabilities();
  return useQuery({ queryKey: [...KEY, lang()], queryFn: fetchAchievements, enabled: caps.training });
}

/** Nível e XP do aluno (mesma fonte da tela de Conquistas). */
export function useAchievementLevel() {
  const q = useAchievements();
  return q.data ? levelView(q.data.profile) : null;
}

export function useMarkAchievementsSeen() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: markAchievementsSeen, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export function useEventCheckin() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: eventCheckin, onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: [...KEY, 'tickets'] }); } });
}

/** Ingressos: o QR vale 10 minutos, então a lista se renova sozinha a cada 5. */
export function useTickets() { return useQuery({ queryKey: [...KEY, 'tickets'], queryFn: fetchTickets, refetchInterval: 5 * 60_000 }); }
