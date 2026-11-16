import { StyleSheet, Text, View } from 'react-native';
import i18n from '@/src/i18n';
import { Button, Muted, T } from '@/src/design-system/ui';
import { ConnectedLine, ListRow, RowAction } from '../watchParts';
import { ProviderMark } from '../brands';
import { colors, text } from '@/src/design-system/tokens';
import { formatDistance, formatDuration, timeAgo } from '@/src/shared/format';
import { HEALTH_PLATFORM, openHealthSetup } from './healthStore';
import { useConnectHealth, useDisconnectHealth, useHealthAvailability, useHealthState, useSyncHealth } from './useHealth';

/** Textos por plataforma, lidos na hora no idioma atual. */
const copyFor = (p: 'ios' | 'android' | 'web') => ({
  title: i18n.t(`fitness:health.${p}.title`),
  subtitle: i18n.t(`fitness:health.${p}.subtitle`),
  reads: i18n.t(`fitness:health.${p}.reads`),
});
const healthName = () => (HEALTH_PLATFORM === 'android' ? 'Health Connect' : i18n.t('fitness:health.appName'));

/**
 * Saúde (iPhone) ou Health Connect (Android) como linha da lista "Apps e celular": conectar ou sincronizar à direita;
 * tocando, o que é lido, os últimos treinos lidos e desconectar. Onde não dá (web, Expo Go, app não instalado), a linha
 * explica e, quando faz sentido, oferece instalar.
 */
export function HealthRow({ first }: { first: boolean }) {
  const copy = copyFor(HEALTH_PLATFORM ?? 'web');
  const { data: availability } = useHealthAvailability();
  const { data: state } = useHealthState();
  const connect = useConnectHealth();
  const sync = useSyncHealth();
  const disconnect = useDisconnectHealth();
  const connected = !!state?.connected;
  const failed = connect.isError || sync.isError;
  const ready = availability === 'available';
  const installable = availability === 'not_installed' || availability === 'update_required';

  const note =
    availability === 'needs_build'
      ? i18n.t('fitness:health.needsBuild', { name: healthName() })
      : availability === 'unsupported'
        ? i18n.t('fitness:health.unsupported')
        : availability === 'not_installed'
          ? i18n.t('fitness:health.install')
          : availability === 'update_required'
            ? i18n.t('fitness:health.update')
            : null;

  const subtitle = connected ? (
    <ConnectedLine detail={state?.lastSyncAt ? i18n.t('fitness:health.read', { when: timeAgo(state.lastSyncAt) }) : ''} />
  ) : (
    <Muted style={{ marginTop: 2 }}>{note ?? copy.subtitle}</Muted>
  );

  const right = ready ? (
    connected ? (
      <RowAction icon="sync" label={i18n.t('fitness:watch.syncNamed', { name: copy.title })} busy={sync.isPending} onPress={() => sync.mutate()} />
    ) : (
      <RowAction icon="link" label={i18n.t('fitness:watch.connect', { name: copy.title })} busy={connect.isPending} onPress={() => connect.mutate()} />
    )
  ) : installable ? (
    <RowAction
      icon="download-outline"
      label={availability === 'not_installed' ? i18n.t('fitness:health.installBtn') : i18n.t('fitness:health.updateBtn')}
      onPress={() => openHealthSetup(availability)}
    />
  ) : undefined;

  const details = ready ? (
    <>
      {!connected ? <T role="callout" tone="soft">{i18n.t('fitness:health.explain', { reads: copy.reads, name: healthName() })}</T> : null}
      {connected && state?.workouts.length ? (
        <View style={styles.list}>
          {state.workouts.slice(0, 5).map((w, i) => (
            <View key={w.external_id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.rowTitle}>{w.sport}</Text>
              <Muted numberOfLines={1} style={{ marginTop: 2 }}>
                {[timeAgo(w.started_at), formatDuration(w.duration_seconds), w.distance_meters ? formatDistance(w.distance_meters) : null, w.avg_hr ? `${w.avg_hr} bpm` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Muted>
              {w.origin || w.device ? <Muted numberOfLines={1} style={{ marginTop: 1, fontSize: 12 }}>{[w.origin, w.device].filter(Boolean).join(' · ')}</Muted> : null}
            </View>
          ))}
        </View>
      ) : connected && state && !sync.isPending ? (
        <Muted>{state.lastSyncAt ? i18n.t('fitness:health.none') : i18n.t('fitness:health.tapSync')}</Muted>
      ) : null}
      {connected && HEALTH_PLATFORM ? (
        <Muted style={{ fontSize: 12 }}>{HEALTH_PLATFORM === 'ios' ? i18n.t('fitness:health.revokeIos') : i18n.t('fitness:health.revokeAndroid')}</Muted>
      ) : null}
      {connected ? (
        <Button label={i18n.t('fitness:watch.disconnect')} variant="ghost" compact onPress={() => disconnect.mutate()} style={{ alignSelf: 'flex-start' }} />
      ) : null}
    </>
  ) : undefined;

  return (
    <>
      <ListRow
        first={first}
        mark={<ProviderMark id={HEALTH_PLATFORM === 'ios' ? 'applehealth' : 'healthconnect'} label={copy.title} size={40} />}
        title={copy.title}
        subtitle={subtitle}
        right={right}
        details={details}
        toggleLabel={i18n.t('fitness:watch.options', { name: copy.title })}
      />
      {failed ? <T role="caption" style={styles.failed}>{i18n.t('fitness:health.failed')}</T> : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 14, backgroundColor: colors.pageBg, paddingHorizontal: 12 },
  row: { paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { ...text.bodyStrong, color: colors.text },
  failed: { color: colors.dangerText, marginLeft: 66, marginRight: 14, marginBottom: 12 },
});
