import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { Badge, Button, Card, Chip, Field, Loading, Muted, StatStrip } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useCan } from '@/src/features/auth/useCan';
import { apiMessage, fetchContactCredit } from '@/src/shared/api/pos.api';
import {
  cancelReceivable, fetchContactReceipts, fetchContactReceivables, fetchInstallmentPurchase, isActive, isOverdue, receiveInstallment, receiveInstallments,
  restoreReceivable, settleWithDiscount, type InstallmentMethod, type Receivable,
} from '@/src/shared/api/receivables.api';
import { brl, dayLabel, stampLabel } from '../format';
import { MoneyField } from '../MoneyField';
import { GroupLabel, QueryState } from '../parts';

type Filter = 'open' | 'overdue' | 'paid' | 'cancelled';
const METHODS: InstallmentMethod[] = ['cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer', 'other'];
const KEY = (id: string) => ['pos', 'receivables', 'contact', id];

export function CrediarioSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const can = useCan();
  const qc = useQueryClient();
  const canReceive = can('pos:receivables_manage');
  const canCancel = can('pos:receivables_cancel');
  const canDiscount = can('pos:receivables_discount');
  const [filter, setFilter] = useState<Filter>('open');
  const [picked, setPicked] = useState<Receivable | null>(null);
  const [mode, setMode] = useState<null | { kind: 'receive' | 'discount' | 'cancel' | 'purchase'; p: Receivable }>(null);
  const [selecting, setSelecting] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [receivingMany, setReceivingMany] = useState(false);

  const q = useQuery({ queryKey: KEY(contactId), queryFn: () => fetchContactReceivables(contactId), staleTime: 30_000 });
  const creditQ = useQuery({ queryKey: ['pos', 'receivables', 'credit', contactId], queryFn: () => fetchContactCredit(contactId), staleTime: 30_000 });
  const receiptsQ = useQuery({ queryKey: ['pos', 'receivables', 'receipts', contactId], queryFn: () => fetchContactReceipts(contactId), staleTime: 30_000 });
  const all = useMemo(() => q.data ?? [], [q.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['pos', 'receivables'] });
  };

  const counts = useMemo(
    () => ({ open: all.filter(isActive).length, overdue: all.filter(isOverdue).length, paid: all.filter((p) => p.status === 'paid').length, cancelled: all.filter((p) => p.status === 'cancelled').length }),
    [all],
  );
  const active: Filter = filter === 'cancelled' && counts.cancelled === 0 ? 'open' : filter;
  const list = useMemo(() => {
    const keep = all.filter((p) => (active === 'open' ? isActive(p) : active === 'overdue' ? isOverdue(p) : active === 'paid' ? p.status === 'paid' : p.status === 'cancelled'));
    return [...keep].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.installment_number - b.installment_number);
  }, [all, active]);

  const totals = useMemo(() => {
    const open = all.filter(isActive);
    const late = open.filter((p) => p.days_late > 0);
    return {
      open: open.reduce((s, p) => s + p.total_cents, 0),
      late: late.reduce((s, p) => s + p.total_cents, 0),
      charges: open.reduce((s, p) => s + p.late_fee_cents + p.interest_cents, 0),
    };
  }, [all]);

  const marks = useMemo(() => marked.map((id) => all.find((p) => p.id === id)).filter((p): p is Receivable => !!p && isActive(p)), [marked, all]);
  const markedTotal = marks.reduce((s, p) => s + p.total_cents, 0);

  const toggle = (p: Receivable) => {
    if (!isActive(p)) return;
    if (marks[0] && marks[0].contact_id !== p.contact_id) {
      void showDialog({ title: t('crediario.onlySameRegistry'), tone: 'info' });
      return;
    }
    setMarked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]));
  };

  return (
    <View style={{ gap: 14 }}>
      <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={false} emptyTitle="" onRetry={() => void q.refetch()}>
        <Card style={{ gap: 14 }}>
          <StatStrip items={[{ value: brl(totals.open), label: t('crediario.open'), accent: true }, { value: brl(totals.late), label: t('crediario.overdue') }]} />
          <StatStrip items={[{ value: brl(totals.charges), label: t('crediario.charges') }, { value: brl(creditQ.data?.balance_cents ?? 0), label: t('crediario.credit') }]} />
        </Card>

        <View style={styles.filters}>
          {(['open', 'overdue', 'paid', 'cancelled'] as const)
            .filter((f) => f !== 'cancelled' || counts.cancelled > 0)
            .map((f) => (
              <Chip key={f} label={`${t(`crediario.filter${f[0].toUpperCase()}${f.slice(1)}` as 'crediario.filterOpen')} · ${counts[f]}`} selected={active === f} onPress={() => setFilter(f)} />
            ))}
        </View>

        {canReceive && counts.open > 1 && (active === 'open' || active === 'overdue') ? (
          <Button
            label={selecting ? t('crediario.selectDone') : t('crediario.selectMode')}
            variant="ghost"
            compact
            icon={selecting ? 'checkmark' : 'checkbox-outline'}
            onPress={() => { setSelecting((s) => !s); setMarked([]); }}
          />
        ) : null}

        {list.length === 0 ? (
          <Muted style={{ textAlign: 'center', paddingVertical: 20 }}>{t(`crediario.empty${active[0].toUpperCase()}${active.slice(1)}` as 'crediario.emptyOpen')}</Muted>
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((p) => (
              <InstallmentCard
                key={p.id}
                p={p}
                registryName={p.contact_id !== contactId ? p.contact_name?.trim() || t('crediario.otherRegistry') : null}
                selecting={selecting && isActive(p)}
                marked={marked.includes(p.id)}
                onPress={() => (selecting && isActive(p) ? toggle(p) : setPicked(p))}
              />
            ))}
          </View>
        )}

        {(receiptsQ.data ?? []).length > 0 ? (
          <View style={{ gap: 8 }}>
            <GroupLabel>{t('crediario.receipts')}</GroupLabel>
            {(receiptsQ.data ?? []).slice(0, 6).map((r) => (
              <Card key={r.id} style={{ padding: 12, gap: 2 }}>
                <Text style={styles.receiptMain}>{t('crediario.receiptLine', { amount: brl(r.received_cents), date: stampLabel(r.received_at) })}</Text>
                <Muted>
                  {[t('crediario.receiptCount', { count: r.installments_count }), r.discount_cents > 0 ? t('crediario.receiptDiscount', { amount: brl(r.discount_cents) }) : null, r.reversed ? t('crediario.receiptReversed') : null].filter(Boolean).join(' · ')}
                </Muted>
              </Card>
            ))}
          </View>
        ) : null}
      </QueryState>

      {selecting && marks.length > 0 ? (
        <Button label={`${t('crediario.selected', { count: marks.length })} · ${t('crediario.receiveSelected', { amount: brl(markedTotal) })}`} onPress={() => setReceivingMany(true)} />
      ) : null}

      {picked ? (
        <ActionsSheet
          p={picked}
          canReceive={canReceive}
          canDiscount={canDiscount}
          canCancel={canCancel}
          onClose={() => setPicked(null)}
          onPick={(kind) => { setMode({ kind, p: picked }); setPicked(null); }}
          onRestored={() => { setPicked(null); refresh(); }}
        />
      ) : null}
      {mode?.kind === 'receive' ? <ReceiveSheet p={mode.p} later={all.filter((x) => isActive(x) && x.id !== mode.p.id && x.contact_id === mode.p.contact_id).length > 0} onClose={() => setMode(null)} onDone={() => { setMode(null); refresh(); }} /> : null}
      {mode?.kind === 'discount' ? <DiscountSheet p={mode.p} onClose={() => setMode(null)} onDone={() => { setMode(null); refresh(); }} /> : null}
      {mode?.kind === 'cancel' ? <CancelSheet p={mode.p} onClose={() => setMode(null)} onDone={() => { setMode(null); refresh(); }} /> : null}
      {mode?.kind === 'purchase' ? <PurchaseSheet p={mode.p} onClose={() => setMode(null)} /> : null}
      {receivingMany ? <ReceiveManySheet list={marks} onClose={() => setReceivingMany(false)} onDone={() => { setReceivingMany(false); setSelecting(false); setMarked([]); refresh(); }} /> : null}
    </View>
  );
}

function InstallmentCard({ p, registryName, selecting, marked, onPress }: { p: Receivable; registryName: string | null; selecting: boolean; marked: boolean; onPress: () => void }) {
  const { t } = useTranslation('contact');
  const active = isActive(p);
  const late = isOverdue(p);
  const charge = p.late_fee_cents + p.interest_cents;
  const tone = p.status === 'paid' ? 'success' : p.status === 'cancelled' ? 'neutral' : late ? 'danger' : p.status === 'partial' ? 'warn' : 'primary';
  return (
    <Card onPress={onPress} accessibilityLabel={`${t('crediario.installment', { n: p.installment_number, total: p.installment_total })}, ${active ? brl(p.total_cents) : brl(p.amount_cents)}`} style={[styles.card, marked && styles.cardMarked]}>
      {selecting ? <Ionicons name={marked ? 'checkbox' : 'square-outline'} size={22} color={marked ? colors.primary : colors.textMuted} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('crediario.installment', { n: p.installment_number, total: p.installment_total })}</Text>
          <Badge label={t(`crediario.status.${p.status}`)} tone={tone} />
        </View>
        <Text style={styles.line}>{t('crediario.due', { date: dayLabel(p.due_date) })}{p.purchase_date ? ` · ${t('crediario.purchase', { date: dayLabel(p.purchase_date) })}` : ''}</Text>
        {late ? <Text style={[styles.line, { color: colors.dangerText }]}>{t('crediario.lateDays', { count: p.days_late })}</Text> : null}
        {registryName ? <Text style={styles.line}>{t('crediario.fromOther', { name: registryName })}</Text> : null}
        {p.status === 'cancelled' && p.cancel_reason ? <Text style={styles.line}>{t('crediario.cancelReasonLine', { reason: p.cancel_reason })}</Text> : null}
        <View style={styles.foot}>
          <Text style={styles.amount}>{active ? t('crediario.toReceive', { amount: brl(p.total_cents) }) : t('crediario.paidOn', { amount: brl(p.amount_cents) })}</Text>
          {active && charge > 0 ? <Text style={[styles.line, { color: colors.warnText }]}>{t('crediario.charge', { amount: brl(charge) })}</Text> : null}
        </View>
      </View>
      {!selecting ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Card>
  );
}

function ActionsSheet({ p, canReceive, canDiscount, canCancel, onClose, onPick, onRestored }: {
  p: Receivable; canReceive: boolean; canDiscount: boolean; canCancel: boolean; onClose: () => void;
  onPick: (k: 'receive' | 'discount' | 'cancel' | 'purchase') => void; onRestored: () => void;
}) {
  const { t } = useTranslation('contact');
  const restore = useMutation({
    mutationFn: () => restoreReceivable(p.id),
    onSuccess: () => { void showDialog({ title: t('crediario.restoreDone'), tone: 'success' }); onRestored(); },
    onError: (e) => void showDialog({ title: t('crediario.restoreFailed'), message: apiMessage(e) ?? undefined, tone: 'warn' }),
  });
  const active = isActive(p);
  return (
    <BottomSheet visible onClose={onClose} title={t('crediario.actionsTitle', { n: p.installment_number, total: p.installment_total })}>
      <View style={{ gap: 10 }}>
        <Muted>{active ? t('crediario.toReceive', { amount: brl(p.total_cents) }) : t('crediario.paidOn', { amount: brl(p.amount_cents) })}</Muted>
        {active && canReceive ? <Button label={t('crediario.receive')} icon="cash-outline" onPress={() => onPick('receive')} /> : null}
        {active && canDiscount ? <Button label={t('crediario.discount')} variant="soft" icon="pricetag-outline" onPress={() => onPick('discount')} /> : null}
        <Button label={t('crediario.purchaseDetail')} variant="soft" icon="bag-handle-outline" onPress={() => onPick('purchase')} />
        {active && canCancel ? <Button label={t('crediario.cancel')} variant="ghost" icon="close-circle-outline" onPress={() => onPick('cancel')} /> : null}
        {p.status === 'cancelled' && p.can_restore && canCancel ? <Button label={t('crediario.restore')} variant="soft" loading={restore.isPending} onPress={() => restore.mutate()} /> : null}
      </View>
    </BottomSheet>
  );
}

function MethodPicker({ value, onChange }: { value: InstallmentMethod; onChange: (m: InstallmentMethod) => void }) {
  const { t } = useTranslation('contact');
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{t('crediario.method')}</Text>
      <View style={styles.filters}>
        {METHODS.map((m) => <Chip key={m} label={t(`crediario.methods.${m}`)} selected={value === m} onPress={() => onChange(m)} />)}
      </View>
    </View>
  );
}

function ReceiveSheet({ p, later, onClose, onDone }: { p: Receivable; later: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('contact');
  const [cents, setCents] = useState(p.total_cents);
  const [method, setMethod] = useState<InstallmentMethod>('cash');
  const [excess, setExcess] = useState<'next' | 'credit'>(later ? 'next' : 'credit');
  const [note, setNote] = useState('');
  const over = Math.max(0, cents - p.total_cents);
  const rest = Math.max(0, p.total_cents - cents);
  const save = useMutation({
    mutationFn: () => receiveInstallment(p.id, cents / 100, { method, note: note.trim() || undefined, excess: over > 0 ? excess : null }),
    onSuccess: () => { void showDialog({ title: t('crediario.received', { amount: brl(cents) }), tone: 'success' }); onDone(); },
    onError: (e) => void showDialog({ title: t('crediario.receiveFailed'), message: apiMessage(e) ?? undefined, tone: 'warn' }),
  });
  return (
    <BottomSheet visible onClose={onClose} title={t('crediario.receiveTitle', { n: p.installment_number, total: p.installment_total })}
      footer={<Button label={t('crediario.receiveSelected', { amount: brl(cents) })} disabled={cents <= 0} loading={save.isPending} onPress={() => save.mutate()} />}>
      <View style={{ gap: 14 }}>
        <Muted>{t('crediario.total', { amount: brl(p.total_cents) })}</Muted>
        <MoneyField label={t('crediario.amount')} cents={cents} onChange={setCents} />
        {rest > 0 && cents > 0 ? <Muted>{t('hub.openDebt', { total: brl(rest) })}</Muted> : null}
        {over > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>{t('crediario.excessTitle')}</Text>
            <View style={styles.filters}>
              {later ? <Chip label={t('crediario.excessNext')} selected={excess === 'next'} onPress={() => setExcess('next')} /> : null}
              <Chip label={t('crediario.excessCredit')} selected={excess === 'credit' || !later} onPress={() => setExcess('credit')} />
            </View>
          </View>
        ) : null}
        <MethodPicker value={method} onChange={setMethod} />
        <Field label={t('crediario.note')} value={note} onChangeText={setNote} />
      </View>
    </BottomSheet>
  );
}

function ReceiveManySheet({ list, onClose, onDone }: { list: Receivable[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('contact');
  const total = list.reduce((s, p) => s + p.total_cents, 0);
  const [method, setMethod] = useState<InstallmentMethod>('cash');
  const save = useMutation({
    mutationFn: () => receiveInstallments(list.map((p) => p.id), [{ method, amount: total / 100 }], { expectedTotalCents: total }),
    onSuccess: () => { void showDialog({ title: t('crediario.received', { amount: brl(total) }), tone: 'success' }); onDone(); },
    onError: (e) => void showDialog({ title: t('crediario.receiveFailed'), message: apiMessage(e) ?? undefined, tone: 'warn' }),
  });
  return (
    <BottomSheet visible onClose={onClose} title={t('crediario.receiveManyTitle', { count: list.length })}
      footer={<Button label={t('crediario.receiveSelected', { amount: brl(total) })} loading={save.isPending} onPress={() => save.mutate()} />}>
      <View style={{ gap: 14 }}>
        <Muted>{t('crediario.total', { amount: brl(total) })}</Muted>
        <MethodPicker value={method} onChange={setMethod} />
      </View>
    </BottomSheet>
  );
}

function DiscountSheet({ p, onClose, onDone }: { p: Receivable; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('contact');
  const [cents, setCents] = useState(0);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<InstallmentMethod>('cash');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => settleWithDiscount(p.id, cents / 100, reason.trim(), method),
    onSuccess: () => { void showDialog({ title: t('crediario.discountDone'), tone: 'success' }); onDone(); },
    onError: (e) => void showDialog({ title: t('crediario.receiveFailed'), message: apiMessage(e) ?? undefined, tone: 'warn' }),
  });
  const submit = () => {
    if (cents <= 0 || cents >= p.total_cents) return setError(t('crediario.amountInvalid'));
    if (reason.trim().length < 3) return setError(t('crediario.reasonRequired'));
    setError(null);
    save.mutate();
  };
  return (
    <BottomSheet visible onClose={onClose} title={t('crediario.discountTitle')}
      footer={<View style={{ gap: 8 }}>{error ? <Text style={styles.error}>{error}</Text> : null}<Button label={t('crediario.receiveSelected', { amount: brl(cents) })} loading={save.isPending} onPress={submit} /></View>}>
      <View style={{ gap: 14 }}>
        <Muted>{t('crediario.discountHint')}</Muted>
        <Muted>{t('crediario.total', { amount: brl(p.total_cents) })}</Muted>
        <MoneyField label={t('crediario.amount')} cents={cents} onChange={setCents} />
        <MethodPicker value={method} onChange={setMethod} />
        <Field label={t('crediario.discountReason')} value={reason} onChangeText={setReason} placeholder={t('crediario.discountReasonHint')} />
      </View>
    </BottomSheet>
  );
}

function CancelSheet({ p, onClose, onDone }: { p: Receivable; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('contact');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => cancelReceivable(p.id, reason.trim()),
    onSuccess: () => { void showDialog({ title: t('crediario.cancelDone'), tone: 'success' }); onDone(); },
    onError: (e) => void showDialog({ title: t('crediario.cancelFailed'), message: apiMessage(e) ?? undefined, tone: 'warn' }),
  });
  return (
    <BottomSheet visible onClose={onClose} title={t('crediario.cancelTitle')}
      footer={<View style={{ gap: 8 }}>{error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={t('crediario.cancel')} variant="danger" loading={save.isPending} onPress={() => { if (reason.trim().length < 3) return setError(t('crediario.reasonRequired')); setError(null); save.mutate(); }} /></View>}>
      <View style={{ gap: 14 }}>
        <Muted>{t('crediario.cancelHint')}</Muted>
        <Field label={t('crediario.cancelReason')} value={reason} onChangeText={setReason} />
      </View>
    </BottomSheet>
  );
}

function PurchaseSheet({ p, onClose }: { p: Receivable; onClose: () => void }) {
  const { t } = useTranslation('contact');
  const q = useQuery({ queryKey: ['pos', 'compra-da-parcela', p.id], queryFn: () => fetchInstallmentPurchase(p.id) });
  const d = q.data;
  return (
    <BottomSheet visible onClose={onClose} title={d ? t('crediario.purchaseTitle', { number: d.human_number ?? '' }) : t('crediario.purchaseDetail')}>
      {q.isLoading ? <Loading /> : q.isError || !d ? <Muted>{t('crediario.purchaseFailed')}</Muted> : (
        <View style={{ gap: 10 }}>
          <Muted>{stampLabel(d.purchased_at)}</Muted>
          {d.items.map((it, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.itemName}>{t('crediario.purchaseItemLine', { qty: it.quantity, name: it.name })}</Text>
              <Text style={styles.itemPrice}>{brl(it.line_total_cents)}</Text>
            </View>
          ))}
          <Text style={styles.amount}>{t('crediario.purchaseTotal', { amount: brl(d.amount_cents) })}</Text>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  cardMarked: { borderColor: colors.primary, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  line: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.textMuted },
  foot: { marginTop: 4, gap: 2 },
  amount: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  error: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
  receiptMain: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemName: { flex: 1, fontFamily: typography.fontFamily, fontSize: 14, color: colors.text },
  itemPrice: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
});
