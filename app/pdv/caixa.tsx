import { LoadError } from '@/src/design-system/OfflineState';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Toast, useToast } from '@/src/design-system/Toast';
import { Button, Card, Chip, EmptyState, Field, Loading, Muted, Screen, TopBar } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { formatMoney, keypadNumber, keypadPress } from '@/src/features/pos/checkout';
import { Keypad } from '@/src/features/pos/parts';
import { usePosClient } from '@/src/features/pos/posClient';
import { locale } from '@/src/i18n';
import { apiMessage, type PosShiftSummary } from '@/src/shared/api/pos.api';

const cents = (c: number) => formatMoney(c / 100);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

export default function CashierScreenGuarded() {
  const { t } = useTranslation('pos');
  return (
    <RequirePermission need="posRead" title={t('cashier.title')}>
      <CashierScreen />
    </RequirePermission>
  );
}

/** O caixa pelo celular: abrir com o dinheiro da gaveta, acompanhar, fazer sangria e suprimento e fechar com a conferência. */
function CashierScreen() {
  const { t } = useTranslation('pos');
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const client = usePosClient();
  const { mode } = useAuth();
  const can = useCan();
  const { toast, show } = useToast(2600);

  const boot = useQuery({ queryKey: ['pos', 'bootstrap', mode], queryFn: () => client.bootstrap() });
  const registers = boot.data?.registers ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const registerId = picked ?? boot.data?.default_register_id ?? registers[0]?.id ?? null;
  const usesShift = boot.data?.settings?.shifts_enabled === true;

  const current = useQuery({ queryKey: ['pos', 'shift', mode, registerId], queryFn: () => client.currentShift(registerId!), enabled: usesShift && !!registerId });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['pos', 'shift'] }), qc.invalidateQueries({ queryKey: ['pos', 'bootstrap'] })]);

  const [sheet, setSheet] = useState<null | 'cash_in' | 'cash_out' | 'close'>(null);
  const [closed, setClosed] = useState<PosShiftSummary | null>(null);
  const shift = current.data ?? null;

  return (
    <Screen>
      <TopBar safe title={t('cashier.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/pdv' as never))} />
      {boot.isLoading || (usesShift && current.isLoading) ? (
        <Loading />
      ) : boot.isError || current.isError ? (
        <LoadError error={boot.error ?? current.error} title={t('cashier.loadFail')} onRetry={() => void refresh()} />
      ) : !usesShift ? (
        <EmptyState icon="information-circle-outline" title={t('cashier.notUsed')} />
      ) : !registerId ? (
        <EmptyState icon="storefront-outline" title={t('cashier.noRegister')} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          {registers.length > 1 && !shift ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('cashier.pickRegister')}</Text>
              <View style={styles.wrap}>
                {registers.map((r) => (
                  <Chip key={r.id} label={r.name} selected={registerId === r.id} onPress={() => setPicked(r.id)} />
                ))}
              </View>
            </View>
          ) : null}

          {closed ? (
            <ClosedResult summary={closed} onDone={() => setClosed(null)} />
          ) : shift ? (
            <OpenShift shift={shift} canMove={can('posCashMovement')} canClose={can('posShiftsClose')} onMove={setSheet} onClose={() => setSheet('close')} />
          ) : (
            <OpenForm
              registerId={registerId}
              canOpen={can('posShiftsOpen')}
              onOpened={() => {
                show(t('shift.opened'));
                void refresh();
              }}
              client={client}
            />
          )}
        </ScrollView>
      )}

      {shift && sheet && sheet !== 'close' ? (
        <MovementSheet
          type={sheet}
          onClose={() => setSheet(null)}
          onSave={async (amount, reason) => {
            await client.cashMovement(shift.id, { type: sheet, amount, reason });
            show(t('cashier.movementDone'));
            setSheet(null);
            await refresh();
          }}
        />
      ) : null}
      {shift && sheet === 'close' ? (
        <CloseSheet
          shift={shift}
          onClose={() => setSheet(null)}
          onConfirm={async (counted) => {
            const sum = await client.closeShift(shift.id, counted);
            setSheet(null);
            setClosed(sum);
            await refresh();
          }}
        />
      ) : null}
      <Toast toast={toast} />
    </Screen>
  );
}

function OpenForm({ client, registerId, canOpen, onOpened }: { client: ReturnType<typeof usePosClient>; registerId: string; canOpen: boolean; onOpened: () => void }) {
  const { t } = useTranslation('pos');
  const [raw, setRaw] = useState('');
  const open = useMutation({ mutationFn: () => client.openShift(registerId, keypadNumber(raw) ?? 0), onSuccess: onOpened });
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.closedCard}>
        <Ionicons name="lock-closed-outline" size={22} color={colors.warnText} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t('cashier.closedTitle')}</Text>
          <Muted style={{ lineHeight: 19 }}>{canOpen ? t('cashier.closedText') : t('cashier.noOpenPermission')}</Muted>
        </View>
      </View>
      {canOpen ? (
        <>
          <View style={styles.display}>
            <Text style={styles.label}>{t('shift.openingCash')}</Text>
            <Text style={styles.displayText}>R$ {raw || '0'}</Text>
          </View>
          <Keypad decimals={2} onKey={(k) => setRaw((v) => keypadPress(v, k, 2, 6))} />
          {open.isError ? <Text style={styles.error}>{apiMessage(open.error) ?? t('shift.failed')}</Text> : null}
          <Button label={t('shift.openButton')} icon="lock-open-outline" loading={open.isPending} onPress={() => open.mutate()} />
        </>
      ) : null}
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && { fontFamily: typography.fontFamilyBold, color: colors.text }]}>{label}</Text>
      <Text style={[styles.lineValue, strong && { fontFamily: typography.fontFamilyBold, fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

function OpenShift({ shift, canMove, canClose, onMove, onClose }: { shift: PosShiftSummary; canMove: boolean; canClose: boolean; onMove: (t: 'cash_in' | 'cash_out') => void; onClose: () => void }) {
  const { t } = useTranslation('pos');
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>{t('cashier.expected')}</Text>
        <Text style={styles.heroValue}>{cents(shift.expected_cash_cents)}</Text>
        <Text style={styles.heroSub}>{`${shift.register_name ?? ''} · ${t('cashier.openedBy', { name: shift.opened_by_name ?? '—', time: timeOf(shift.opened_at) })}`}</Text>
      </View>

      {canMove ? (
        <View style={styles.actions}>
          <Button label={t('cashier.cashInAction')} icon="add-circle-outline" variant="secondary" onPress={() => onMove('cash_in')} style={{ flex: 1 }} />
          <Button label={t('cashier.cashOutAction')} icon="remove-circle-outline" variant="secondary" onPress={() => onMove('cash_out')} style={{ flex: 1 }} />
        </View>
      ) : null}

      <Card style={{ gap: 2 }}>
        <Line label={t('cashier.openingCash')} value={cents(shift.opening_cash_cents)} />
        <Line label={t('cashier.cashSales')} value={cents(shift.cash_sales_cents)} />
        {shift.receivable_cash_cents ? <Line label={t('cashier.receivableCash')} value={cents(shift.receivable_cash_cents)} /> : null}
        {shift.cash_in_cents ? <Line label={t('cashier.cashIn')} value={`+ ${cents(shift.cash_in_cents)}`} /> : null}
        {shift.cash_out_cents ? <Line label={t('cashier.cashOut')} value={`− ${cents(shift.cash_out_cents)}`} /> : null}
        <Line label={t('cashier.expected')} value={cents(shift.expected_cash_cents)} strong />
      </Card>

      <Card style={{ gap: 2 }}>
        <Line label={t('cashier.sales')} value={`${shift.sales_count} · ${cents(shift.sales_total_cents)}`} strong />
        {(shift.totals_by_method ?? []).map((m) => (
          <Line key={m.method} label={t(`methods.${m.method}` as 'methods.cash', { defaultValue: m.method })} value={cents(m.total_cents)} />
        ))}
      </Card>

      {canClose ? <Button label={t('cashier.closeAction')} icon="lock-closed-outline" variant="danger" onPress={onClose} /> : <Muted style={{ textAlign: 'center' }}>{t('cashier.noClosePermission')}</Muted>}
    </View>
  );
}

function ClosedResult({ summary, onDone }: { summary: PosShiftSummary; onDone: () => void }) {
  const { t } = useTranslation('pos');
  const diff = summary.difference_cents ?? 0;
  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.hero, { backgroundColor: diff === 0 ? colors.success : diff > 0 ? colors.primary : colors.danger }]}>
        <Text style={styles.heroKicker}>{t('cashier.closedDone')}</Text>
        <Text style={styles.heroValue}>{diff === 0 ? t('cashier.diffOk') : diff > 0 ? t('cashier.diffOver', { value: cents(diff) }) : t('cashier.diffShort', { value: cents(Math.abs(diff)) })}</Text>
      </View>
      <Card style={{ gap: 2 }}>
        <Line label={t('cashier.expected')} value={cents(summary.expected_cash_cents)} />
        <Line label={t('cashier.counted')} value={cents(summary.counted_cash_cents ?? 0)} />
        <Line label={t('cashier.sales')} value={`${summary.sales_count} · ${cents(summary.sales_total_cents)}`} />
      </Card>
      <Button label={t('cashier.openAgain')} variant="secondary" onPress={onDone} />
      <Button label={t('cashier.back')} variant="ghost" onPress={() => router.replace('/pdv' as never)} />
    </View>
  );
}

/** Sangria ou suprimento: valor e motivo (o motivo é obrigatório e aparece no fechamento). */
function MovementSheet({ type, onClose, onSave }: { type: 'cash_in' | 'cash_out'; onClose: () => void; onSave: (amount: number, reason: string) => Promise<void> }) {
  const { t } = useTranslation('pos');
  const [raw, setRaw] = useState('');
  const [reason, setReason] = useState('');
  const amount = keypadNumber(raw) ?? 0;
  const save = useMutation({ mutationFn: () => onSave(amount, reason.trim()) });
  const ok = amount > 0 && reason.trim().length >= 3;
  return (
    <BottomSheet
      visible
      onClose={save.isPending ? () => {} : onClose}
      title={type === 'cash_in' ? t('cashier.cashInAction') : t('cashier.cashOutAction')}
      footer={
        <>
          {save.isError ? <Text style={styles.error}>{apiMessage(save.error) ?? t('cashier.movementFail')}</Text> : null}
          <Button label={t('cashier.register')} icon="checkmark" loading={save.isPending} disabled={!ok} onPress={() => save.mutate()} />
        </>
      }
    >
      <View style={{ gap: 12 }}>
        <Muted>{type === 'cash_in' ? t('cashier.cashInHint') : t('cashier.cashOutHint')}</Muted>
        <View style={styles.display}>
          <Text style={styles.label}>{t('cashier.amount')}</Text>
          <Text style={styles.displayText}>R$ {raw || '0'}</Text>
        </View>
        <Keypad decimals={2} onKey={(k) => setRaw((v) => keypadPress(v, k, 2, 6))} />
        <Field label={t('cashier.reason')} value={reason} onChangeText={setReason} placeholder={t('cashier.reasonHint')} maxLength={300} />
      </View>
    </BottomSheet>
  );
}

/** Fechar: o operador conta a gaveta, digita o valor e vê o esperado antes de confirmar. */
function CloseSheet({ shift, onClose, onConfirm }: { shift: PosShiftSummary; onClose: () => void; onConfirm: (counted: number) => Promise<void> }) {
  const { t } = useTranslation('pos');
  const [raw, setRaw] = useState('');
  const counted = keypadNumber(raw);
  const run = useMutation({ mutationFn: () => onConfirm(counted ?? 0) });
  return (
    <BottomSheet
      visible
      onClose={run.isPending ? () => {} : onClose}
      title={t('cashier.closeTitle')}
      footer={
        <>
          {run.isError ? <Text style={styles.error}>{apiMessage(run.error) ?? t('cashier.closeFail')}</Text> : null}
          <Button label={t('cashier.closeConfirm')} icon="lock-closed-outline" variant="danger" loading={run.isPending} disabled={counted === null} onPress={() => run.mutate()} />
        </>
      }
    >
      <View style={{ gap: 12 }}>
        <Muted style={{ lineHeight: 19 }}>{t('cashier.closeHint')}</Muted>
        <View style={styles.display}>
          <Text style={styles.label}>{t('cashier.counted')}</Text>
          <Text style={styles.displayText}>R$ {raw || '0'}</Text>
          <Text style={styles.expectedLine}>{t('cashier.expectedLine', { value: cents(shift.expected_cash_cents) })}</Text>
        </View>
        <Keypad decimals={2} onKey={(k) => setRaw((v) => keypadPress(v, k, 2, 6))} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  closedCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.warnSoft },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  display: { alignItems: 'flex-end', padding: 14, borderRadius: radii.lg, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, gap: 2 },
  displayText: { fontFamily: typography.fontFamilyBold, fontSize: 34, color: colors.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  expectedLine: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: colors.textMuted },
  hero: { padding: 20, borderRadius: radii.xl, backgroundColor: colors.chromeNavy, gap: 2 },
  heroKicker: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.cyan, letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { fontFamily: typography.fontFamilyBold, fontSize: 34, color: '#fff', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  heroSub: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: '#ffffffb3', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 7 },
  lineLabel: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 14, color: colors.textSoft },
  lineValue: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  error: { fontFamily: typography.fontFamilyMedium, fontSize: 13.5, color: colors.dangerText },
});
