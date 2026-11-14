import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function RoleSelectScreen() {
  const insets = useSafeAreaInsets();
  const { selectRole } = useAuth();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.brand}>
        <Image
          source={require('../../assets/brand/operax-mark.png')}
          style={styles.mark}
          contentFit="contain"
        />
        <Image
          source={require('../../assets/brand/operax-logo-full.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>

      <View style={styles.choices}>
        <Body style={{ color: colors.text, textAlign: 'center' }}>Como você vai entrar?</Body>

        <Button
          label="Sou da equipe"
          onPress={async () => {
            await selectRole('staff');
            router.replace('/(auth)/login');
          }}
        />
        <Button
          label="Sou cliente"
          variant="secondary"
          onPress={async () => {
            await selectRole('client');
            router.replace('/(auth)/client-login');
          }}
        />
        <Muted style={{ textAlign: 'center' }}>
          Equipe: atendentes e administradores do tenant. Cliente: quem usa o portal de uma
          empresa atendida por aqui.
        </Muted>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.chromeNavy,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  brand: { alignItems: 'center', gap: spacing.md },
  mark: { width: 72, height: 72 },
  logo: { width: 180, height: 40 },
  choices: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
