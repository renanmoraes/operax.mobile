import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, IconTile, Muted, T } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { formatDistance, formatDuration, timeAgo } from '@/src/shared/format';
import { HEALTH_PLATFORM, openHealthSetup } from './healthStore';
import { useConnectHealth, useDisconnectHealth, useHealthAvailability, useHealthState, useSyncHealth } from './useHealth';

const COPY = {
  ios: { title: 'Saúde do iPhone', subtitle: 'Apple Watch e apps que salvam treinos no Saúde', reads: 'tipo de treino, duração, distância, calorias e batimentos' },
  android: { title: 'Health Connect', subtitle: 'Samsung Galaxy (Samsung Health), Google Fit e outros', reads: 'tipo de exercício, duração, distância, calorias e batimentos' },
  web: { title: 'Saúde do celular', subtitle: 'Saúde no iPhone e Health Connect no Android', reads: '' },
} as const;

/**
 * Cartão do Saúde (iPhone) ou do Health Connect (Android). Explica o que vai ser lido
 * antes de abrir a janela de permissão do sistema.
 */
export function HealthCard() {
  const copy = COPY[HEALTH_PLATFORM ?? 'web'];
  const { data: availability } = useHealthAvailability();
  const { data: state } = useHealthState();
  const connect = useConnectHealth();
  const sync = useSyncHealth();
  const disconnect = useDisconnectHealth();
  const connected = !!state?.connected;
  const failed = connect.isError || sync.isError;

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <IconTile icon="heart" size={44} tone={connected ? 'brand' : 'soft'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{copy.title}</Text>
          {connected ? (
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <T role="captionStrong" style={{ color: colors.success }}>Conectado</T>
              <Muted>{state?.lastSyncAt ? `· lido ${timeAgo(state.lastSyncAt)}` : ''}</Muted>
            </View>
          ) : (
            <Muted style={{ marginTop: 2 }}>{copy.subtitle}</Muted>
          )}
        </View>
      </View>

      {availability === 'needs_build' ? (
        <T role="callout" tone="soft">
          Para ler o {HEALTH_PLATFORM === 'android' ? 'Health Connect' : 'Saúde'}, use o app do Operax instalado no celular. No Expo Go essa leitura não está disponível.
        </T>
      ) : null}

      {availability === 'unsupported' ? (
        <T role="callout" tone="soft">Abra o Operax no celular para conectar o Saúde (iPhone) ou o Health Connect (Android).</T>
      ) : null}

      {availability === 'not_installed' || availability === 'update_required' ? (
        <View style={{ gap: 10 }}>
          <T role="callout" tone="soft">
            {availability === 'not_installed'
              ? 'Instale o Health Connect para trazer seus treinos. Em celulares Galaxy, depois ative no Samsung Health: Ajustes › Health Connect.'
              : 'Atualize o Health Connect para continuar.'}
          </T>
          <Button
            label={availability === 'not_installed' ? 'Instalar Health Connect' : 'Atualizar Health Connect'}
            compact
            icon="download-outline"
            onPress={() => openHealthSetup(availability)}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
      ) : null}

      {availability === 'available' && !connected ? (
        <View style={{ gap: 10 }}>
          <T role="callout" tone="soft">
            {`O Operax vai ler só ${copy.reads} dos últimos 30 dias, para marcar os treinos da sua ficha. Nada é escrito no ${HEALTH_PLATFORM === 'android' ? 'Health Connect' : 'Saúde'}.`}
          </T>
          <Button label={`Conectar ${copy.title}`} compact loading={connect.isPending} onPress={() => connect.mutate()} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}

      {availability === 'available' && connected ? (
        <View style={styles.actions}>
          <Button label="Sincronizar" variant="soft" compact icon="sync" loading={sync.isPending} onPress={() => sync.mutate()} style={{ flex: 1 }} />
          <Button label="Desconectar" variant="ghost" compact onPress={() => disconnect.mutate()} style={{ flex: 1 }} />
        </View>
      ) : null}

      {failed ? <T role="caption" style={{ color: colors.dangerText }}>Não deu para ler agora. Confira o acesso do Operax nos ajustes e tente de novo.</T> : null}

      {connected && state?.workouts.length ? (
        <View style={styles.list}>
          {state.workouts.slice(0, 5).map((w, i) => (
            <View key={w.external_id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{w.sport}</Text>
                <Muted numberOfLines={1} style={{ marginTop: 2 }}>
                  {[timeAgo(w.started_at), formatDuration(w.duration_seconds), w.distance_meters ? formatDistance(w.distance_meters) : null, w.avg_hr ? `${w.avg_hr} bpm` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
                {w.origin || w.device ? <Muted numberOfLines={1} style={{ marginTop: 1, fontSize: 12 }}>{[w.origin, w.device].filter(Boolean).join(' · ')}</Muted> : null}
              </View>
            </View>
          ))}
        </View>
      ) : connected && state && !sync.isPending ? (
        <Muted>{state.lastSyncAt ? 'Nenhum treino nos últimos 30 dias.' : 'Toque em Sincronizar para trazer seus treinos.'}</Muted>
      ) : null}

      {connected && HEALTH_PLATFORM ? (
        <Muted style={{ fontSize: 12 }}>
          {HEALTH_PLATFORM === 'ios' ? 'Para tirar o acesso: Ajustes › Saúde › Acesso a Dados › Operax.' : 'Para tirar o acesso: Health Connect › Permissões do app › Operax.'}
        </Muted>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { ...text.section, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  actions: { flexDirection: 'row', gap: 8 },
  list: { borderRadius: 16, backgroundColor: colors.pageBg, paddingHorizontal: 12 },
  row: { paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { ...text.bodyStrong, color: colors.text },
});
