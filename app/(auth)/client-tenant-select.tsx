import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Muted, Title } from '@/src/design-system/ui';
import { colors, radii, spacing } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientTenantSelectScreen() {
  const insets = useSafeAreaInsets();
  const { user, switchTenant } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const memberships = user?.kind === 'client' ? user.memberships : [];

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        <Title style={{ color: '#fff' }}>Qual empresa?</Title>
        <Muted style={{ color: '#9aa8bd' }}>
          Você tem portal em mais de uma empresa. Escolha onde entrar.
        </Muted>
      </View>

      <View style={styles.list}>
        {memberships.map((m) => (
          <Pressable
            key={m.tenant_id}
            disabled={loadingId !== null}
            onPress={async () => {
              setLoadingId(m.tenant_id);
              try {
                await switchTenant(m.tenant_id);
                router.replace('/(client)/agenda');
              } catch {
                /* mantém na tela; sem mensagem dedicada ainda nesta spec */
              } finally {
                setLoadingId(null);
              }
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Body style={styles.name}>{m.tenant_name}</Body>
            {loadingId === m.tenant_id ? <Muted>Entrando…</Muted> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chromeNavy },
  list: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.sheet,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md },
  pressed: { backgroundColor: colors.pageBg },
  name: { fontSize: 16 },
});
