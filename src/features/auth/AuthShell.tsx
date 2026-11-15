import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Badge, Display, IconButton, Muted, Rise, Screen } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

/** Moldura comum das telas de entrada: fundo tonal, voltar, título grande e rodapé fixo. */
export function AuthShell({
  title,
  subtitle,
  onBack,
  tag,
  showLogo,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  tag?: string;
  showLogo?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  return (
    <Screen backdrop="mirror">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.top}>
            {onBack ? <IconButton icon="chevron-back" onPress={onBack} accessibilityLabel={t('actions.back')} /> : <View />}
            {tag ? <Badge label={tag} tone="primary" /> : null}
          </View>
          {showLogo ? (
            <Rise>
              <Image
                source={require('../../../assets/brand/operax-logo-dark.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="Operax"
              />
            </Rise>
          ) : null}
          <Rise index={1} style={{ marginTop: showLogo ? 22 : 36 }}>
            <Display style={{ fontSize: 28, lineHeight: 33 }}>{title}</Display>
          </Rise>
          {subtitle ? (
            <Rise index={2}>
              <Muted style={styles.subtitle}>{subtitle}</Muted>
            </Rise>
          ) : null}
          <Rise index={3} style={{ marginTop: 28, gap: 14 }}>
            {children}
          </Rise>
          <View style={{ flex: 1, minHeight: 24 }} />
          {footer ? <View style={{ gap: 16 }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  logo: { width: 126, height: 25, marginTop: 36 },
  subtitle: { marginTop: 10, fontSize: 15, lineHeight: 22 },
});
