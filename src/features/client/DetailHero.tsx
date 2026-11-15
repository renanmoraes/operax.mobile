import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glow, Rise, TopBar } from '@/src/design-system/ui';
import { colors, gradients, shadows, text, typography } from '@/src/design-system/tokens';

/** Topo das telas de detalhe: faixa clara em degradê com cantos inferiores arredondados. */
export function DetailHero({
  eyebrow,
  title,
  onBack,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  onBack: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradients.heroSide} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Glow size={320} style={{ right: -130, top: -140 }} opacity={0.36} />
      <Glow size={300} color={colors.primary} opacity={0.12} style={{ left: -160, bottom: -200 }} />
      <View style={{ paddingTop: insets.top }}>
        <TopBar onBack={onBack} right={right} />
      </View>
      <View style={styles.body}>
        {eyebrow ? (
          <Rise>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </Rise>
        ) : null}
        <Rise index={1}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </Rise>
        {children ? <Rise index={2}>{children}</Rise> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', ...shadows.hero },
  body: { paddingHorizontal: 20, paddingBottom: 26, paddingTop: 6 },
  eyebrow: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  title: { marginTop: 6, ...text.display, color: colors.text },
});
