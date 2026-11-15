import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { otherRole, Role, useAuth } from './AuthContext';

const SIDE: Record<Role, { icon: 'headset-outline' | 'person-outline' }> = {
  staff: { icon: 'headset-outline' },
  client: { icon: 'person-outline' },
};

/**
 * Contas guardadas neste aparelho: a aberta, a outra (troca com um toque) ou
 * o atalho para adicionar a do outro lado sem sair da atual.
 */
export function AccountSwitcher() {
  const { t } = useTranslation('auth');
  const { role, user, accounts, switchAccount, addAccount, error } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!role) return null;
  const other = otherRole(role);
  const otherAccount = accounts[other];
  const sideLabel = (r: Role) => (r === 'staff' ? t('shared.team') : t('shared.client'));

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
          title={user?.name || accounts[role]?.name || sideLabel(role)}
          subtitle={t('switcher.openNow', { side: sideLabel(role) })}
          right={<Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        />
        {otherAccount ? (
          <SettingsRow
            icon={SIDE[other].icon}
            title={otherAccount.name}
            subtitle={t('switcher.tapToSwitch', { side: sideLabel(other) })}
            right={busy ? <ActivityIndicator color={colors.primary} /> : undefined}
            onPress={busy ? undefined : () => void go(() => switchAccount(other))}
            last
          />
        ) : (
          <SettingsRow
            icon="add-circle-outline"
            title={other === 'staff' ? t('switcher.addTeam') : t('switcher.addClient')}
            subtitle={t('switcher.addSubtitle')}
            onPress={busy ? undefined : () => void go(() => addAccount(other))}
            last
          />
        )}
      </SettingsGroup>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>
        {otherAccount ? t('switcher.hintBoth') : t('switcher.hintOne')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: 'Inter_500Medium', fontSize: 12.5, lineHeight: 17, color: colors.dangerText, paddingHorizontal: 4 },
  hint: { ...text.caption, color: colors.textMuted, paddingHorizontal: 4 },
});
