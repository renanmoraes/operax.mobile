import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, HeroCard, IconTile, Muted, Num, PressableScale, Rise, Screen, SectionHeader, SettingsGroup, SettingsRow } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useCompanies } from '@/src/features/client/useClientData';
import { useProviders } from '@/src/features/fitness/connections';
import { useFitnessSummary } from '@/src/features/fitness/useFitness';
import { usePermissions } from '@/src/features/permissions/permissions';

export default function ClientPerfilScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, clearRole, switchTenant, mode } = useAuth();
  const { data: companies } = useCompanies();
  const { data: summary } = useFitnessSummary();
  const { data: providers } = useProviders();
  const { states, request } = usePermissions(['notifications'], mode === 'live');
  const client = user?.kind === 'client' ? user : null;
  const memberships = client?.memberships ?? [];
  const secondaryLine = client?.email || client?.phone || '—';
  const initials = (client?.name ?? 'C').split(' ').map((w) => w[0]).slice(0, 2).join('');
  const connected = providers?.filter((p) => p.connected).map((p) => p.label) ?? [];
  const notif = states.notifications;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }}>
        <Rise>
          <HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Avatar initials={initials} size={72} tone="brand" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{client?.name ?? 'Cliente'}</Text>
                <Muted style={{ marginTop: 3 }} numberOfLines={1}>{secondaryLine}</Muted>
              </View>
            </View>
            {summary ? (
              <View style={styles.stats}>
                {[
                  [String(summary.totalSessions), 'treinos'],
                  [String(summary.level.level), 'nível'],
                  [String(summary.streak), 'dias seguidos'],
                ].map(([v, l], i) => (
                  <View key={l} style={styles.stat}>
                    <Num style={[{ fontSize: 19 }, i === 2 && { color: colors.primary }]}>{v}</Num>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>{l}</Muted>
                  </View>
                ))}
              </View>
            ) : null}
          </HeroCard>
        </Rise>

        {memberships.length ? (
          <>
            <SectionHeader title="Minhas empresas" />
            <View style={styles.companies}>
              {memberships.map((m, i) => {
                const active = m.tenant_id === client?.active_tenant_id;
                const info = companies?.find((c) => c.name === m.tenant_name);
                return (
                  <PressableScale
                    key={m.tenant_id}
                    disabled={active}
                    onPress={() => switchTenant(m.tenant_id).catch(() => {})}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={active ? `${m.tenant_name}, aberta agora` : `Trocar para ${m.tenant_name}`}
                    style={[styles.company, active && styles.companyActive]}
                  >
                    <IconTile initials={info?.initials ?? m.tenant_name.slice(0, 2).toUpperCase()} size={40} tone={i === 0 ? 'brand' : i === 1 ? 'soft' : 'neutral'} />
                    <Text style={styles.companyName} numberOfLines={2}>{m.tenant_name}</Text>
                    <Muted style={[{ fontSize: 12 }, active && { color: colors.primary, fontFamily: typography.fontFamilySemiBold }]} numberOfLines={1}>
                      {active ? 'Aberta' : info?.segment.split(' ')[0] ?? 'Trocar'}
                    </Muted>
                  </PressableScale>
                );
              })}
            </View>
          </>
        ) : null}

        <SectionHeader title="Preferências" />
        <Rise index={1}>
          <SettingsGroup>
            <SettingsRow
              icon="notifications-outline"
              title="Notificações"
              subtitle={notif === 'granted' ? 'Lembretes e mensagens ativados' : notif === 'unavailable' ? 'Disponível no app do celular' : 'Desativadas'}
              subtitleTone={notif === 'granted' ? 'success' : undefined}
              right={notif === 'undetermined' || notif === 'denied' ? <Button label="Ativar" compact onPress={() => void request('notifications')} /> : undefined}
              onPress={() => router.push('/cliente/permissoes')}
            />
            <SettingsRow icon="calendar-outline" title="Calendário do celular" subtitle="Assinar a agenda" onPress={() => router.push('/cliente/calendario')} />
            <SettingsRow
              icon="watch-outline"
              title="Relógios e apps"
              subtitle={connected.length ? `${connected.join(', ')} conectado` : 'Garmin, Strava e Polar'}
              subtitleTone={connected.length ? 'success' : undefined}
              onPress={() => router.push('/cliente/relogios')}
            />
            <SettingsRow icon="shield-checkmark-outline" title="Privacidade" subtitle="Fotos de evolução: você e seu personal" onPress={() => router.push('/cliente/permissoes')} last />
          </SettingsGroup>
        </Rise>

        <Rise index={2} style={{ marginTop: 16, gap: 10 }}>
          <Button label="Entrar como equipe" icon="headset-outline" variant="secondary" onPress={() => clearRole().then(() => router.replace('/(auth)/role-select'))} />
          <Button label="Sair da conta" variant="ghost" onPress={() => logout()} style={{ minHeight: 48 }} />
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: typography.fontFamilyHeavy, fontSize: 21, letterSpacing: -0.4, color: colors.text },
  stats: { flexDirection: 'row', gap: 8, marginTop: 18 },
  stat: { flex: 1, padding: 12, borderRadius: radii.lg - 2, backgroundColor: 'rgba(255,255,255,0.85)', ...shadows.card },
  companies: { flexDirection: 'row', gap: 10 },
  company: { flex: 1, padding: 14, gap: 6, borderRadius: radii.xl - 4, backgroundColor: '#fff', ...shadows.card },
  companyActive: { borderWidth: 2, borderColor: colors.primary },
  companyName: { marginTop: 4, fontFamily: typography.fontFamilyBold, fontSize: 13.5, lineHeight: 17, color: colors.text, flexGrow: 1 },
});
