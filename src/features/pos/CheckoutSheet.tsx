import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, IconButton, PressableScale } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { BASE_PAYMENT_METHODS, type PosPaymentMethod } from '@/src/shared/api/pos.api';
import { addPaymentRow, changeDue, checkoutState, decimalDigitado, formatMoney, keypadText, quickCash, round2, shiftMonth, todayYmd, uid, type PaymentRow } from './checkout';
import { METHOD_ICON, Pills, SumRow } from './parts';
import { primeiroVencimentoSugerido } from './primeiroVencimento';

const dateLabel = (ymd: string) => new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T12:00:00`));
const cleanMoney = (raw: string) => {
  const v = raw.replace(/[^\d,.]/g, '').replace('.', ',');
  return /^\d*,?\d{0,2}$/.test(v) ? v : null;
};

export type CheckoutResult = { payments: PaymentRow[]; installments: number; firstDueDate: string };

/**
 * Receber: o pagamento é só registrado (o app não cobra nem fala com maquininha). Uma forma vale o
 * total; dividir abre o valor de cada uma, e a soma tem de fechar. Dinheiro calcula o troco na tela.
 */
export function CheckoutSheet({
  total,
  subtotal,
  hasContact,
  onAccountEnabled,
  creditCents,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  total: number;
  subtotal: number;
  hasContact: boolean;
  onAccountEnabled: boolean;
  creditCents: number;
  pending: boolean;
  error: string | null;
  onConfirm: (r: CheckoutResult) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('pos');
  const [rows, setRows] = useState<PaymentRow[]>(() => [{ id: uid(), method: 'cash', amount: total, tendered: null }]);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [tenderedRaw, setTenderedRaw] = useState<Record<string, string>>({});
  const [installments, setInstallments] = useState(1);
  const [firstDue, setFirstDue] = useState(() => primeiroVencimentoSugerido());

  // Com uma forma só, o valor dela é o total.
  const effective = useMemo(() => (rows.length === 1 ? [{ ...rows[0], amount: total }] : rows), [rows, total]);
  const state = checkoutState({ payments: effective, total, creditCents, installments, firstDueDate: firstDue });

  const methods: PosPaymentMethod[] = [
    ...BASE_PAYMENT_METHODS,
    ...(hasContact && onAccountEnabled ? (['on_account'] as const) : []),
    ...(creditCents > 0 || rows.some((r) => r.method === 'store_credit') ? (['store_credit'] as const) : []),
  ];
  const options = methods.map((m) => ({ value: m, label: t(`methods.${m}`), icon: METHOD_ICON[m] }));

  const update = (id: string, patch: Partial<PaymentRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => {
    const used = new Set(effective.map((r) => r.method));
    const method = (['pix', 'debit_card', 'credit_card', 'cash'] as PosPaymentMethod[]).find((m) => !used.has(m)) ?? 'other';
    // Ao dividir, a primeira forma deixa de valer o total sozinha: fixa o valor que ela tem agora.
    const base = rows.length === 1 ? [{ ...rows[0], amount: total }] : rows;
    const next = addPaymentRow(base, total, method, uid());
    setRows(next);
    // Saindo de uma forma só, o valor da que fica foi refeito (passou a ser o total): o texto do campo acompanha.
    const fromSingle = rows.length === 1;
    setRaw((m) => ({ ...m, ...Object.fromEntries(next.map((r) => [r.id, fromSingle || m[r.id] == null ? keypadText(r.amount, 2) : m[r.id]])) }));
  };
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const onAccountRow = effective.find((r) => r.method === 'on_account');
  const today = todayYmd();

  return (
    <BottomSheet
      visible
      onClose={pending ? () => {} : onClose}
      title={t('checkout.title')}
      footer={
        <>
          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Button
            label={pending ? t('checkout.confirming') : t('checkout.confirm')}
            icon="checkmark-done"
            loading={pending}
            disabled={!state.canConfirm}
            onPress={() => onConfirm({ payments: effective, installments, firstDueDate: firstDue })}
          />
        </>
      }
    >
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
        <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        {subtotal > total ? <Text style={styles.totalSub}>{t('checkout.subtotal')} {formatMoney(subtotal)} · {t('checkout.discount')} {formatMoney(round2(subtotal - total))}</Text> : null}
      </View>

      <View style={{ gap: 12 }}>
        {effective.map((row, i) => {
          const change = changeDue(row);
          return (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.rowLabel}>
                  {t('checkout.method')}
                  {effective.length > 1 ? ` ${i + 1}` : ''}
                </Text>
                {effective.length > 1 ? <IconButton icon="close" size={32} onPress={() => remove(row.id)} accessibilityLabel={t('checkout.removeMethod')} /> : null}
              </View>
              <Pills options={options} value={row.method} onChange={(m) => update(row.id, { method: m, tendered: m === 'cash' ? row.tendered : null })} label={t('checkout.method')} />
              {effective.length > 1 ? (
                <MoneyInput
                  label={t('checkout.amount')}
                  value={raw[row.id] ?? keypadText(row.amount, 2)}
                  onChange={(v) => {
                    setRaw((m) => ({ ...m, [row.id]: v }));
                    update(row.id, { amount: decimalDigitado(v) ?? 0 });
                  }}
                />
              ) : null}
              {row.method === 'cash' ? (
                <View style={{ gap: 8 }}>
                  <MoneyInput
                    label={t('checkout.tendered')}
                    value={tenderedRaw[row.id] ?? ''}
                    onChange={(v) => {
                      setTenderedRaw((m) => ({ ...m, [row.id]: v }));
                      update(row.id, { tendered: v ? decimalDigitado(v) : null });
                    }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {quickCash(row.amount).map((v) => (
                      <PressableScale
                        key={v}
                        onPress={() => {
                          setTenderedRaw((m) => ({ ...m, [row.id]: keypadText(v, 2) }));
                          update(row.id, { tendered: v });
                        }}
                        accessibilityRole="button"
                        style={styles.note}
                      >
                        <Text style={styles.noteText}>{formatMoney(v)}</Text>
                      </PressableScale>
                    ))}
                  </View>
                  {change != null ? (
                    <View style={[styles.change, change < 0 && { backgroundColor: colors.warnSoft }]} accessibilityLiveRegion="polite">
                      <Text style={[styles.changeLabel, change < 0 && { color: colors.warnText }]}>{change < 0 ? t('checkout.short', { value: formatMoney(-change) }) : t('checkout.change')}</Text>
                      {change >= 0 ? <Text style={styles.changeValue}>{formatMoney(change)}</Text> : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
              {row.method === 'store_credit' ? (
                <Text style={[styles.hint, state.creditOver && { color: colors.dangerText }]}>
                  {state.creditOver ? t('checkout.creditOver', { value: formatMoney(creditCents / 100) }) : t('checkout.credit', { value: formatMoney(creditCents / 100) })}
                </Text>
              ) : null}
            </View>
          );
        })}

        <PressableScale onPress={add} accessibilityRole="button" style={styles.addBtn}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addText}>{t('checkout.addMethod')}</Text>
        </PressableScale>

        {onAccountRow ? (
          <View style={[styles.row, { gap: 12 }]}>
            <Text style={styles.rowLabel}>{t('methods.on_account')}</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepLabel}>{t('checkout.installments')}</Text>
              <View style={styles.stepper}>
                <IconButton icon="remove" size={36} onPress={() => setInstallments((n) => Math.max(1, n - 1))} accessibilityLabel="−" />
                <Text style={styles.stepValue}>{installments}×</Text>
                <IconButton icon="add" size={36} onPress={() => setInstallments((n) => Math.min(24, n + 1))} accessibilityLabel="+" />
              </View>
            </View>
            <Text style={styles.hint}>{t('checkout.installmentsOf', { n: installments, value: formatMoney(round2(onAccountRow.amount / installments)) })}</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepLabel}>{t('checkout.firstDue')}</Text>
              <View style={styles.stepper}>
                <IconButton icon="chevron-back" size={36} onPress={() => setFirstDue((d) => (shiftMonth(d, -1) >= today ? shiftMonth(d, -1) : d))} accessibilityLabel={t('checkout.earlier')} />
                <Text style={styles.stepValue}>{dateLabel(firstDue)}</Text>
                <IconButton icon="chevron-forward" size={36} onPress={() => setFirstDue((d) => shiftMonth(d, 1))} accessibilityLabel={t('checkout.later')} />
              </View>
            </View>
          </View>
        ) : null}

        {!state.closes ? <Text style={styles.warn}>{t('checkout.mismatch', { sum: formatMoney(state.sum), total: formatMoney(total) })}</Text> : null}
        {effective.length > 1 ? <SumRow label={t('checkout.total')} value={formatMoney(state.sum)} tone={state.closes ? 'success' : 'danger'} strong /> : null}
      </View>
    </BottomSheet>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.money}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <View style={styles.moneyField}>
        <Text style={styles.moneyPrefix}>R$</Text>
        <TextInput
          value={value}
          onChangeText={(v) => {
            const c = cleanMoney(v);
            if (c != null) onChange(c);
          }}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor="#8a93a3"
          style={styles.moneyInput}
          accessibilityLabel={label}
          selectTextOnFocus
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  totalBox: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg, backgroundColor: colors.chromeNavy, marginTop: -4 },
  totalLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.cyan, letterSpacing: 1, textTransform: 'uppercase' },
  totalValue: { fontFamily: typography.fontFamilyBold, fontSize: 36, color: '#fff', letterSpacing: -1, fontVariant: ['tabular-nums'], marginTop: 2 },
  totalSub: { fontFamily: typography.fontFamily, fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontVariant: ['tabular-nums'] },
  row: { padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, gap: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  rowLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  note: { paddingHorizontal: 12, height: 34, borderRadius: radii.pill, backgroundColor: colors.successSoft, justifyContent: 'center' },
  noteText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.success, fontVariant: ['tabular-nums'] },
  change: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.successSoft },
  changeLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.success },
  changeValue: { fontFamily: typography.fontFamilyBold, fontSize: 24, color: colors.success, fontVariant: ['tabular-nums'] },
  hint: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted },
  warn: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: colors.warnText },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  addText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.primary },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepLabel: { fontFamily: typography.fontFamilyMedium, fontSize: 14, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepValue: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  money: { gap: 6 },
  moneyLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textSoft },
  moneyField: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 14, borderRadius: radii.control, backgroundColor: '#f1f4fa' },
  moneyPrefix: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.textMuted },
  moneyInput: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 20, color: colors.text, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  error: { padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerSoft },
  errorText: { fontFamily: typography.fontFamilyMedium, fontSize: 13.5, color: colors.dangerText },
});
