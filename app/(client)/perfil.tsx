import { router } from 'expo-router';
import { LanguageRow } from '@/src/i18n/LanguageRow';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, HeroCard, IconTile, Muted, PressableScale, Rise, Screen, SectionHeader, SettingsGroup, SettingsRow, StatStrip } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { AccountSwitcher } from '@/src/features/auth/AccountSwitcher';
import { useCompanies } from '@/src/features/client/useClientData';
import { useProviders } from '@/src/features/fitness/connections';
import { providerDisplayName } from '@/src/features/fitness/brands';
import { useFitnessSummary } from '@/src/features/fitness/useFitness';
import { useAchievementLevel } from '@/src/features/fitness/achievements';
import { usePermissions } from '@/src/features/permissions/permissions';
import { appVersionLabel } from '@/src/shared/updates/appVersion';

export default function ClientPerfilScreen() {
  const { t } = useTranslation('client');
  const insets = useSafeAreaInsets();
  const { user, logout, switchTenant } = useAuth();
  const { data: companies } = useCompanies();
  const { data: summary } = useFitnessSummary();
  const lvl = useAchievementLevel();
  const { data: providers } = useProviders();
  const { states, request } = usePermissions(['notifications'], false); // cliente: só a permissão do sistema (o portal não registra aparelho)
  const client = user?.kind === 'client' ? user : null;
  const memberships = client?.memberships ?? [];
  const secondaryLine = client?.email || client?.phone || '—';
  const initials = (client?.name ?? 'C').split(' ').map((w) => w[0]).slice(0, 2).join('');
  const connected = providers?.filter((p) => p.connected).map((p) => providerDisplayName(p.id, p.label)) ?? [];
  const notif = states.notifications;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }}>
        <Rise>
          <HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Avatar initials={initials} size={72} tone="brand" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{client?.name ?? t('profile.client')}</Text>
                <Muted style={{ marginTop: 3 }} numberOfLines={1}>{secondaryLine}</Muted>
              </View>
            </View>
            {summary ? (
              <StatStrip
                style={styles.stats}
                items={[
                  { value: summary.totalSessions, label: t('profile.workouts') },
                  { value: lvl?.level ?? summary.level.level, label: t('profile.level') },
                  { value: summary.streak, label: t('profile.streakDays'), accent: true },
                ]}
              />
            ) : null}
          </HeroCard>
        </Rise>

        {memberships.length ? (
          <>
            <SectionHeader title={t('profile.myCompanies')} />
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
                    accessibilityLabel={active ? t('profile.openNowA11y', { name: m.tenant_name }) : t('profile.switchTo', { name: m.tenant_name })}
                    style={[styles.company, active && styles.companyActive]}
                  >
                    <IconTile initials={info?.initials ?? m.tenant_name.slice(0, 2).toUpperCase()} size={40} tone={i === 0 ? 'brand' : i === 1 ? 'soft' : 'neutral'} />
                    <Text style={styles.companyName} numberOfLines={2}>{m.tenant_name}</Text>
                    <Muted style={[{ fontSize: 12 }, active && { color: colors.primary, fontFamily: typography.fontFamilySemiBold }]} numberOfLines={1}>
                      {active ? t('profile.open') : info?.segment.split(' ')[0] ?? t('profile.switch')}
                    </Muted>
                  </PressableScale>
                );
              })}
            </View>
          </>
        ) : null}

        <SectionHeader title={t('profile.preferences')} />
        <Rise index={1}>
          <SettingsGroup>
            <SettingsRow
              icon="notifications-outline"
              title={t('profile.notifications')}
              subtitle={notif === 'granted' ? t('profile.notifOn') : notif === 'unavailable' ? t('profile.notifPhoneOnly') : t('profile.notifOff')}
              subtitleTone={notif === 'granted' ? 'success' : undefined}
              right={notif === 'undetermined' || notif === 'denied' ? <Button label={t('onboarding.enable')} compact onPress={() => void request('notifications')} /> : undefined}
              onPress={() => router.push('/cliente/permissoes')}
            />
            <SettingsRow icon="calendar-outline" title={t('profile.calendar')} subtitle={t('profile.calendarSub')} onPress={() => router.push('/cliente/calendario')} />
            <SettingsRow
              icon="watch-outline"
              title={t('profile.watches')}
              subtitle={connected.length ? t('onboarding.watch.connected', { names: connected.join(', ') }) : t('profile.watchesSub')}
              subtitleTone={connected.length ? 'success' : undefined}
              onPress={() => router.push('/cliente/relogios')}
            />
            <SettingsRow icon="shield-checkmark-outline" title={t('profile.privacy')} subtitle={t('profile.privacySub')} onPress={() => router.push('/cliente/permissoes')} />
            <LanguageRow syncProfile={false} last />
          </SettingsGroup>
        </Rise>

        <Text style={styles.groupLabel}>{t('profile.accounts')}</Text>
        <Rise index={2}>
          <AccountSwitcher />
        </Rise>
        <Rise index={3} style={{ marginTop: 16 }}>
          <Button label={t('profile.logout')} variant="ghost" onPress={() => void logout().then(() => router.replace('/'))} style={{ minHeight: 48 }} />
        </Rise>
        <Muted style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>{appVersionLabel()}</Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupLabel: { marginTop: 22, marginBottom: 10, ...text.calloutStrong, color: colors.textMuted },
  name: { ...text.title, color: colors.text },
  stats: { marginTop: 18 },
  companies: { flexDirection: 'row', gap: 10 },
  company: { flex: 1, padding: 14, gap: 6, borderRadius: radii.xl - 4, backgroundColor: '#fff', ...shadows.card },
  companyActive: { borderWidth: 2, borderColor: colors.primary },
  companyName: { marginTop: 4, fontFamily: typography.fontFamilyBold, fontSize: 13.5, lineHeight: 17, color: colors.text, flexGrow: 1 },
});
