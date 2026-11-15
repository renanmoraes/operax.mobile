import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Muted, SettingsRow } from '@/src/design-system/ui';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { LANGS } from './index';
import { setAppLanguage, useLang } from './language';

/**
 * Linha "Idioma" do perfil: abre a escolha entre português, inglês e espanhol. Cada idioma aparece
 * no próprio idioma (Português, English, Español), para quem não entende o atual achar o seu.
 * Na equipe com login real, a escolha também vai para o perfil no Operax (o mesmo idioma no web).
 */
export function LanguageRow({ syncProfile, last }: { syncProfile: boolean; last?: boolean }) {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  return (
    <>
      <SettingsRow icon="language-outline" title={t('language.title')} subtitle={current.label} onPress={() => setOpen(true)} last={last} />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('language.choose')}>
        <View style={{ gap: 8 }}>
          {LANGS.map((l) => {
            const on = l.id === lang;
            return (
              <Pressable
                key={l.id}
                onPress={() => {
                  setOpen(false);
                  void setAppLanguage(l.id, { syncProfile, name: user?.name });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={l.label}
                style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.optionText, on && { color: colors.primary }]}>{l.label}</Text>
                {on ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : <View style={styles.radio} />}
              </Pressable>
            );
          })}
        </View>
        {syncProfile ? <Muted style={{ marginTop: 6, lineHeight: 18 }}>{t('language.staffNote')}</Muted> : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, paddingHorizontal: 16, borderRadius: radii.md, backgroundColor: '#f6f8fc' },
  optionOn: { backgroundColor: colors.primaryWash },
  optionText: { ...text.bodyStrong, fontFamily: typography.fontFamilySemiBold, color: colors.text },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.track },
});
