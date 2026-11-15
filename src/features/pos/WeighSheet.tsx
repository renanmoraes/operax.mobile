import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, IconButton, Segmented } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { changeQuantity, detalhesDoCarrinho, quantidadePeloValorNaLinha, vendidoEmQuilo, type CartLine } from './cart';
import { formatMoney, gramsText, keypadNumber, keypadPress, moneyPlain, quantityText, type KeypadKey } from './checkout';
import { Keypad, OfferTag, PriceFromTo } from './parts';

type Mode = 'weight' | 'value';

/** Texto inicial do teclado a partir da quantidade da linha. */
function initial(line: CartLine): string {
  if (line.quantity == null) return '';
  const v = vendidoEmQuilo(line) ? Math.round(line.quantity * 10000) / 10 : line.quantity;
  return String(v).replace('.', ',');
}

/**
 * Pesagem: "735 g" e o app diz o valor, ou "R$ 10" e o app diz quanto pesar. A conta é a mesma do web
 * (`quantidadePeloValorNaLinha`), que respeita o lote em oferta e fecha no centavo.
 */
export function WeighSheet({
  cart,
  lineId,
  onApply,
  onRemove,
  onClose,
}: {
  cart: CartLine[];
  lineId: string;
  onApply: (quantity: number | null) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('pos');
  const line = cart.find((l) => l.line_id === lineId);
  const kg = line ? vendidoEmQuilo(line) : false;
  const valueAllowed = !!line && (!line.discount_type || line.discount_type === 'price_override');
  const [mode, setMode] = useState<Mode>('weight');
  const [raw, setRaw] = useState(() => (line ? initial(line) : ''));

  const decimals = mode === 'value' ? 2 : kg ? 1 : 4;

  const quantity = useMemo(() => {
    const n = keypadNumber(raw);
    if (n == null || n <= 0 || !line) return null;
    if (mode === 'value') return quantidadePeloValorNaLinha(cart, line.line_id, n);
    return kg ? Math.round(n * 10) / 10000 : Math.round(n * 10000) / 10000;
  }, [raw, mode, kg, cart, line]);

  const detail = useMemo(() => {
    if (!line || quantity == null) return null;
    return detalhesDoCarrinho(changeQuantity(cart, line.line_id, quantity)).get(line.line_id) ?? null;
  }, [cart, line, quantity]);

  if (!line) return null;

  const unit = kg ? 'g' : line.unit_code;
  const shown = raw || '0';
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    // Troca o que está sendo digitado pelo valor equivalente, para a pessoa continuar de onde estava.
    if (m === 'value') setRaw(detail ? moneyPlain(detail.liquido).replace(/\./g, '') : '');
    else setRaw(quantity != null ? String(kg ? Math.round(quantity * 10000) / 10 : quantity).replace('.', ',') : '');
    setMode(m);
  };
  const press = (k: KeypadKey) => setRaw((v) => keypadPress(v, k, decimals, mode === 'value' ? 5 : kg ? 5 : 4));

  const listPrice = line.list_price ?? line.unit_price;
  const offer = detail?.emOferta || (!!line.offer && quantity == null);
  const secondary =
    quantity == null || !detail
      ? ' '
      : mode === 'weight'
        ? t('weigh.equalsValue', { value: formatMoney(detail.liquido) })
        : t('weigh.equalsWeight', { weight: kg ? `${gramsText(quantity)} g` : `${quantityText(quantity)} ${line.unit_code}` });
  const beyond = detail?.dividida ? detail.partes[detail.partes.length - 1] : null;

  return (
    <BottomSheet visible onClose={onClose} title={line.name}>
      <View style={styles.priceRow}>
        <PriceFromTo from={offer && listPrice > line.unit_price ? formatMoney(listPrice) : null} to={t('weigh.priceLine', { price: formatMoney(line.unit_price), unit: line.unit_code })} />
        {line.offer ? <OfferTag label={line.offer.label} /> : null}
      </View>

      {valueAllowed ? (
        <Segmented
          value={mode}
          onChange={(v) => switchMode(v as Mode)}
          options={[
            { key: 'weight', label: t('weigh.byWeight') },
            { key: 'value', label: t('weigh.byValue') },
          ]}
        />
      ) : (
        <Text style={styles.note}>{t('weigh.valueBlocked')}</Text>
      )}

      <View style={styles.display} accessibilityLiveRegion="polite">
        <View style={styles.displayMain}>
          {mode === 'value' ? <Text style={styles.displayUnit}>R$</Text> : null}
          <Text style={[styles.displayNum, !raw && { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
            {shown}
          </Text>
          {mode === 'weight' ? <Text style={styles.displayUnit}>{unit}</Text> : null}
        </View>
        <Text style={styles.displaySub}>{secondary}</Text>
        {beyond ? <Text style={styles.split}>{t('weigh.offerSplit', { price: formatMoney(beyond.unit_price) })}</Text> : null}
      </View>

      <Keypad onKey={press} decimals={decimals} />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center' }}>
        <IconButton icon="trash-outline" onPress={onRemove} accessibilityLabel={t('weigh.remove')} size={52} />
        <Button label={t('weigh.done')} icon="checkmark" onPress={() => onApply(quantity)} disabled={quantity == null} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6, marginBottom: 2 },
  note: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.textMuted },
  display: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg, backgroundColor: colors.chromeNavy, alignItems: 'flex-end' },
  displayMain: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  displayNum: { fontFamily: typography.fontFamilyBold, fontSize: 46, lineHeight: 54, color: '#fff', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  displayUnit: { fontFamily: typography.fontFamilySemiBold, fontSize: 20, color: colors.cyan },
  displaySub: { fontFamily: typography.fontFamilyMedium, fontSize: 15, color: 'rgba(255,255,255,0.7)', fontVariant: ['tabular-nums'] },
  split: { fontFamily: typography.fontFamily, fontSize: 12, color: '#fdba74', marginTop: 4, textAlign: 'right' },
});
