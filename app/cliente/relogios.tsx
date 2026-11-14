import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, HeroCard, IconTile, Muted, Num, Rise, Screen, SectionHeader, TopBar } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import {
  useConnectProvider,
  useDisconnectProvider,
  useImportedSessions,
  useProviders,
  useSyncProvider,
} from '@/src/features/fitness/connections';
import type { ProviderView } from '@/src/features/fitness/types';
import { formatDistance, formatDuration, timeAgo } from '@/src/shared/format';

const initials: Record<ProviderView['id'], string> = { garmin: 'GA', strava: 'ST', polar: 'PO', apple: 'AW', coros: 'CO', zepp: 'ZP' };

function ProviderCard({ p }: { p: ProviderView }) {
  const connect = useConnectProvider();
  const sync = useSyncProvider();
  const disconnect = useDisconnectProvider();
  const busy = connect.isPending && connect.variables === p.id;
  return (
    <Card style={styles.provider}>
      <View style={styles.providerTop}>
        <IconTile initials={initials[p.id]} size={46} tone={p.connected ? 'brand' : p.state === 'soon' ? 'neutral' : 'soft'} />
        <View style={{ flex: 1 }}>
          <Text style={styles.providerName}>{p.label}</Text>
          <Muted style={{ marginTop: 2 }}>
            {p.connected
              ? `Sincronizado ${p.last_sync_at ? timeAgo(p.last_sync_at) : 'agora'} · ${p.imported} treinos`
              : p.state === 'soon'
                ? 'Chega em breve'
                : 'Importa treinos automaticamente'}
          </Muted>
        </View>
        {p.state === 'soon' ? <Badge label="Em breve" /> : p.connected ? <Badge label="Conectado" tone="success" icon="checkmark" /> : null}
      </View>
      {p.state === 'available' ? (
        p.connected ? (
          <View style={styles.actions}>
            <Button label="Sincronizar" variant="soft" compact icon="sync" loading={sync.isPending} onPress={() => sync.mutate(p.id)} style={{ flex: 1 }} />
            <Button label="Desconectar" variant="ghost" compact onPress={() => disconnect.mutate(p.id)} style={{ flex: 1 }} />
          </View>
        ) : (
          <Button label={`Conectar ${p.label}`} compact loading={busy} onPress={() => connect.mutate(p.id)} />
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
  const healthName = Platform.OS === 'android' ? 'Health Connect' : 'Apple Saúde';

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <TopBar title="Relógios e apps" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <Rise>
          <HeroCard>
            <Text style={styles.heroLabel}>Seus treinos chegam sozinhos</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 }}>
              <Num style={{ fontSize: 40 }}>{totalImported}</Num>
              <Muted style={{ marginBottom: 7, fontSize: 14 }}>treinos importados</Muted>
            </View>
            <Muted style={{ marginTop: 8, lineHeight: 19, fontSize: 13.5, color: colors.textSoft }}>
              Quando o relógio grava um treino que bate com a sua ficha, ele já entra como feito. O que não bate fica como treino livre.
            </Muted>
          </HeroCard>
        </Rise>

        <SectionHeader title="Relógios e apps" />
        <View style={{ gap: 10 }}>
          {providers?.map((p, i) => (
            <Rise key={p.id} index={i + 1}>
              <ProviderCard p={p} />
            </Rise>
          ))}
        </View>

        <SectionHeader title="Sensores do celular" />
        <Card style={styles.provider}>
          <View style={styles.providerTop}>
            <IconTile icon="heart-outline" size={46} tone="neutral" />
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName}>{healthName}</Text>
              <Muted style={{ marginTop: 2, lineHeight: 18 }}>Passos, batimentos e treinos gravados pelo próprio celular.</Muted>
            </View>
            <Badge label="Em breve" />
          </View>
        </Card>

        {sessions?.length ? (
          <>
            <SectionHeader title="Últimos importados" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {sessions.map((s, i) => (
                <View key={s.id} style={[styles.session, i < sessions.length - 1 && styles.sessionBorder]}>
                  <IconTile icon={s.distance_meters ? 'walk-outline' : 'barbell-outline'} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>{s.sport ?? 'Atividade'}</Text>
                    <Muted style={{ marginTop: 2 }}>
                      {[timeAgo(s.started_at), formatDuration(s.duration_seconds), s.distance_meters ? formatDistance(s.distance_meters) : null, s.avg_hr ? `${s.avg_hr} bpm` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Muted>
                  </View>
                  <Badge label={s.status === 'imported' ? 'Na ficha' : 'Livre'} tone={s.status === 'imported' ? 'primary' : 'neutral'} />
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
  heroLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  provider: { padding: 16, gap: 14 },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  providerName: { fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sessionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  sessionTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
});
