import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { Toast, useToast } from '@/src/design-system/Toast';
import { Badge, Button, EmptyState, Field, IconButton, Loading, Screen, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { formatMoney, quantityText, shiftMonth, todayYmd } from '@/src/features/pos/checkout';
import { METHOD_ICON, Pills, SumRow } from '@/src/features/pos/parts';
import { usePosClient, type PosClient } from '@/src/features/pos/posClient';
import { fetchWholeDay } from '@/src/features/pos/salesDay';
import { primeiroVencimentoSugerido } from '@/src/features/pos/primeiroVencimento';
import { ReceiptActions } from '@/src/features/pos/ReceiptActions';
import { locale } from '@/src/i18n';
import { apiMessage, BASE_PAYMENT_METHODS, type PosPaymentMethod, type PosSaleRow } from '@/src/shared/api/pos.api';

const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return todayYmd(x);
};
const cap = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);
const dayLabel = (ymd: string) => cap(new Intl.DateTimeFormat(locale(), { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${ymd}T12:00:00`)));
const timeOf = (iso: string) => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default function PosSalesGuarded() {
  const { t } = useTranslation('pos');
  return (
    <RequirePermission need="posRead" title={t('salesOfDay')}>
      <PosSalesScreen />
    </RequirePermission>
  );
}

function PosSalesScreen() {
  const { t } = useTranslation('pos');
  const insets = useSafeAreaInsets();
  const client = usePosClient();
  const { mode } = useAuth();
  const { toast, show } = useToast(2800);
  const today = todayYmd();
  const [day, setDay] = useState(today);
  const [open, setOpen] = useState<PosSaleRow | null>(null);

  const sales = useQuery({ queryKey: ['pos', 'sales', mode, day], queryFn: () => fetchWholeDay(client, day) });
  const rows = sales.data?.rows ?? [];
  const valid = rows.filter((r) => r.status !== 'voided');
  const sum = valid.reduce((s, r) => s + r.amount, 0);

  return (
    <Screen>
      <TopBar safe title={t('salesOfDay')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/pdv' as never))} />
      <View style={styles.dayBar}>
        <IconButton icon="chevron-back" onPress={() => setDay((d) => addDays(d, -1))} accessibilityLabel={t('sales.prev')} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.dayTitle}>{day === today ? t('sales.today') : day === addDays(today, -1) ? t('sales.yesterday') : dayLabel(day)}</Text>
          {day === today || day === addDays(today, -1) ? <Text style={styles.daySub}>{dayLabel(day)}</Text> : null}
        </View>
        <IconButton icon="chevron-forward" onPress={() => setDay((d) => (d < today ? addDays(d, 1) : d))} accessibilityLabel={t('sales.next')} />
      </View>

      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>{t('sales.count', { count: valid.length })}</Text>
          <Text style={styles.summaryValue}>{formatMoney(sum)}</Text>
        </View>
        <Ionicons name="trending-up" size={28} color={colors.cyan} />
      </View>

      {sales.isPending ? (
        <SkeletonList variant="contact" />
      ) : sales.isError ? (
        <EmptyState icon="cloud-offline-outline" title={t('sales.failed')} />
      ) : rows.length === 0 ? (
        <EmptyState icon="receipt-outline" title={t('sales.empty')} subtitle={t('sales.emptyHint')} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={sales.isRefetching} onRefresh={() => void sales.refetch()} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          renderItem={({ item }) => <SaleRow sale={item} onPress={() => setOpen(item)} />}
        />
      )}

      {open ? <SaleDetail client={client} sale={open} onClose={() => setOpen(null)} onMessage={show} /> : null}
      <Toast toast={toast} top={insets.top + 64} />
    </Screen>
  );
}

function statusBadge(status: PosSaleRow['status'], t: (k: 'sales.voided' | 'sales.refunded' | 'sales.partiallyRefunded') => string) {
  if (status === 'voided') return <Badge label={t('sales.voided')} tone="danger" />;
  if (status === 'refunded') return <Badge label={t('sales.refunded')} tone="warn" />;
  if (status === 'partially_refunded') return <Badge label={t('sales.partiallyRefunded')} tone="warn" />;
  return null;
}

function SaleRow({ sale, onPress }: { sale: PosSaleRow; onPress: () => void }) {
  const { t } = useTranslation('pos');
  const voided = sale.status === 'voided';
  // Peso (quantidade quebrada) não vira "2,4048×": a lista mostra só o nome; o detalhe traz o peso.
  const items = sale.items.map((i) => (Number.isInteger(i.quantity) && i.quantity !== 1 ? `${quantityText(i.quantity)}× ${i.name}` : i.name)).join(', ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.rowPress }]}>
      <View style={styles.rowTime}>
        <Text style={styles.rowTimeText}>{timeOf(sale.created_at)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {sale.contact_name ?? t('sales.walkIn')}
          </Text>
          {statusBadge(sale.status, t)}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sale.human_number ? `${sale.human_number} · ` : ''}
          {items}
        </Text>
      </View>
      <Text style={[styles.rowValue, voided && { textDecorationLine: 'line-through', color: colors.textMuted }]}>{formatMoney(sale.amount)}</Text>
    </Pressable>
  );
}

type Panel = 'main' | 'fix' | 'void';

function SaleDetail({ client, sale, onClose, onMessage }: { client: PosClient; sale: PosSaleRow; onClose: () => void; onMessage: (m: string, tone?: 'success' | 'error' | 'info') => void }) {
  const { t } = useTranslation('pos');
  const can = useCan();
  const qc = useQueryClient();
  const { mode } = useAuth();
  const [panel, setPanel] = useState<Panel>('main');
  const receipt = useQuery({ queryKey: ['pos', 'receipt', mode, sale.id], queryFn: () => client.receipt(sale.id) });
  const payment = useQuery({ queryKey: ['pos', 'payment', mode, sale.id], queryFn: () => client.salePayment(sale.id), enabled: can('posPaymentEdit') && sale.status === 'completed' });
  const r = receipt.data;
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['pos', 'sales'] });
    void qc.invalidateQueries({ queryKey: ['pos', 'receipt', mode, sale.id] });
    void qc.invalidateQueries({ queryKey: ['pos', 'payment', mode, sale.id] });
    onMessage(msg);
    onClose();
  };
  const number = sale.human_number ?? sale.id.slice(0, 8);

  return (
    <BottomSheet visible onClose={onClose} title={t('sales.detail', { number })}>
      {panel === 'main' ? (
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 14 }}>
          {receipt.isPending ? (
            <Loading />
          ) : r ? (
            <>
              <View style={styles.block}>
                <Text style={styles.blockLabel}>{t('sales.items')}</Text>
                {r.items.map((i, idx) => (
                  <SumRow key={idx} label={`${quantityText(i.quantity)} × ${i.name}`} value={formatMoney(i.line_total)} />
                ))}
                {r.discount_amount > 0 ? <SumRow label={t('checkout.discount')} value={`− ${formatMoney(r.discount_amount)}`} tone="success" /> : null}
                <SumRow label={t('checkout.total')} value={formatMoney(r.amount)} strong />
              </View>
              <View style={styles.block}>
                <Text style={styles.blockLabel}>{t('sales.payment')}</Text>
                {r.payments.map((p, idx) => (
                  <SumRow key={idx} label={t(`methods.${p.method as PosPaymentMethod}`, { defaultValue: p.method })} value={formatMoney(p.amount_cents / 100)} />
                ))}
                {r.installments.map((p) => (
                  <SumRow key={p.number} label={`${p.number}ª · ${new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit' }).format(new Date(`${p.due_date}T12:00:00`))}`} value={formatMoney(p.amount_cents / 100)} tone="muted" />
                ))}
              </View>
            </>
          ) : null}

          {sale.status !== 'voided' ? (
            <>
              <Text style={styles.blockLabel}>{t('sales.resend')}</Text>
              <ReceiptActions client={client} saleId={sale.id} contact={sale.contact_id ? { id: sale.contact_id, name: sale.contact_name ?? '' } : null} onMessage={(m, tone) => onMessage(m, tone)} />
            </>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {can('posPaymentEdit') && sale.status === 'completed' ? (
              <Button label={t('sales.fixPayment')} icon="swap-horizontal-outline" variant="secondary" compact style={{ flex: 1 }} onPress={() => setPanel('fix')} />
            ) : null}
            {can('posVoid') && sale.status === 'completed' ? (
              <Button label={t('sales.void')} icon="close-circle-outline" variant="danger" compact style={{ flex: 1 }} onPress={() => setPanel('void')} />
            ) : null}
          </View>
        </ScrollView>
      ) : panel === 'fix' ? (
        // O formulário só monta com a forma atual em mãos: os campos nascem dela e não se sincronizam depois.
        payment.isPending ? (
          <Loading />
        ) : (
          <FixPayment client={client} sale={sale} snapshot={payment.data ?? null} onBack={() => setPanel('main')} onDone={() => done(t('sales.fixed'))} />
        )
      ) : (
        <VoidSale client={client} sale={sale} number={number} onBack={() => setPanel('main')} onDone={() => done(t('sales.voided_ok'))} />
      )}
    </BottomSheet>
  );
}

function FixPayment({
  client,
  sale,
  snapshot,
  onBack,
  onDone,
}: {
  client: PosClient;
  sale: PosSaleRow;
  snapshot: Awaited<ReturnType<PosClient['salePayment']>> | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('pos');
  const [method, setMethod] = useState<PosPaymentMethod>(snapshot?.method && snapshot.method !== 'mixed' ? snapshot.method : 'cash');
  const [installments, setInstallments] = useState(snapshot?.installments || 1);
  const [firstDue, setFirstDue] = useState(snapshot?.first_due_date ?? primeiroVencimentoSugerido());
  const save = useMutation({
    mutationFn: () =>
      client.updatePayment(sale.id, {
        method,
        ...(method === 'on_account' ? { contact_id: sale.contact_id ?? undefined, installments, first_due_date: firstDue } : {}),
      }),
    onSuccess: onDone,
  });
  if (snapshot && !snapshot.editable) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.warn}>{t('sales.fixBlocked', { reason: snapshot.blocked_reason ?? '' })}</Text>
        <Button label={t('signup.back')} variant="secondary" onPress={onBack} />
      </View>
    );
  }
  const methods: PosPaymentMethod[] = [...BASE_PAYMENT_METHODS, ...(sale.contact_id ? (['on_account'] as const) : [])];
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.blockLabel}>{t('sales.fixTitle')}</Text>
      <Pills options={methods.map((m) => ({ value: m, label: t(`methods.${m}`), icon: METHOD_ICON[m] }))} value={method} onChange={setMethod} label={t('sales.fixTitle')} />
      {method === 'on_account' ? (
        <View style={styles.block}>
          <View style={styles.stepRow}>
            <Text style={styles.rowTitle}>{t('checkout.installments')}</Text>
            <View style={styles.stepper}>
              <IconButton icon="remove" size={34} onPress={() => setInstallments((n) => Math.max(1, n - 1))} accessibilityLabel="−" />
              <Text style={styles.stepValue}>{installments}×</Text>
              <IconButton icon="add" size={34} onPress={() => setInstallments((n) => Math.min(24, n + 1))} accessibilityLabel="+" />
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.rowTitle}>{t('checkout.firstDue')}</Text>
            <View style={styles.stepper}>
              <IconButton icon="chevron-back" size={34} onPress={() => setFirstDue((d) => shiftMonth(d, -1))} accessibilityLabel={t('checkout.earlier')} />
              <Text style={styles.stepValue}>{new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short' }).format(new Date(`${firstDue}T12:00:00`))}</Text>
              <IconButton icon="chevron-forward" size={34} onPress={() => setFirstDue((d) => shiftMonth(d, 1))} accessibilityLabel={t('checkout.later')} />
            </View>
          </View>
        </View>
      ) : null}
      {save.isError ? <Text style={styles.warn}>{apiMessage(save.error) ?? t('checkout.failed')}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={t('signup.back')} variant="ghost" onPress={onBack} compact style={{ flex: 0 }} />
        <Button label={t('sales.fixSave')} icon="checkmark" loading={save.isPending} onPress={() => save.mutate()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function VoidSale({ client, sale, number, onBack, onDone }: { client: PosClient; sale: PosSaleRow; number: string; onBack: () => void; onDone: () => void }) {
  const { t } = useTranslation('pos');
  const [reason, setReason] = useState('');
  const run = useMutation({ mutationFn: () => client.voidSale(sale.id, reason.trim()), onSuccess: onDone });
  const ok = reason.trim().length >= 3;
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.voidHead}>
        <Ionicons name="warning-outline" size={22} color={colors.dangerText} />
        <Text style={[styles.rowTitle, { flex: 1 }]}>{t('sales.voidTitle', { number })}</Text>
        <Text style={styles.rowValue}>{formatMoney(sale.amount)}</Text>
      </View>
      <Field label={t('sales.voidReason')} value={reason} onChangeText={setReason} multiline />
      {run.isError ? <Text style={styles.warn}>{apiMessage(run.error) ?? t('sales.voidFailed')}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={t('sales.voidKeep')} variant="ghost" onPress={onBack} style={{ flex: 1 }} />
        <Button label={t('sales.voidConfirm')} variant="danger" loading={run.isPending} disabled={!ok} onPress={() => run.mutate()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  dayTitle: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.text },
  daySub: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted },
  summary: { marginHorizontal: 16, marginTop: 12, marginBottom: 12, padding: 18, borderRadius: radii.xl, backgroundColor: colors.chromeNavy, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadows.hero },
  summaryLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.cyan, letterSpacing: 1, textTransform: 'uppercase' },
  summaryValue: { fontFamily: typography.fontFamilyBold, fontSize: 30, color: '#fff', letterSpacing: -0.8, fontVariant: ['tabular-nums'], marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderSoft },
  rowTime: { width: 52, height: 40, borderRadius: 12, backgroundColor: '#f1f4fa', alignItems: 'center', justifyContent: 'center' },
  rowTimeText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textSoft, fontVariant: ['tabular-nums'] },
  rowTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text, flexShrink: 1 },
  rowSub: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted },
  rowValue: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  block: { padding: 14, borderRadius: radii.lg, backgroundColor: '#f6f8fc', gap: 2 },
  blockLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  warn: { fontFamily: typography.fontFamilyMedium, fontSize: 13.5, color: colors.dangerText },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepValue: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text, minWidth: 54, textAlign: 'center', fontVariant: ['tabular-nums'] },
  voidHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerSoft },
});
