import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { locale } from '@/src/i18n';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, Chip, Field, PressableScale } from '@/src/design-system/ui';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import {
  createQuickBooking,
  listSchedProviders,
  listSchedServices,
  SchedSlot,
  searchSlots,
} from '@/src/shared/api/conversation-actions.api';
import { wallClock, wallDateLabel } from '@/src/features/agenda/wallClock';
import { dayLabel, dayRange, DEMO_PROVIDERS, DEMO_SERVICES, demoSlots, nextDays, servicesFor, upcomingSlots } from './logic';

// Horário de agenda é relógio de parede: lê o texto, sem converter pelo fuso do aparelho.
const hhmm = wallClock;
const DAYS = 14;

/** Primeiro nome, mantendo títulos como "Dr." e "Dra." junto ("Dr. Ricardo"). */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[0]?.endsWith('.') && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0] || name;
}

/**
 * Agendar pela conversa (igual ao "+ → Agendar pela conversa" do Operax web): escolhe
 * profissional, serviço, dia e um horário livre; o agendamento já fica ligado ao contato.
 */
export function BookingSheet({
  visible,
  onClose,
  live,
  contactId,
  contactName,
  onBooked,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  live: boolean;
  contactId: string;
  contactName: string;
  onBooked: (summary: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation('inbox');
  const providersQ = useQuery({ queryKey: ['sched', 'providers'], enabled: live && visible, queryFn: listSchedProviders, staleTime: 5 * 60_000 });
  const servicesQ = useQuery({ queryKey: ['sched', 'services'], enabled: live && visible, queryFn: listSchedServices, staleTime: 5 * 60_000 });
  const providers = (live ? providersQ.data ?? [] : DEMO_PROVIDERS).filter((p) => p.is_active !== false);
  const allServices = live ? servicesQ.data ?? [] : DEMO_SERVICES;

  const [pickedProvider, setProviderId] = useState<string | null>(null);
  const [pickedService, setServiceId] = useState<string | null>(null);
  const days = useMemo(() => nextDays(DAYS), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dayIdx, setDayIdx] = useState(0);
  const [picked, setPicked] = useState<{ key: string; slot: SchedSlot } | null>(null);
  const [note, setNote] = useState('');

  // Um só profissional ou serviço: já vem escolhido (padrão derivado, sem efeito).
  const providerId = pickedProvider ?? (providers.length === 1 ? providers[0].id : null);
  const provider = providers.find((p) => p.id === providerId);
  const services = servicesFor(provider, allServices);
  const serviceId = pickedService && services.some((s) => s.id === pickedService) ? pickedService : services.length === 1 ? services[0].id : null;
  const service = services.find((s) => s.id === serviceId);

  const day = days[dayIdx];
  // O horário escolhido só vale para o profissional, serviço e dia em que foi escolhido.
  const slotKey = `${providerId}|${serviceId}|${dayIdx}`;
  const slot = picked?.key === slotKey ? picked.slot : null;
  const setSlot = (s: SchedSlot | null) => setPicked(s ? { key: slotKey, slot: s } : null);
  const slotsQ = useQuery({
    queryKey: ['sched', 'slots', providerId, serviceId, day.toDateString(), live],
    enabled: visible && !!providerId && !!service,
    queryFn: async () => {
      if (!live) return demoSlots(day, providerId!, service!.default_duration_min);
      return searchSlots({ service_id: service!.id, provider_id: providerId!, ...dayRange(day) });
    },
  });
  const slots = upcomingSlots(slotsQ.data ?? []);

  // O que foi enviado vira um retrato: mudar a seleção durante o envio não afeta a confirmação.
  type Submitted = { slot: SchedSlot; providerId: string; serviceId: string; providerName: string; serviceName: string; note: string };
  const create = useMutation({
    mutationFn: async (v: Submitted) => {
      if (!live) return { id: 'demo', starts_at: v.slot.starts_at };
      return createQuickBooking({
        provider_id: v.providerId,
        service_id: v.serviceId,
        contact_id: contactId,
        client_name: contactName,
        starts_at: v.slot.starts_at,
        ends_at: v.slot.ends_at,
        customer_note: v.note.trim() || undefined,
      });
    },
    onSuccess: (_res, v) => {
      const when = t('booking.when', { date: wallDateLabel(v.slot.starts_at, locale(), { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''), time: hhmm(v.slot.starts_at) });
      onBooked(t('booking.summary', { service: v.serviceName, provider: v.providerName, when }));
      setSlot(null);
      setNote('');
    },
    onError: (e: unknown) => {
      // Só mostra o texto do servidor quando é um aviso (4xx) escrito; erro de servidor ou rede usa o texto do app.
      const res = (e as { response?: { status?: number; data?: { message?: string | string[] } } })?.response;
      const raw = Array.isArray(res?.data?.message) ? res?.data?.message[0] : res?.data?.message;
      onError(typeof raw === 'string' && raw.trim() && (res?.status ?? 500) < 500 ? raw : t('booking.failed'));
    },
  });

  const submit = () => {
    if (!slot || !providerId || !serviceId || create.isPending) return;
    create.mutate({ slot, providerId, serviceId, providerName: provider?.name ?? t('booking.teamFallback'), serviceName: service?.name ?? t('booking.slotFallback'), note });
  };

  const loadingBase = live && (providersQ.isLoading || servicesQ.isLoading);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('booking.title', { name: shortName(contactName) })} closeLabel={t('booking.close')}
      footer={
        <Button
          label={slot ? t('booking.submit', { day: dayLabel(day).top.toLowerCase(), time: hhmm(slot.starts_at) }) : t('booking.pickSlot')}
          disabled={!slot}
          loading={create.isPending}
          onPress={submit}
        />
      }
    >
      <View style={{ gap: 16 }}>
        {loadingBase ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
        ) : providers.length === 0 ? (
          <Text style={styles.empty}>{t('booking.noProviders')}</Text>
        ) : (
          <>
            {providers.length > 1 ? (
              <Step label={t('booking.provider')}>
                <View style={styles.wrap}>
                  {providers.map((p) => (
                    <Chip key={p.id} label={p.name} selected={providerId === p.id} onPress={() => setProviderId(p.id)} />
                  ))}
                </View>
              </Step>
            ) : null}

            {providerId ? (
              <Step label={t('booking.service')}>
                <View style={styles.wrap}>
                  {services.map((s) => (
                    <Chip key={s.id} label={`${s.name} · ${s.default_duration_min} min`} selected={serviceId === s.id} onPress={() => setServiceId(s.id)} />
                  ))}
                </View>
              </Step>
            ) : null}

            {service ? (
              <Step label={t('booking.day')}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                  {days.map((d, i) => {
                    const on = i === dayIdx;
                    const l = dayLabel(d);
                    return (
                      <PressableScale key={i} onPress={() => setDayIdx(i)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })} style={[styles.day, on && styles.dayOn]}>
                        <Text style={[styles.dayTop, on && { color: 'rgba(255,255,255,0.85)' }]}>{l.top}</Text>
                        <Text style={[styles.dayNum, on && { color: '#fff' }]}>{l.day}</Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </Step>
            ) : null}

            {service ? (
              <Step label={t('booking.freeSlot')}>
                {slotsQ.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ paddingVertical: 14 }} />
                ) : slots.length === 0 ? (
                  <Text style={styles.empty}>{t('booking.noSlots')}</Text>
                ) : (
                  <View style={styles.slots}>
                    {slots.map((s) => {
                      const on = slot?.starts_at === s.starts_at;
                      return (
                        <PressableScale key={s.starts_at} onPress={() => setSlot(s)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.slot, on && styles.slotOn]}>
                          <Text style={[styles.slotText, on && { color: '#fff' }]}>{hhmm(s.starts_at)}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                )}
              </Step>
            ) : null}

            {slot ? <Field label={t('booking.noteLabel')} value={note} onChangeText={setNote} placeholder={t('booking.notePlaceholder')} /> : null}
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...text.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { ...text.callout, color: colors.textMuted, paddingVertical: 10 },
  day: { width: 58, height: 66, borderRadius: radii.lg, backgroundColor: '#f6f8fb', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayOn: { backgroundColor: colors.primary },
  dayTop: { ...text.label, color: colors.textMuted },
  dayNum: { fontFamily: typography.fontFamilySemiBold, fontSize: 19, color: colors.text, fontVariant: ['tabular-nums'] },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '22.5%', height: 42, borderRadius: radii.pill, backgroundColor: '#f6f8fb', alignItems: 'center', justifyContent: 'center' },
  slotOn: { backgroundColor: colors.primary },
  slotText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text, fontVariant: ['tabular-nums'] },
});
