import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Field, Muted } from '@/src/design-system/ui';
import { colors, radii, shadows, text } from '@/src/design-system/tokens';
import { normalizeCompanyCode } from './companyCode';

/**
 * Código da empresa no login da equipe, igual ao da web: na primeira vez um campo curto (4 letras, em maiúsculas, fonte
 * monoespaçada); nas seguintes o cartão "Último acesso" com o código lembrado e o botão "Trocar".
 */
export function CompanyCodeField({
  value,
  saved,
  onChange,
  onClearSaved,
}: {
  value: string;
  /** Código lembrado deste aparelho; quando existe, aparece o cartão no lugar do campo. */
  saved: string | null;
  onChange: (code: string) => void;
  onClearSaved: () => void;
}) {
  const { t } = useTranslation('auth');
  if (saved) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>{t('login.company')}</Text>
        <View style={styles.card}>
          <View style={styles.accent} />
          <View style={styles.badge}>
            <Ionicons name="business-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.last}>{t('login.lastAccess')}</Text>
            <Text style={styles.code} accessibilityLabel={t('login.companyCodeA11y', { code: saved })}>{saved}</Text>
          </View>
          <Pressable onPress={onClearSaved} hitSlop={10} accessibilityRole="button" style={styles.change}>
            <Ionicons name="swap-horizontal" size={15} color={colors.textMuted} />
            <Text style={styles.changeText}>{t('login.changeCompany')}</Text>
          </Pressable>
        </View>
        <Muted style={{ fontSize: 13 }}>{t('login.rememberedHint')}</Muted>
      </View>
    );
  }
  return (
    <Field
      label={t('fields.companyCode')}
      value={value}
      mono
      maxLength={4}
      autoCapitalize="characters"
      autoComplete="organization"
      onChangeText={(v) => onChange(normalizeCompanyCode(v))}
      placeholder={t('fields.companyCodePlaceholder')}
    />
  );
}

const styles = StyleSheet.create({
  label: { ...text.calloutStrong, color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 16,
    borderRadius: radii.lg,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.primary },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  last: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted, fontFamily: 'Inter_600SemiBold' },
  code: {
    fontSize: 22,
    letterSpacing: 6,
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '600',
  },
  change: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 8 },
  changeText: { fontSize: 13, color: colors.textMuted, fontFamily: 'Inter_600SemiBold' },
});
