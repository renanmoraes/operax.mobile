import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { otherRole, Role, useAuth } from './AuthContext';

const SIDE: Record<Role, { label: string; icon: 'headset-outline' | 'person-outline' }> = {
  staff: { label: 'Equipe', icon: 'headset-outline' },
  client: { label: 'Cliente', icon: 'person-outline' },
};

/**
 * Contas guardadas neste aparelho: a aberta, a outra (troca com um toque) ou
 * o atalho para adicionar a do outro lado sem sair da atual.
 */
export function AccountSwitcher() {
  const { role, user, accounts, switchAccount, addAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!role) return null;
  const other = otherRole(role);
  const otherAccount = accounts[other];

  const go = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <SettingsGroup>
        <SettingsRow
          icon={SIDE[role].icon}
          title={user?.name || accounts[role]?.name || SIDE[role].label}
          subtitle={`${SIDE[role].label} · aberta agora`}
          right={<Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        />
        {otherAccount ? (
          <SettingsRow
            icon={SIDE[other].icon}
            title={otherAccount.name}
            subtitle={`${SIDE[other].label} · toque para trocar`}
            right={busy ? <ActivityIndicator color={colors.primary} /> : undefined}
            onPress={busy ? undefined : () => void go(() => switchAccount(other))}
            last
          />
        ) : (
          <SettingsRow
            icon="add-circle-outline"
            title={`Adicionar conta de ${SIDE[other].label.toLowerCase()}`}
            subtitle="Entre sem sair desta conta"
            onPress={busy ? undefined : () => void go(() => addAccount(other))}
            last
          />
        )}
      </SettingsGroup>
      <Text style={styles.hint}>
        {otherAccount ? 'Sair de uma conta mantém a outra aberta neste aparelho.' : 'Quem é dono de empresa e também cliente de outra usa as duas aqui.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { ...text.caption, color: colors.textMuted, paddingHorizontal: 4 },
});
