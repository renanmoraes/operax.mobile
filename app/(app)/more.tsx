import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

const LINKS: { label: string; hint: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Histórico', hint: 'Atendimentos encerrados', href: '/history', icon: 'time-outline' },
  { label: 'Kanban', hint: 'Pipeline comercial', href: '/kanban', icon: 'grid-outline' },
  { label: 'Respostas rápidas', hint: 'Atalhos de mensagem', href: '/quick-replies', icon: 'flash-outline' },
  { label: 'Templates Meta', hint: 'Fora da janela 24h', href: '/templates', icon: 'document-text-outline' },
  { label: 'Notificações push', hint: 'Categorias e preferências', href: '/notification-prefs', icon: 'notifications-outline' },
  { label: 'Perfil', hint: 'Conta e sessão', href: '/profile', icon: 'person-outline' },
];

export default function MoreScreen() {
  const { user, mode } = useAuth();

  return (
    <Screen>
      <ScreenHeader title="Mais" />
      <View style={styles.user}>
        <Body style={styles.name}>{user?.name || 'Usuário'}</Body>
        <Muted>
          {user?.email || '—'} · {mode === 'live' ? 'Online' : 'Demo'}
        </Muted>
      </View>
      {LINKS.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => router.push(item.href as never)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Ionicons name={item.icon} size={22} color={colors.primary} />
          <View style={styles.rowText}>
            <Body style={styles.label}>{item.label}</Body>
            <Muted>{item.hint}</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.rowPress },
  rowText: { flex: 1, gap: 2 },
  label: { fontFamily: typography.fontFamilySemiBold },
});
