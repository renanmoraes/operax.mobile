import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/design-system/tokens';
import { Field, Muted } from '@/src/design-system/ui';
import type { AnamneseAnswers, AnamneseQuestion } from '@/src/shared/api/portal.api';

type Answer = AnamneseAnswers[string] | undefined;

/** Opção de resposta: contorno visível mesmo sobre o cartão branco, preenchida quando escolhida. */
function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.opt, selected && styles.optOn]}>
      <Text style={[styles.optText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/** Uma pergunta da anamnese, no tipo que a empresa escolheu (sim/não, escolha, escala, texto…). */
export function Question({ q, value, onChange }: { q: AnamneseQuestion; value: Answer; onChange: (v: Answer) => void }) {
  const { t } = useTranslation('portal');
  const label = `${q.label}${q.required ? ' *' : ''}`;
  const v = value?.value;
  const set = (next: string | number | string[] | undefined, detail?: string) =>
    onChange(next === undefined || next === '' || (Array.isArray(next) && !next.length) ? undefined : { value: next, ...(detail ? { detail } : {}) });

  if (q.type === 'yes_no' || q.type === 'yes_no_na') {
    const options = (['yes', 'no', 'na'] as const).filter((k) => q.type === 'yes_no_na' || k !== 'na');
    const asksDetail = q.detail_when && v !== undefined && (q.detail_when === 'any' || q.detail_when === v);
    return (
      <View style={styles.block}>
        <Text style={styles.legend}>{label}</Text>
        <View style={styles.chips}>
          {options.map((k) => (
            <Chip key={k} label={t(`anam.${k}`)} selected={v === k} onPress={() => set(k, q.detail_when && (q.detail_when === 'any' || q.detail_when === k) ? value?.detail : undefined)} />
          ))}
        </View>
        {asksDetail ? <Field label={q.detail_label ?? t('anam.detail')} value={value?.detail ?? ''} maxLength={500} onChangeText={(d) => onChange({ value: String(v), ...(d ? { detail: d } : {}) })} /> : null}
      </View>
    );
  }
  if (q.type === 'single') {
    return (
      <View style={styles.block}>
        <Text style={styles.legend}>{label}</Text>
        <View style={styles.chips}>
          {(q.options ?? []).map((o) => (
            <Chip key={o} label={o} selected={v === o} onPress={() => set(o)} />
          ))}
        </View>
      </View>
    );
  }
  if (q.type === 'multi') {
    const chosen = Array.isArray(v) ? v : [];
    return (
      <View style={styles.block}>
        <Text style={styles.legend}>{label}</Text>
        <View style={styles.chips}>
          {(q.options ?? []).map((o) => {
            const on = chosen.includes(o);
            return <Chip key={o} label={o} selected={on} onPress={() => set(on ? chosen.filter((x) => x !== o) : [...chosen, o])} />;
          })}
        </View>
      </View>
    );
  }
  if (q.type === 'scale') {
    return (
      <View style={styles.block}>
        <Text style={styles.legend}>{label}</Text>
        <View style={styles.chips}>
          {Array.from({ length: 11 }, (_, n) => (
            <Chip key={n} label={String(n)} selected={v === n} onPress={() => set(n)} />
          ))}
        </View>
        <Muted style={{ fontSize: 12 }}>{t('anam.scaleHint')}</Muted>
      </View>
    );
  }
  if (q.type === 'long_text') {
    return <Field label={label} multiline maxLength={2000} value={typeof v === 'string' ? v : ''} onChangeText={(s) => set(s)} />;
  }
  const numeric = q.type === 'number';
  return (
    <Field
      label={`${q.label}${q.unit ? ` (${q.unit})` : ''}${q.required ? ' *' : ''}`}
      value={v === undefined ? '' : String(v)}
      keyboardType={numeric ? 'decimal-pad' : q.type === 'date' ? 'number-pad' : 'default'}
      placeholder={q.type === 'date' ? 'AAAA-MM-DD' : undefined}
      maxLength={q.type === 'text' ? 300 : 20}
      onChangeText={(s) => set(numeric ? s.replace(/[^\d.,]/g, '') : s)}
    />
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  legend: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, lineHeight: 20, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: colors.track, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  optOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
});
