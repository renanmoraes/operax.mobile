import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, PressableScale } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

/** Cartão de uma parte da ficha. Fechado mostra o título e um resumo do que já tem; aberto mostra os campos. */
export function FormSection({ icon, title, summary, open, onToggle, children, alwaysOpen }: { icon: IconName; title: string; summary?: string; open: boolean; onToggle?: () => void; children: ReactNode; alwaysOpen?: boolean }) {
  const shown = alwaysOpen || open;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <PressableScale onPress={alwaysOpen ? undefined : onToggle} disabled={alwaysOpen} accessibilityRole="button" accessibilityState={{ expanded: shown }} accessibilityLabel={summary ? `${title}, ${summary}` : title} style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{title}</Text>
          {summary && !shown ? <Text style={styles.summary} numberOfLines={1}>{summary}</Text> : null}
        </View>
        {alwaysOpen ? null : <Ionicons name={shown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />}
      </PressableScale>
      {shown ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
  summary: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 16, gap: 14 },
});
