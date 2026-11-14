import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Display, Field, IconTile, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { useBooking, useCancelBooking } from '@/src/features/client/useClientData';
import { formatHour, weekdayShort } from '@/src/shared/format';

const REASONS = ['Imprevisto no trabalho', 'Não estou me sentindo bem', 'Problema com transporte', 'Prefiro remarcar', 'Outro motivo'];

export default function CancelBookingScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: b } = useBooking(id);
  const cancel = useCancelBooking();
  const [reason, setReason] = useState(1);
  const [note, setNote] = useState('');
  const [rebook, setRebook] = useState(true);
  const [done, setDone] = useState(false);

  if (!b) return <Screen>{null}</Screen>;
  const start = new Date(b.starts_at);
  const late = (start.getTime() - Date.now()) / 3_600_000 < 12;

  if (done) {
    return (
      <Screen>
        <View style={[styles.done, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
          <Rise style={{ alignItems: 'center' }}>
            <IconTile icon="calendar-clear-outline" size={72} tone="neutral" />
            <Display style={{ marginTop: 18, textAlign: 'center' }}>{`${b.service_name} cancelado`}</Display>
            <Muted style={{ marginTop: 8, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
              {rebook
                ? `Avisamos ${b.provider_name?.split(' ')[0]} e abrimos o chat com o pedido de um novo horário já escrito.`
                : `Avisamos ${b.provider_name?.split(' ')[0]}. O horário ficou livre para outra pessoa.`}
            </Muted>
          </Rise>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 10 }}>
            {rebook ? <Button label="Abrir o chat" onPress={() => router.replace(`/cliente/chat/${b.tenant_slug}?remarcar=${b.id}`)} /> : null}
            <Button label="Voltar à agenda" variant="secondary" onPress={() => router.navigate('/(client)/agenda')} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backdrop="mirror">
      <TopBar safe onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Display>{`Cancelar ${b.service_name?.toLowerCase()}?`}</Display>
        <Muted style={{ marginTop: 6, fontSize: 14 }}>{`${weekdayShort(start)} ${start.getDate()} · ${formatHour(b.starts_at)} · com ${b.provider_name}`}</Muted>

        {late ? (
          <View style={styles.warn}>
            <Ionicons name="time-outline" size={18} color={colors.warnText} />
            <Body style={{ flex: 1, fontSize: 13.5, color: colors.warnText, lineHeight: 19 }}>Faltam menos de 12 horas, então conta como falta no seu plano.</Body>
          </View>
        ) : null}

        <Text style={styles.legend} accessibilityRole="header">Qual o motivo?</Text>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {REASONS.map((r, i) => {
            const on = i === reason;
            return (
              <Pressable key={r} onPress={() => setReason(i)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.reason, on ? styles.reasonOn : null]}>
                <View style={[styles.radio, on ? styles.radioOn : null]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <Text style={styles.reasonText}>{r}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 16 }}>
          <Field label="Quer contar mais? (opcional)" value={note} onChangeText={setNote} multiline placeholder="Vai junto com o aviso para a equipe" />
        </View>

        <Pressable onPress={() => setRebook((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: rebook }} style={styles.check}>
          <View style={[styles.box, rebook && styles.boxOn]}>{rebook ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View>
          <Text style={styles.checkText}>Pedir um novo horário no chat</Text>
        </Pressable>

        <View style={{ gap: 10, marginTop: 18 }}>
          <Button
            label="Cancelar mesmo assim"
            variant="danger"
            loading={cancel.isPending}
            onPress={async () => {
              await cancel.mutateAsync({ id: b.id, reason: [REASONS[reason], note].filter(Boolean).join(' — ') });
              setDone(true);
            }}
          />
          <Button label="Manter compromisso" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { flex: 1, paddingHorizontal: 24 },
  warn: { flexDirection: 'row', gap: 10, padding: 14, marginTop: 14, borderRadius: radii.lg - 4, backgroundColor: colors.warnSoft },
  legend: { marginTop: 20, marginBottom: 10, fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderRadius: radii.lg - 4, backgroundColor: '#fff' },
  reasonOn: { backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#8c99b0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  reasonText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: radii.lg - 4, backgroundColor: colors.primarySoft },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#8c99b0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.primaryDeep },
});
