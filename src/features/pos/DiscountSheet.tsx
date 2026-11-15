import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, Field } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { cartTotal, cartTotalWithOrderDiscount, detalhesDoCarrinho, setLineDiscount, type CartLine } from './cart';
import { decimalDigitado, formatMoney } from './checkout';
import { Pills } from './parts';

type LineType = 'percent' | 'fixed' | 'price_override' | 'total_override';
type OrderType = 'percent' | 'fixed';

const fromNumber = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));
const clean = (raw: string) => raw.replace(/[^\d.,]/g, '').replace('.', ',');

/** Desconto numa linha: %, R$, preço unitário combinado ou total da pesagem (cada um com a sua permissão). */
export function LineDiscountSheet({
  cart,
  lineId,
  canDiscount,
  canOverride,
  onApply,
  onClose,
}: {
  cart: CartLine[];
  lineId: string;
  canDiscount: boolean;
  canOverride: boolean;
  onApply: (type: LineType | null, value: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('pos');
  const line = cart.find((l) => l.line_id === lineId);
  const [type, setType] = useState<LineType | 'none'>(line?.discount_type ?? 'none');
  const [raw, setRaw] = useState(fromNumber(line?.discount_value));

  const value = decimalDigitado(raw);
  const preview = useMemo(() => {
    if (!line) return null;
    const before = detalhesDoCarrinho(setLineDiscount(cart, lineId, null, null)).get(lineId);
    const after = detalhesDoCarrinho(setLineDiscount(cart, lineId, type === 'none' ? null : type, type === 'none' ? null : value)).get(lineId);
    return before && after ? { from: before.liquido, to: after.liquido } : null;
  }, [cart, lineId, line, type, value]);

  if (!line) return null;
  const options: { value: LineType | 'none'; label: string }[] = [
    { value: 'none', label: t('discount.none') },
    ...(canDiscount ? [{ value: 'percent' as const, label: t('discount.percent') }, { value: 'fixed' as const, label: t('discount.fixed') }] : []),
    ...(canOverride ? [{ value: 'price_override' as const, label: t('discount.priceOverride') }] : []),
    ...(canOverride && line.is_weighed ? [{ value: 'total_override' as const, label: t('discount.totalOverride') }] : []),
  ];
  const fieldLabel =
    type === 'percent'
      ? t('discount.valuePercent')
      : type === 'fixed'
        ? t('discount.valueFixed')
        : type === 'price_override'
          ? t('discount.valuePrice', { unit: line.unit_code })
          : t('discount.valueTotal');
  const ready = type === 'none' || (value != null && value >= 0 && (type !== 'percent' || value <= 100));

  return (
    <BottomSheet visible onClose={onClose} title={t('discount.lineTitle', { name: line.name })}>
      <Pills options={options} value={type} onChange={setType} label={t('discount.lineTitle', { name: line.name })} />
      {type !== 'none' ? <Field label={fieldLabel} value={raw} onChangeText={(v) => setRaw(clean(v))} keyboardType="decimal-pad" placeholder="0,00" /> : null}
      {preview && type !== 'none' && preview.to !== preview.from ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>{t('discount.preview', { from: formatMoney(preview.from), to: formatMoney(preview.to) })}</Text>
        </View>
      ) : null}
      <Button
        label={t('discount.apply')}
        icon="checkmark"
        disabled={!ready}
        onPress={() => onApply(type === 'none' ? null : type, type === 'none' ? null : value)}
      />
    </BottomSheet>
  );
}

/** Desconto no total da venda (% ou R$). O teto sem aprovação é do servidor; aqui só avisa. */
export function OrderDiscountSheet({
  cart,
  current,
  maxPercent,
  onApply,
  onClose,
}: {
  cart: CartLine[];
  current: { type: OrderType; value: number } | null;
  maxPercent: number | null;
  onApply: (d: { type: OrderType; value: number } | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('pos');
  const [type, setType] = useState<OrderType>(current?.type ?? 'percent');
  const [raw, setRaw] = useState(fromNumber(current?.value));
  const value = decimalDigitado(raw);
  const subtotal = cartTotal(cart);
  const after = cartTotalWithOrderDiscount(cart, type, value);
  const pct = subtotal > 0 ? (type === 'percent' ? (value ?? 0) : ((value ?? 0) / subtotal) * 100) : 0;
  const ready = value != null && value > 0 && (type !== 'percent' || value <= 100);

  return (
    <BottomSheet visible onClose={onClose} title={t('discount.orderTitle')}>
      <Pills
        options={[
          { value: 'percent', label: t('discount.percent') },
          { value: 'fixed', label: t('discount.fixed') },
        ]}
        value={type}
        onChange={setType}
        label={t('discount.orderTitle')}
      />
      <Field label={type === 'percent' ? t('discount.valuePercent') : t('discount.valueFixed')} value={raw} onChangeText={(v) => setRaw(clean(v))} keyboardType="decimal-pad" placeholder="0" />
      {ready ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>{t('discount.preview', { from: formatMoney(subtotal), to: formatMoney(after) })}</Text>
        </View>
      ) : null}
      {maxPercent != null && pct > maxPercent ? <Text style={styles.warn}>{t('discount.over', { max: maxPercent })}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {current ? <Button label={t('discount.removeOrder')} variant="ghost" onPress={() => onApply(null)} style={{ flex: 1 }} /> : null}
        <Button label={t('discount.apply')} icon="checkmark" disabled={!ready} onPress={() => onApply({ type, value: value as number })} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.md, backgroundColor: colors.successSoft },
  previewText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.success, fontVariant: ['tabular-nums'] },
  warn: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.warnText },
});
