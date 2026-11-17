import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/design-system/tokens';
import { Card, Muted, PressableScale, SectionHeader } from '@/src/design-system/ui';
import { PortalPage } from '@/src/features/portal/PortalPage';

const FAQ = [
  { group: 'account', items: ['devices', 'logoutAll', 'password', 'twoCompanies', 'contact'] },
  { group: 'seen', items: ['missing', 'privacy', 'notifications'] },
] as const;

/** As dúvidas mais comuns do cliente, com a resposta aberta ao tocar. */
export default function HelpScreen() {
  const { t } = useTranslation('portal');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <PortalPage title={t('help.title')} lead={t('help.lead')}>
      {FAQ.map((g) => (
        <View key={g.group} style={{ gap: 8 }}>
          <SectionHeader title={t(`help.groups.${g.group}.title` as 'help.groups.account.title')} />
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map((item, i) => {
              const key = `${g.group}.${item}`;
              const base = `help.groups.${g.group}.items.${item}` as 'help.groups.account.items.devices';
              const on = open === key;
              return (
                <View key={key} style={i > 0 && styles.border}>
                  <PressableScale onPress={() => setOpen(on ? null : key)} accessibilityRole="button" accessibilityState={{ expanded: on }} scaleTo={0.99}>
                    <View style={styles.q}>
                      <Text style={styles.qText}>{t(`${base}.q` as 'help.groups.account.items.devices.q')}</Text>
                      <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                    </View>
                  </PressableScale>
                  {on ? <Muted style={styles.a}>{t(`${base}.a` as 'help.groups.account.items.devices.a')}</Muted> : null}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
  q: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8 },
  qText: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  a: { paddingBottom: 12, lineHeight: 20 },
});
