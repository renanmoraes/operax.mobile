import { router } from 'expo-router';
import i18n from '@/src/i18n';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, HeroCard, IconTile, Muted, Num, Rise, Screen, SectionHeader, T, TopBar } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import {
  useConnectProvider,
  useDisconnectProvider,
  useImportedSessions,
  useProviders,
  useSyncProvider,
} from '@/src/features/fitness/connections';
import { HealthCard } from '@/src/features/fitness/health/HealthCard';
import { DataSourceAttribution, GarminAttribution, ProviderMark, providerDisplayName, StravaConnectButton, WorksWithZepp } from '@/src/features/fitness/brands';
import type { ProviderView } from '@/src/features/fitness/types';
import { formatDistance, formatDuration, timeAgo } from '@/src/shared/format';

function ProviderCard({ p }: { p: ProviderView }) {
  const connect = useConnectProvider();
  const sync = useSyncProvider();
  const disconnect = useDisconnectProvider();
  const busy = connect.isPending && connect.variables === p.id;
  const name = providerDisplayName(p.id, p.label);
  return (
    <Card style={styles.provider}>
      <View style={styles.providerTop}>
        <ProviderMark id={p.id} label={p.label} muted={p.state === 'soon'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* A Garmin não permite abreviar nem cortar o nome do app: sem numberOfLines aqui. */}
          <Text style={styles.providerName}>{name}</Text>
          {p.connected ? (
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <T role="captionStrong" style={{ color: colors.success }}>{i18n.t('fitness:watch.connected')}</T>
              <Muted>{`· ${p.last_sync_at ? timeAgo(p.last_sync_at) : i18n.t('time.now')} · ${i18n.t('fitness:watch.workouts', { count: p.imported })}`}</Muted>
            </View>
          ) : (
            <Muted style={{ marginTop: 2 }}>
              {p.id === 'apple' ? i18n.t('fitness:watch.viaHealth') : p.state === 'soon' ? i18n.t('fitness:watch.comingSoon') : i18n.t('fitness:watch.autoImport')}
            </Muted>
          )}
        </View>
        {p.state === 'soon' && p.id !== 'apple' ? <Badge label={i18n.t('fitness:watch.soon')} /> : null}
      </View>
      {p.id === 'zepp' && p.state === 'available' ? <WorksWithZepp /> : null}
      {p.state === 'available' ? (
        p.connected ? (
          <View style={styles.actions}>
            <Button label={i18n.t('fitness:watch.sync')} variant="soft" compact icon="sync" loading={sync.isPending} onPress={() => sync.mutate(p.id)} style={{ flex: 1 }} />
            <Button label={i18n.t('fitness:watch.disconnect')} variant="ghost" compact onPress={() => disconnect.mutate(p.id)} style={{ flex: 1 }} />
          </View>
        ) : p.id === 'strava' ? (
          <StravaConnectButton disabled={busy} onPress={() => connect.mutate(p.id)} />
        ) : (
          <Button label={i18n.t('fitness:watch.connect', { name })} compact loading={busy} onPress={() => connect.mutate(p.id)} style={{ alignSelf: 'flex-start' }} />
        )
      ) : null}
    </Card>
  );
}

export default function WatchConnectionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: providers } = useProviders();
  const { data: sessions } = useImportedSessions();
  const totalImported = providers?.reduce((n, p) => n + p.imported, 0) ?? 0;
  const garminDevice = sessions?.flatMap((s) => s.sources).find((src) => src.provider === 'garmin')?.device;
  const garminConnected = providers?.some((p) => p.id === 'garmin' && p.connected);

  return (
    <Screen>
      <TopBar safe title={i18n.t('fitness:tab.watches')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <Rise>
          <HeroCard>
            <T role="captionStrong" tone="muted">{i18n.t('fitness:watch.heroTitle')}</T>
            {garminConnected ? <GarminAttribution device={garminDevice} style={{ marginTop: 8 }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <Num size="xl">{totalImported}</Num>
              <T role="callout" tone="muted">{i18n.t('fitness:watch.imported')}</T>
            </View>
            <T role="callout" tone="soft" style={{ marginTop: 8 }}>
              {i18n.t('fitness:watch.heroBody')}
            </T>
          </HeroCard>
        </Rise>

        <SectionHeader title={i18n.t('fitness:tab.watches')} />
        <View style={{ gap: 10 }}>
          {providers?.map((p, i) => (
            <Rise key={p.id} index={i + 1}>
              <ProviderCard p={p} />
            </Rise>
          ))}
        </View>

        <SectionHeader title={i18n.t('fitness:watch.phoneHealth')} />
        <HealthCard />

        {sessions?.length ? (
          <>
            <SectionHeader title={i18n.t('fitness:watch.lastImported')} />
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
