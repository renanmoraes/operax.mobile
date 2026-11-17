import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { Avatar, Button, Card, Chip, Field, Muted, PressableScale, Screen, TopBar } from '@/src/design-system/ui';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import {
  classifyFailure,
  clientPayload,
  DEFAULT_REMINDERS,
  encaixeJustificationOk,
  manualRange,
  NO_PAYMENT,
  ownProvider,
  paymentComplete,
  paymentPayload,
  phoneToE164,
  REMINDER_CHOICES,
  servicesOf,
  upcoming,
  type PaymentChoice,
} from '@/src/features/agenda/newBooking';
import { addDaysKey, localDateKey, wallClock, wallDateLabel } from '@/src/features/agenda/wallClock';
import { locale } from '@/src/i18n';
import {
  createSchedulingBooking,
  createSchedulingClient,
  getSchedulingStatus,
  listActivePlans,
  listProviderServiceIds,
  listSchedulingProviders,
  listSchedulingServices,
  searchDaySlots,
  searchSchedulingPeople,
  type CreateBookingInput,
  type FreeSlot,
  type SchedulingPerson,
} from '@/src/shared/api/scheduling.api';

const DAYS = 21;

/** Meio segundo depois da última tecla: a busca de cliente vai ao servidor, não a cada letra. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function NewBookingScreenGuarded() {
  const { t } = useTranslation('agenda');
  return (
    <RequirePermission need="bookingCreate" title={t('newBooking.title')}>
      <NewBookingScreen />
    </RequirePermission>
  );
}

function NewBookingScreen() {
  const { t } = useTranslation('agenda');
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const can = useCan();
  const { user } = useAuth();
  const userId = user?.kind === 'staff' ? user.id : undefined;

  const canCreateAny = can('scheduling:create');
  const canManageClients = can('scheduling:manage_clients');
  const canWaitlist = can('scheduling:manage_waitlist');
  const canForce = can('scheduling:manage_providers');
  const canOverrideNoShow = canForce || can('scheduling:override_no_show_penalty');

  // ---- escolhas
  const [person, setPerson] = useState<SchedulingPerson | null>(null);
  const [search, setSearch] = useState('');
  const [pickedProvider, setProviderId] = useState<string | null>(null);
  const [pickedService, setServiceId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(localDateKey());
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [manual, setManual] = useState(false);
  const [manualTime, setManualTime] = useState('');
  const [why, setWhy] = useState('');
  const [payment, setPayment] = useState<PaymentChoice>(NO_PAYMENT);
  const [note, setNote] = useState('');
  const [reminders, setReminders] = useState<number[]>(DEFAULT_REMINDERS);
  const [waitlist, setWaitlist] = useState<{ on: boolean; period: 'any' | 'morning' | 'afternoon' }>({ on: false, period: 'any' });
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState(false);

  // ---- dados
  const providersQ = useQuery({ queryKey: ['sched', 'providers'], queryFn: listSchedulingProviders, staleTime: 5 * 60_000 });
  const servicesQ = useQuery({ queryKey: ['sched', 'services'], queryFn: listSchedulingServices, staleTime: 5 * 60_000 });
  const statusQ = useQuery({ queryKey: ['sched', 'status'], queryFn: getSchedulingStatus, staleTime: 60_000 });
  const providers = useMemo(() => (providersQ.data ?? []).filter((p) => p.is_active !== false), [providersQ.data]);
  const own = ownProvider(providers, userId, canCreateAny);
  const providerId = own?.id ?? pickedProvider ?? (providers.length === 1 ? providers[0].id : null);
  const linksQ = useQuery({ queryKey: ['sched', 'links', providerId], queryFn: () => listProviderServiceIds(providerId!), enabled: !!providerId, staleTime: 5 * 60_000 });
  const services = servicesOf(linksQ.data, servicesQ.data ?? []);
  const serviceId = pickedService && services.some((s) => s.id === pickedService) ? pickedService : services.length === 1 ? services[0].id : null;
  const service = services.find((s) => s.id === serviceId);

  const debounced = useDebounced(search.trim());
  const peopleQ = useQuery({ queryKey: ['sched', 'people', debounced], queryFn: () => searchSchedulingPeople(debounced), enabled: !person && debounced.length >= 2 });
  const slotsQ = useQuery({
    queryKey: ['sched', 'slots', providerId, serviceId, dateKey],
    queryFn: () => searchDaySlots({ service_id: serviceId!, provider_id: providerId!, dateKey }),
    enabled: !!providerId && !!serviceId,
    retry: false,
    staleTime: 30_000,
  });
  const plansQ = useQuery({ queryKey: ['sched', 'plans'], queryFn: listActivePlans, enabled: payment.type === 'insurance', staleTime: 5 * 60_000 });
  const slots = upcoming(slotsQ.data ?? []);
  const slotsDenied = (slotsQ.error as { response?: { status?: number } } | null)?.response?.status === 403;

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDaysKey(localDateKey(), i)), []);
  const today = localDateKey();

  const range = manual && service ? manualRange(dateKey, manualTime, service.default_duration_min) : slot ? { starts_at: slot.starts_at, ends_at: slot.ends_at } : null;
  const justOk = !manual || encaixeJustificationOk(why);
  const ready = !!person && !!providerId && !!serviceId && !!range && justOk && paymentComplete(payment);
  const whenLabel = range ? t('newBooking.whenFormat', { day: wallDateLabel(range.starts_at, locale(), { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''), time: wallClock(range.starts_at) }) : '';

  const create = useMutation({
    mutationFn: (extra: Partial<CreateBookingInput> | undefined) => {
      const body: CreateBookingInput = {
        provider_id: providerId!,
        service_id: serviceId!,
        starts_at: range!.starts_at,
        ends_at: range!.ends_at,
        ...clientPayload(person!),
        ...paymentPayload(payment),
        ...(note.trim() ? { customer_note: note.trim() } : {}),
        reminder_offsets_minutes: [...reminders].sort((a, b) => b - a),
        ...(canWaitlist && statusQ.data?.waitlist_enabled && waitlist.on ? { join_waitlist: true, waitlist_period: waitlist.period } : {}),
        ...(manual ? { allow_booking_overlap: true, encaixe_justification: why.trim() } : {}),
        ...extra,
      };
      return createSchedulingBooking(body);
    },
    onSuccess: async (b) => {
      await qc.invalidateQueries({ queryKey: ['bookings'] });
      await qc.invalidateQueries({ queryKey: ['sched', 'slots'] });
      await showDialog({
        title: t('newBooking.created'),
        message: b.waitlist_error ? t('newBooking.createdWaitFail', { reason: b.waitlist_error }) : undefined,
        tone: b.waitlist_error ? 'warn' : 'success',
      });
      router.back();
    },
    onError: async (e, extra) => {
      const f = classifyFailure(e);
      if (f.kind === 'single_active') {
        const detail = f.when ? t('newBooking.singleWhen', { when: `${wallDateLabel(f.when, locale(), { day: '2-digit', month: '2-digit' })} ${wallClock(f.when)}` }) : '';
        const message = [f.message, detail].filter(Boolean).join('\n');
        if (canForce && (await confirmDialog({ title: t('newBooking.singleTitle'), message, confirmLabel: t('newBooking.force'), cancelLabel: t('newBooking.cancel'), tone: 'warn' }))) create.mutate({ ...extra, force_single_booking_override: true });
        else if (!canForce) await showDialog({ title: t('newBooking.singleTitle'), message, tone: 'warn' });
      } else if (f.kind === 'no_show') {
        if (canOverrideNoShow && (await confirmDialog({ title: t('newBooking.noShowTitle'), message: f.message, confirmLabel: t('newBooking.force'), cancelLabel: t('newBooking.cancel'), tone: 'warn' }))) create.mutate({ ...extra, force_no_show_override: true });
        else if (!canOverrideNoShow) await showDialog({ title: t('newBooking.noShowTitle'), message: f.message, tone: 'warn' });
      } else if (f.kind === 'soft_block') {
        if (await confirmDialog({ title: t('newBooking.softTitle'), message: t('newBooking.softBody'), confirmLabel: t('newBooking.force'), cancelLabel: t('newBooking.cancel'), tone: 'warn' })) create.mutate({ ...extra, allow_blocked_overlap: true });
      } else {
        await showDialog({ title: f.message ?? t('newBooking.failed'), tone: 'warn' });
      }
    },
  });

  const pickDay = (k: string) => {
    setDateKey(k);
    setSlot(null);
  };

  return (
    <Screen>
      <TopBar safe title={t('newBooking.title')} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* 1. Cliente */}
          <Step n={1} label={t('newBooking.patient')}>
            {person ? (
              <Card style={styles.picked}>
                <Avatar initials={initialsOf(person.name)} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickedName} numberOfLines={1}>{person.name}</Text>
                  {person.phone_e164 ? <Muted style={{ fontSize: 12.5 }}>{person.phone_e164}</Muted> : null}
                </View>
                <Button label={t('newBooking.change')} variant="ghost" compact onPress={() => { setPerson(null); setSearch(''); }} />
              </Card>
            ) : (
              <>
                <Field label={t('newBooking.searchPlaceholder')} icon="search-outline" value={search} onChangeText={setSearch} autoCapitalize="words" />
                {debounced.length >= 2 ? (
                  <View style={styles.list}>
                    {peopleQ.isFetching ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} /> : null}
                    {(peopleQ.data ?? []).slice(0, 8).map((p) => (
                      <PressableScale key={`${p.client_id ?? ''}:${p.contact_id ?? ''}`} onPress={() => setPerson(p)} accessibilityRole="button" accessibilityLabel={p.name} style={styles.person}>
                        <Avatar initials={initialsOf(p.name)} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickedName} numberOfLines={1}>{p.name}</Text>
                          {p.phone_e164 ? <Muted style={{ fontSize: 12 }}>{p.phone_e164}</Muted> : null}
                        </View>
                      </PressableScale>
                    ))}
                    {!peopleQ.isFetching && !(peopleQ.data ?? []).length ? <Muted style={{ paddingVertical: 6 }}>{t('newBooking.noPeople')}</Muted> : null}
                    {canManageClients ? <Button label={t('newBooking.create', { name: debounced })} icon="person-add-outline" variant="soft" onPress={() => setCreating(true)} /> : null}
                  </View>
                ) : canManageClients ? (
                  <Button label={t('newBooking.createNew')} icon="person-add-outline" variant="ghost" onPress={() => setCreating(true)} />
                ) : null}
              </>
            )}
          </Step>

          {/* 2. Profissional e serviço */}
          <Step n={2} label={t('newBooking.provider')}>
            {providersQ.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !providers.length ? (
              <Muted>{t('newBooking.noProviders')}</Muted>
            ) : own ? (
              <Muted>{`${t('newBooking.lockedProvider')} ${own.name}`}</Muted>
            ) : (
              <View style={styles.wrap}>
                {providers.map((p) => (
                  <Chip key={p.id} label={p.name} selected={providerId === p.id} onPress={() => { setProviderId(p.id); setServiceId(null); setSlot(null); }} />
                ))}
              </View>
            )}
            {providerId ? (
              <View style={{ gap: 8, marginTop: 14 }}>
                <Text style={styles.sub}>{t('newBooking.service')}</Text>
                {linksQ.isLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : !services.length ? (
                  <Muted>{t('newBooking.noServices')}</Muted>
                ) : (
                  <View style={styles.wrap}>
                    {services.map((s) => (
                      <Chip key={s.id} label={`${s.name} · ${s.default_duration_min} min`} selected={serviceId === s.id} onPress={() => { setServiceId(s.id); setSlot(null); }} />
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </Step>

          {/* 3. Dia e horário */}
          {service ? (
            <Step n={3} label={t('newBooking.day')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {days.map((k) => {
                  const on = k === dateKey;
                  return (
                    <PressableScale key={k} onPress={() => pickDay(k)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={wallDateLabel(k, locale(), { weekday: 'long', day: 'numeric', month: 'long' })} style={[styles.day, on && styles.dayOn]}>
                      <Text style={[styles.dayTop, on && { color: '#ffffffd9' }]}>{k === today ? t('newBooking.today') : wallDateLabel(k, locale(), { weekday: 'short' }).replace('.', '')}</Text>
                      <Text style={[styles.dayNum, on && { color: '#fff' }]}>{Number(k.slice(8, 10))}</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>

              <View style={{ gap: 8, marginTop: 14 }}>
                <Text style={styles.sub}>{manual ? t('newBooking.encaixe') : t('newBooking.slots')}</Text>
                {manual ? (
                  <View style={{ gap: 10 }}>
                    <Field label={t('newBooking.encaixeTime')} value={manualTime} onChangeText={(v) => setManualTime(v.replace(/[^\d:]/g, '').slice(0, 5))} keyboardType="number-pad" maxLength={5} placeholder="14:30" icon="time-outline" />
                    <Field label={t('newBooking.encaixeWhy')} value={why} onChangeText={setWhy} placeholder={t('newBooking.encaixeWhyHint')} multiline />
                    <Button label={t('newBooking.encaixeBack')} variant="ghost" onPress={() => { setManual(false); setManualTime(''); setWhy(''); }} />
                  </View>
                ) : slotsQ.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
                ) : slotsDenied ? (
                  <Muted>{t('newBooking.slotsDenied')}</Muted>
                ) : slotsQ.isError ? (
                  <Muted>{t('newBooking.slotsFailed')}</Muted>
                ) : !slots.length ? (
                  <Muted>{t('newBooking.noSlots')}</Muted>
                ) : (
                  <View style={styles.slots}>
                    {slots.filter((s) => s.starts_at.slice(0, 10) === dateKey).map((s) => {
                      const on = slot?.starts_at === s.starts_at;
                      return (
                        <PressableScale key={s.starts_at} onPress={() => setSlot(s)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.slot, on && styles.slotOn]}>
                          <Text style={[styles.slotText, on && { color: '#fff' }]}>{wallClock(s.starts_at)}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                )}
                {!manual && !slotsDenied ? <Button label={t('newBooking.encaixe')} variant="ghost" compact onPress={() => { setManual(true); setSlot(null); }} /> : null}
              </View>
            </Step>
          ) : null}

          {/* 4. Pagamento e mais opções */}
          {range ? (
            <>
              <Step n={4} label={t('newBooking.payment')}>
                <View style={styles.wrap}>
                  <Chip label={t('newBooking.payNone')} selected={payment.type === 'none'} onPress={() => setPayment(NO_PAYMENT)} />
                  <Chip label={t('newBooking.payPrivate')} selected={payment.type === 'private'} onPress={() => setPayment({ type: 'private', planId: '' })} />
                  <Chip label={t('newBooking.payInsurance')} selected={payment.type === 'insurance'} onPress={() => setPayment({ type: 'insurance', planId: payment.planId })} />
                </View>
                {payment.type === 'insurance' ? (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    <Text style={styles.sub}>{t('newBooking.plan')}</Text>
                    {plansQ.isLoading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : !(plansQ.data ?? []).length ? (
                      <Muted>{t('newBooking.noPlans')}</Muted>
                    ) : (
                      <View style={styles.wrap}>
                        {(plansQ.data ?? []).map((p) => (
                          <Chip key={p.id} label={p.name} selected={payment.planId === p.id} onPress={() => setPayment({ type: 'insurance', planId: p.id })} />
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
              </Step>

              <PressableScale onPress={() => setMore((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: more }} style={styles.moreRow}>
                <Text style={styles.moreText}>{t('newBooking.more')}</Text>
                <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </PressableScale>
              {more ? (
                <Card style={{ gap: 18 }}>
                  <Field label={t('newBooking.note')} value={note} onChangeText={setNote} placeholder={t('newBooking.noteHint')} multiline maxLength={1000} />
                  <View style={{ gap: 8 }}>
                    <Text style={styles.sub}>{t('newBooking.reminders')}</Text>
                    <Muted style={{ fontSize: 12.5 }}>{t('newBooking.remindersHint')}</Muted>
                    <View style={styles.wrap}>
                      {REMINDER_CHOICES.map((m) => (
                        <Chip key={m} label={t(`newBooking.r${m}` as 'newBooking.r1440')} selected={reminders.includes(m)} onPress={() => setReminders((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} />
                      ))}
                    </View>
                  </View>
                  {canWaitlist && statusQ.data?.waitlist_enabled ? (
                    <View style={{ gap: 10 }}>
                      <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sub}>{t('newBooking.waitlist')}</Text>
                          <Muted style={{ fontSize: 12.5 }}>{t('newBooking.waitlistHint')}</Muted>
                        </View>
                        <Switch value={waitlist.on} onValueChange={(on) => setWaitlist((w) => ({ ...w, on }))} trackColor={{ true: colors.primary, false: colors.track }} thumbColor="#fff" accessibilityLabel={t('newBooking.waitlist')} />
                      </View>
                      {waitlist.on ? (
                        <View style={styles.wrap}>
                          {(['any', 'morning', 'afternoon'] as const).map((p) => (
                            <Chip key={p} label={t(`newBooking.period${p === 'any' ? 'Any' : p === 'morning' ? 'Morning' : 'Afternoon'}` as 'newBooking.periodAny')} selected={waitlist.period === p} onPress={() => setWaitlist((w) => ({ ...w, period: p }))} />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button label={ready ? t('newBooking.submit', { when: whenLabel }) : !person ? t('newBooking.submitPerson') : !payment || !paymentComplete(payment) ? t('newBooking.plan') : manual && !justOk ? t('newBooking.encaixeWhy') : t('newBooking.submitPick')} icon="checkmark" disabled={!ready} loading={create.isPending} onPress={() => create.mutate(undefined)} />
        </View>
      </KeyboardAvoidingView>

      <NewClientSheet
        visible={creating}
        initialName={search.trim()}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          setPerson(p);
          setCreating(false);
        }}
      />
    </Screen>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.stepHead}>
        <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
        <Text style={styles.stepLabel}>{label}</Text>
      </View>
      <Card style={{ gap: 4 }}>{children}</Card>
    </View>
  );
}

/** Cadastra quem não está na lista sem sair do agendamento (mesma permissão de quem marca). */
function NewClientSheet({ visible, initialName, onClose, onCreated }: { visible: boolean; initialName: string; onClose: () => void; onCreated: (p: SchedulingPerson) => void }) {
  const { t } = useTranslation('agenda');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Cada vez que abre, começa do nome que a pessoa já digitou na busca.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(initialName);
      setPhone('');
      setError(null);
    }
  }
  const save = useMutation({
    mutationFn: async () => {
      const e164 = phone.trim() ? phoneToE164(phone) : undefined;
      if (phone.trim() && !e164) throw new Error('phone');
      return createSchedulingClient({ name: name.trim(), ...(e164 ? { phone_e164: e164 } : {}) });
    },
    onSuccess: (c) => onCreated({ client_id: c.id, contact_id: c.contact_id, name: c.name, phone_e164: c.phone_e164 }),
    onError: (e) => setError((e as Error).message === 'phone' ? t('newBooking.createPhoneBad') : t('newBooking.failed')),
  });
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('newBooking.createTitle')}>
      <View style={{ gap: 12, paddingBottom: 14, paddingHorizontal: 2 }}>
        <Field label={t('newBooking.createName')} value={name} onChangeText={setName} autoCapitalize="words" icon="person-outline" />
        <Field label={t('newBooking.createPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="call-outline" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={t('newBooking.createSave')} loading={save.isPending} disabled={name.trim().length < 2} onPress={() => { setError(null); save.mutate(); }} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28, gap: 18 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 12.5 },
  stepLabel: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  sub: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textSoft },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 6, marginTop: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: radii.md },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primaryWash, ...shadows.card },
  pickedName: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  day: { width: 58, height: 66, borderRadius: radii.lg, backgroundColor: '#f6f8fb', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayOn: { backgroundColor: colors.primary },
  dayTop: { fontFamily: typography.fontFamilyMedium, fontSize: 11.5, color: colors.textMuted, textTransform: 'capitalize' },
  dayNum: { fontFamily: typography.fontFamilySemiBold, fontSize: 19, color: colors.text, fontVariant: ['tabular-nums'] },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '22.5%', height: 42, borderRadius: radii.pill, backgroundColor: '#f6f8fb', alignItems: 'center', justifyContent: 'center' },
  slotOn: { backgroundColor: colors.primary },
  slotText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text, fontVariant: ['tabular-nums'] },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  moreText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.pageBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
  error: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: colors.dangerText },
});
