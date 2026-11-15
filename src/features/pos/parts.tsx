import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import type { KeypadKey } from './checkout';

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];

/**
 * Teclado grande do balcão: dá para pesar com uma mão, sem o teclado do sistema cobrindo o valor.
 * `decimals = 0` apaga a vírgula (gramas inteiras, quantidade).
 */
export function Keypad({ onKey, decimals }: { onKey: (k: KeypadKey) => void; decimals: number }) {
  const { t } = useTranslation('common');
  return (
    <View style={styles.pad}>
      {KEYS.map((k) => {
        const off = k === ',' && decimals === 0;
        return (
          <PressableScale
            key={k}
            onPress={off ? undefined : () => onKey(k)}
            onLongPress={k === 'del' ? () => onKey('clear') : undefined}
            disabled={off}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? t('actions.delete') : k}
            style={[styles.key, off && { opacity: 0 }]}
          >
            {k === 'del' ? <Ionicons name="backspace-outline" size={24} color={colors.text} /> : <Text style={styles.keyText}>{k}</Text>}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Pílulas roláveis para escolher uma opção (forma de pagamento, tipo de desconto). */
export function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.pill, on && styles.pillOn]}
          >
            {o.icon ? <Ionicons name={o.icon} size={15} color={on ? '#fff' : colors.textSoft} /> : null}
            <Text style={[styles.pillText, on && { color: '#fff' }]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

export const METHOD_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  pix: 'flash-outline',
  debit_card: 'card-outline',
  credit_card: 'card',
  bank_transfer: 'swap-horizontal-outline',
  other: 'ellipsis-horizontal',
  on_account: 'calendar-outline',
  store_credit: 'wallet-outline',
};

/** "De" riscado e "por" ao lado. */
export function PriceFromTo({ from, to, big, light }: { from?: string | null; to: string; big?: boolean; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      {from ? <Text style={[styles.from, light && { color: 'rgba(255,255,255,0.55)' }]}>{from}</Text> : null}
      <Text style={[big ? styles.toBig : styles.to, light && { color: '#fff' }]}>{to}</Text>
    </View>
  );
}

export function OfferTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name="pricetag" size={10} color={colors.warnText} />
      <Text style={styles.tagText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Linha "rótulo …… valor" do resumo. */
export function SumRow({ label, value, strong, tone }: { label: string; value: ReactNode; strong?: boolean; tone?: 'muted' | 'success' | 'danger' }) {
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.dangerText : tone === 'muted' ? colors.textMuted : colors.text;
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, strong && { color: colors.text, fontFamily: typography.fontFamilySemiBold }]}>{label}</Text>
      {typeof value === 'string' ? <Text style={[styles.sumValue, strong && styles.sumStrong, { color }]}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    width: '31.6%',
    flexGrow: 1,
    height: 58,
    borderRadius: radii.md,
    backgroundColor: '#f1f4fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: typography.fontFamilySemiBold, fontSize: 24, color: colors.text, fontVariant: ['tabular-nums'] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: '#f1f4fa',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOn: { backgroundColor: colors.chromeNavy, borderColor: colors.chromeNavy },
  pillText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textSoft },
  from: { fontFamily: typography.fontFamily, fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  to: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  toBig: { fontFamily: typography.fontFamilyBold, fontSize: 30, color: colors.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.warnSoft,
    maxWidth: 130,
  },
  tagText: { fontFamily: typography.fontFamilyBold, fontSize: 10, color: colors.warnText, letterSpacing: 0.2 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 3 },
  sumLabel: { fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.textMuted },
  sumValue: { fontFamily: typography.fontFamilyMedium, fontSize: 14, fontVariant: ['tabular-nums'] },
  sumStrong: { fontFamily: typography.fontFamilyBold, fontSize: 17 },
});
