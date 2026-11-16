import { router } from 'expo-router';
import i18n from '@/src/i18n';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, HeroCard, IconTile, Muted, Num, Rise, Screen, SectionHeader, T, TopBar } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { useImportedSessions, useProviders } from '@/src/features/fitness/connections';
import { HealthRow } from '@/src/features/fitness/health/HealthCard';
import { DataSourceAttribution, GarminAttribution } from '@/src/features/fitness/brands';
import { HEALTH_PLATFORM } from '@/src/features/fitness/health/healthStore';
import { phoneHealthCards, watchGroups } from '@/src/features/fitness/integrations';
import { FlowStrip, GalaxyRow, IntegrationList } from '@/src/features/fitness/watchParts';
import { formatDistance, formatDuration, timeAgo } from '@/src/shared/format';

/**
 * Relógios e apps, cada um uma vez. Relógios: uma conexão só, que manda o treino do plano e traz o treino feito. Apps e
 * celular: o que só traz o treino feito (Strava e o Saúde do celular). Conectado tem sincronizar à direita e as opções
 * ao tocar na linha.
 */
export default function WatchConnectionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: providers } = useProviders();
  const { data: sessions } = useImportedSessions();
  const totalImported = providers?.reduce((n, p) => n + p.imported, 0) ?? 0;
  const garminDevice = sessions?.flatMap((s) => s.sources).find((src) => src.provider === 'garmin')?.device;
  const garminConnected = providers?.some((p) => p.id === 'garmin' && p.connected);
  const groups = watchGroups(providers);
  const cards = phoneHealthCards(HEALTH_PLATFORM);
  const healthName = HEALTH_PLATFORM === 'ios' ? i18n.t('fitness:health.ios.title') : 'Health Connect';

  return (
    <Screen>
      <TopBar safe title={i18n.t('fitness:tab.watches')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <Rise>
          <HeroCard>
            <FlowStrip />
            <View style={styles.heroDivider} />
            {garminConnected ? <GarminAttribution device={garminDevice} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: garminConnected ? 8 : 0 }}>
              <Num size="xl">{totalImported}</Num>
              <T role="callout" tone="muted">{i18n.t('fitness:watch.imported')}</T>
            </View>
            <Muted style={{ marginTop: 6 }}>{i18n.t('fitness:watch.heroBody')}</Muted>
          </HeroCard>
        </Rise>

        <SectionHeader title={i18n.t('fitness:watch.sectionWatches')} style={styles.section} />
        <Rise index={1}>
          <IntegrationList items={groups.watches} kind="watch" healthName={healthName} extra={cards.includes('galaxy') ? (first) => <GalaxyRow first={first} /> : undefined} />
        </Rise>

        <SectionHeader title={i18n.t('fitness:watch.sectionApps')} style={styles.section} />
        <Rise index={2}>
          <IntegrationList items={groups.apps} kind="app" healthName={healthName} extra={(first) => <HealthRow first={first} />} />
        </Rise>

        {sessions?.length ? (
          <>
            <SectionHeader title={i18n.t('fitness:watch.lastImported')} style={styles.section} />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {sessions.map((s, i) => (
                <View key={s.id} style={[styles.session, i < sessions.length - 1 && styles.sessionBorder]}>
                  <IconTile icon={s.distance_meters ? 'walk-outline' : 'barbell-outline'} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sessionTitle}>{s.sport ?? i18n.t('fitness:watch.activity')}</Text>
                    <DataSourceAttribution provider={s.provider} sources={s.sources} style={{ marginTop: 3 }} />
                    <Muted style={{ marginTop: 3 }}>
                      {[timeAgo(s.started_at), formatDuration(s.duration_seconds), s.distance_meters ? formatDistance(s.distance_meters) : null, s.avg_hr ? `${s.avg_hr} bpm` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Muted>
                  </View>
                  <Badge label={s.status === 'imported' ? i18n.t('fitness:watch.inPlan') : i18n.t('fitness:watch.free')} tone={s.status === 'imported' ? 'primary' : 'neutral'} />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  section: { marginTop: 26 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 14 },
  provider: { padding: 16, gap: 14 },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  providerName: { ...text.section, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sessionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  sessionTitle: { ...text.bodyStrong, color: colors.text },
});
