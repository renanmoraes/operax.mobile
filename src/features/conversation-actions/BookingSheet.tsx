import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import { dayLabel, dayRange, DEMO_PROVIDERS, DEMO_SERVICES, demoSlots, nextDays, servicesFor, upcomingSlots } from './logic';

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  const create = useMutation({
    mutationFn: async () => {
      if (!slot || !providerId || !serviceId) throw new Error('incompleto');
      if (!live) return { id: 'demo', starts_at: slot.starts_at };
      return createQuickBooking({
        provider_id: providerId,
        service_id: serviceId,
        contact_id: contactId,
        client_name: contactName,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        customer_note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      const d = new Date(slot!.starts_at);
      const when = `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')} às ${hhmm(slot!.starts_at)}`;
      onBooked(`${service?.name ?? 'Horário'} com ${provider?.name ?? 'a equipe'}, ${when}`);
      setSlot(null);
      setNote('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      onError(Array.isArray(msg) ? msg[0] : msg || 'Não foi possível agendar. Tente outro horário.');
    },
  });

  const loadingBase = live && (providersQ.isLoading || servicesQ.isLoading);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Agendar para ${shortName(contactName)}`} closeLabel="Fechar agendamento">
      <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
        {loadingBase ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
        ) : providers.length === 0 ? (
          <Text style={styles.empty}>Nenhum profissional ativo na agenda. Cadastre pelo Operax web.</Text>
        ) : (
          <>
            {providers.length > 1 ? (
              <Step label="Profissional">
                <View style={styles.wrap}>
                  {providers.map((p) => (
                    <Chip key={p.id} label={p.name} selected={providerId === p.id} onPress={() => setProviderId(p.id)} />
                  ))}
                </View>
              </Step>
            ) : null}

            {providerId ? (
              <Step label="Serviço">
                <View style={styles.wrap}>
                  {services.map((s) => (
                    <Chip key={s.id} label={`${s.name} · ${s.default_duration_min} min`} selected={serviceId === s.id} onPress={() => setServiceId(s.id)} />
                  ))}
                </View>
              </Step>
            ) : null}

            {service ? (
              <Step label="Dia">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                  {days.map((d, i) => {
                    const on = i === dayIdx;
                    const l = dayLabel(d);
                    return (
                      <PressableScale key={i} onPress={() => setDayIdx(i)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} style={[styles.day, on && styles.dayOn]}>
                        <Text style={[styles.dayTop, on && { color: 'rgba(255,255,255,0.85)' }]}>{l.top}</Text>
                        <Text style={[styles.dayNum, on && { color: '#fff' }]}>{l.day}</Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </Step>
            ) : null}

            {service ? (
              <Step label="Horário livre">
                {slotsQ.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ paddingVertical: 14 }} />
                ) : slots.length === 0 ? (
                  <Text style={styles.empty}>Sem horário livre neste dia. Tente o próximo.</Text>
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

            {slot ? <Field label="Recado para o cliente (opcional)" value={note} onChangeText={setNote} placeholder="Ex.: chegar 10 min antes" /> : null}
          </>
        )}
      </ScrollView>
      <Button
        label={slot ? `Agendar ${dayLabel(day).top.toLowerCase()} às ${hhmm(slot.starts_at)}` : 'Escolha um horário'}
        disabled={!slot}
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
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
