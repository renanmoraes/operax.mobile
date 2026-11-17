import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, IconName, PressableScale } from '@/src/design-system/ui';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import type { BookingAction } from '@/src/shared/api/bookings.api';
import { actionLabel, ACTION_PERM, actionsFor, BookingDetails, phoneLabel } from './bookingDetails';
import { useCan } from '@/src/features/auth/useCan';
import { clockLabel } from './timeline';

const STATUS: Record<'confirmed' | 'pending' | 'completed' | 'done' | 'cancelled' | 'rejected' | 'no_show', { bg: string; fg: string }> = {
  confirmed: { bg: colors.successSoft, fg: colors.success },
  pending: { bg: colors.warnSoft, fg: colors.warnText },
  completed: { bg: '#eef1f6', fg: colors.textSoft },
  done: { bg: '#eef1f6', fg: colors.textSoft },
  cancelled: { bg: colors.dangerSoft, fg: colors.dangerText },
  rejected: { bg: colors.dangerSoft, fg: colors.dangerText },
  no_show: { bg: colors.dangerSoft, fg: colors.dangerText },
};

const OTHER_STATUS = ['checked_in', 'in_progress', 'waitlisted', 'offered', 'expired'];
const DESTRUCTIVE: BookingAction[] = ['cancel', 'reject', 'no_show'];

/**
 * Ficha do agendamento (como ao abrir na agenda do Operax web): quem é, o quê, quando,
 * particular ou convênio, recados, avisos e as ações que valem para a situação.
 */
export function BookingDetailSheet({
  visible,
  onClose,
  details,
  startMin,
  endMin,
  dateLabel,
  busy,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  details: BookingDetails | null;
  startMin: number;
  endMin: number;
  dateLabel: string;
  busy: BookingAction | null;
  onAction: (action: BookingAction, opts?: { payment_type?: 'private' }) => void;
}) {
  const { t } = useTranslation('agenda');
  const [confirming, setConfirming] = useState<BookingAction | null>(null);
  const can = useCan();
  if (!details) return null;
  const known = details.status in STATUS ? STATUS[details.status as keyof typeof STATUS] : null;
  const st = known
    ? { ...known, label: t(`agenda.status.${details.status as keyof typeof STATUS}`) }
    : { label: t(OTHER_STATUS.includes(details.status) ? (`agenda.status.${details.status}` as 'agenda.status.checked_in') : 'agenda.statusOther'), bg: colors.primaryWash, fg: colors.primaryDeep };
  const actions = actionsFor(details.status).filter((a) => can(ACTION_PERM[a]));
  const minutes = endMin - startMin;
  const phone = phoneLabel(details.phone);
  const digits = details.phone?.replace(/\D/g, '') ?? '';

  const close = () => {
    setConfirming(null);
    onClose();
  };

  const run = (a: BookingAction) => {
    if (DESTRUCTIVE.includes(a) && confirming !== a) {
      setConfirming(a);
      return;
    }
    setConfirming(null);
    // Sem particular/convênio registrado, a entrada vai como particular (convênio se informa no web).
    onAction(a, a === 'check_in' && !details.paymentKnown ? { payment_type: 'private' } : undefined);
  };

  return (
    <BottomSheet visible={visible} onClose={close} closeLabel={t('sheet.close')}>
      <View style={{ gap: 16, paddingBottom: 4 }}>
        {/* Quem e situação */}
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(details.client)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.client} accessibilityRole="header">
              {details.client}
            </Text>
            <View style={styles.chips}>
              <Chip label={st.label} bg={st.bg} fg={st.fg} />
              {details.visit ? <Chip label={details.visit} bg="#eef1f6" fg={colors.textSoft} /> : null}
              {details.encaixe ? <Chip label={t('sheet.encaixe')} bg="#fff1e2" fg="#c2410c" /> : null}
            </View>
          </View>
        </View>

        {/* Quando */}
        <View style={styles.when}>
          <View style={{ flex: 1 }}>
            <Text style={styles.whenTime}>{`${clockLabel(startMin)} – ${clockLabel(endMin)}`}</Text>
            <Text style={styles.whenDate}>{dateLabel}</Text>
          </View>
          <View style={styles.duration}>
            <Text style={styles.durationText}>{minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ''}` : `${minutes} min`}</Text>
          </View>
        </View>

        {/* Detalhes */}
        <View style={styles.list}>
          <Row icon="person-outline" label={t('sheet.provider')} value={[details.provider, details.service].filter(Boolean).join(' · ') || '—'} />
          <Row icon="card-outline" label={t('sheet.coverage')} value={details.payment ?? t('sheet.coverageUnknown')} muted={!details.payment} />
          {details.location ? <Row icon="location-outline" label={t('sheet.location')} value={details.location} /> : null}
          {phone ? (
            <Row
              icon="call-outline"
              label={t('sheet.phone')}
              value={phone}
              right={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <MiniBtn icon="call" label={t('sheet.call')} onPress={() => void Linking.openURL(`tel:+${digits}`)} />
                  <MiniBtn icon="logo-whatsapp" label="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${digits}`)} />
                </View>
              }
            />
          ) : null}
          {details.requestedBy ? <Row icon="chatbubble-ellipses-outline" label={t('sheet.requestedBy')} value={details.requestedBy} /> : null}
          {details.reminders.length ? <Row icon="notifications-outline" label={t('sheet.reminders')} value={details.reminders.join(' · ')} last /> : null}
        </View>

        {details.customerNote ? <Note title={t('sheet.customerNote')} body={details.customerNote} /> : null}
        {details.staffNotes ? <Note title={t('sheet.staffNotes')} body={details.staffNotes} /> : null}

        {details.encaixe ? <Alert tone="warn" title={t('sheet.encaixe')} body={details.encaixe} /> : null}
        {details.semLembrete ? <Alert tone="danger" title={t('sheet.noReminder')} body={details.semLembrete} /> : null}
        {details.series ? <Alert tone="info" title={t('sheet.series')} body={details.series} /> : null}
        {details.rescheduleReason ? <Alert tone="info" title={t('sheet.lastReschedule')} body={details.rescheduleReason} /> : null}

        {details.contactId && can('contacts') ? (
          <Button
            label={t('sheet.viewContact')}
            variant="secondary"
            icon="person-circle-outline"
            onPress={() => {
              close();
              router.push(`/contact/${details.contactId}`);
            }}
          />
        ) : null}

        {actions.length ? (
          <View style={{ gap: 10 }}>
            {actions.map((a, i) => {
              const destructive = DESTRUCTIVE.includes(a);
              const label =
                confirming === a
                  ? t('sheet.tapAgain', { action: actionLabel(a).toLowerCase() })
                  : a === 'check_in' && !details.paymentKnown
                    ? t('sheet.checkInPrivate')
                    : actionLabel(a);
              return (
                <Button
                  key={a}
                  label={label}
                  variant={i === 0 && !destructive ? 'primary' : destructive ? (confirming === a ? 'danger' : 'ghost') : 'secondary'}
                  loading={busy === a}
                  disabled={!!busy && busy !== a}
                  onPress={() => run(a)}
                />
              );
            })}
            {actions.includes('check_in') && !details.paymentKnown ? <Text style={styles.hint}>{t('sheet.insuranceHint')}</Text> : null}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value, muted, right, last }: { icon: IconName; label: string; value: string; muted?: boolean; right?: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, muted && { color: colors.textMuted, fontFamily: typography.fontFamily }]}>{value}</Text>
      </View>
      {right}
    </View>
  );
}

function MiniBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.mini}>
      <Ionicons name={icon} size={16} color={colors.primary} />
    </PressableScale>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={styles.noteBody}>{body}</Text>
    </View>
  );
}

const ALERT = {
  warn: { bg: '#fff6ee', border: '#fdd9bf', fg: '#9a3412', icon: 'flash-outline' as IconName },
  danger: { bg: '#fdf1f1', border: '#f6c9c9', fg: colors.dangerText, icon: 'notifications-off-outline' as IconName },
  info: { bg: colors.primaryWash, border: colors.primaryTint, fg: colors.primaryDeep, icon: 'repeat-outline' as IconName },
};

function Alert({ tone, title, body }: { tone: keyof typeof ALERT; title: string; body: string }) {
  const t = ALERT[tone];
  return (
    <View style={[styles.alert, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Ionicons name={t.icon} size={16} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: t.fg }]}>{title}</Text>
        <Text style={[styles.alertBody, { color: t.fg }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.primary },
  client: { ...text.headline, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  chipText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.primaryWash },
  whenTime: { fontFamily: typography.fontFamilySemiBold, fontSize: 22, letterSpacing: -0.5, color: colors.primaryDeep, fontVariant: ['tabular-nums'] },
  whenDate: { ...text.callout, color: colors.textSoft, marginTop: 2 },
  duration: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center' },
  durationText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary, fontVariant: ['tabular-nums'] },
  list: { borderRadius: radii.lg, backgroundColor: '#f8fafd', paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...text.label, color: colors.textMuted },
  rowValue: { ...text.bodyStrong, color: colors.text, marginTop: 1 },
  mini: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryTint },
  note: { paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: colors.primaryTint, gap: 3 },
  noteTitle: { ...text.label, color: colors.textMuted },
  noteBody: { ...text.body, color: colors.text },
  alert: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radii.md, borderWidth: 1 },
  alertTitle: { ...text.captionStrong },
  alertBody: { ...text.caption, marginTop: 1 },
  hint: { ...text.caption, color: colors.textMuted, textAlign: 'center' },
});
