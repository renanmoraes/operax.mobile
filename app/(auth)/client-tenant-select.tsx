import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, HeroCard, IconTile, Muted } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AuthShell } from '@/src/features/auth/AuthShell';
import { useCompanies } from '@/src/features/client/useClientData';

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function ClientTenantSelectScreen() {
  const { user, switchTenant } = useAuth();
  const { data: companies } = useCompanies();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const memberships = user?.kind === 'client' ? user.memberships : [];
  const firstName = user?.kind === 'client' ? user.name?.split(' ')[0] : undefined;

  const pick = async (tenantId: string) => {
    setLoadingId(tenantId);
    try {
      await switchTenant(tenantId);
      router.replace('/(client)/inicio');
    } catch {
      /* mantém na tela; sem mensagem dedicada ainda nesta spec */
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <AuthShell
      title={firstName ? `Oi, ${firstName}.\nOnde vamos hoje?` : 'Onde vamos hoje?'}
      subtitle={`Você é cliente de ${memberships.length} empresas que usam Operax. Dá para trocar depois pelo perfil.`}
      footer={<Muted style={{ textAlign: 'center', lineHeight: 19 }}>Não achou sua empresa? Peça para a equipe te cadastrar.</Muted>}
    >
      {memberships.map((m, i) => {
        const info = companies?.find((c) => c.name === m.tenant_name);
        const caps = info
          ? [info.capabilities.scheduling && 'Agenda', info.capabilities.training && 'Treino', info.capabilities.chat && 'Chat'].filter(Boolean)
          : [];
        const busy = loadingId === m.tenant_id;
        const content = (
          <>
            <View style={styles.row}>
              <IconTile initials={info?.initials ?? initialsOf(m.tenant_name)} size={52} tone={i === 0 ? 'brand' : i === 1 ? 'soft' : 'neutral'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.tenant_name}</Text>
                {info ? <Muted style={{ marginTop: 2 }}>{info.segment}</Muted> : null}
              </View>
              {busy ? <ActivityIndicator color={colors.primary} /> : i === 0 ? <Badge label="Último acesso" tone="primary" /> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            </View>
            {caps.length ? (
              <View style={styles.caps}>
                {caps.map((c) => (
                  <View key={String(c)} style={styles.cap}>
                    <Text style={styles.capText}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        );
        return i === 0 ? (
          <HeroCard key={m.tenant_id} onPress={() => pick(m.tenant_id)} accessibilityLabel={`Entrar em ${m.tenant_name}`} style={{ padding: 20 }}>
            {content}
          </HeroCard>
        ) : (
          <Card key={m.tenant_id} onPress={() => pick(m.tenant_id)} accessibilityLabel={`Entrar em ${m.tenant_name}`} style={{ padding: 20 }}>
            {content}
          </Card>
        );
      })}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.text },
  caps: { flexDirection: 'row', gap: 6, marginTop: 16 },
  cap: { height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: 'rgba(240,242,245,0.9)', justifyContent: 'center' },
  capText: { fontFamily: typography.fontFamilyMedium, fontSize: 12, color: colors.textSoft },
});
