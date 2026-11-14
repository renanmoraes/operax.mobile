import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

export default function ClientPerfilScreen() {
  const { user, logout, clearRole, switchTenant } = useAuth();
  const memberships = user?.kind === 'client' ? user.memberships : [];
  const activeTenantId = user?.kind === 'client' ? user.active_tenant_id : null;
  const secondaryLine = user?.email || (user?.kind === 'client' ? user.phone : undefined) || '—';

  return (
    <Screen>
      <ScreenHeader title="Perfil" />
      <View style={styles.user}>
        <Body style={styles.name}>{user?.name || 'Cliente'}</Body>
        <Muted>{secondaryLine}</Muted>
      </View>

      {memberships.length > 1 ? (
        <View style={styles.section}>
          <Muted style={styles.sectionLabel}>Empresa ativa</Muted>
          {memberships.map((m) => (
            <Pressable
              key={m.tenant_id}
              disabled={m.tenant_id === activeTenantId}
              onPress={() => switchTenant(m.tenant_id).catch(() => {})}
              style={styles.row}
            >
              <Body>{m.tenant_name}</Body>
              {m.tenant_id === activeTenantId ? (
                <Body style={{ color: colors.primary }}>Ativa</Body>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.row} onPress={() => logout()}>
        <Body>Sair</Body>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => clearRole().then(() => router.replace('/(auth)/role-select'))}
      >
        <Body>Entrar como equipe</Body>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  user: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
    gap: 2,
  },
  name: { fontFamily: typography.fontFamilySemiBold, fontSize: 17 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  sectionLabel: { paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
