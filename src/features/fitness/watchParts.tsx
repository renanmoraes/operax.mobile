import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/src/i18n';
import { Badge, Button, Card, IconButton, Muted, PressableScale, T } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { ProviderMark, providerDisplayName } from './brands';
import { useConnectProvider, useDisconnectProvider, useSavePushPrefs, useSyncProvider } from './connections';
import { useConnectHealth, useHealthAvailability, useHealthState } from './health/useHealth';
import { toggleKind, WATCH_KINDS, type IntegrationItem } from './integrations';
import type { ProviderView } from './types';
import { timeAgo } from '@/src/shared/format';

const MARK = require('@/assets/brand/operax-mark.png');
const SAMSUNG_HEALTH = 'com.sec.android.app.shealth';

/** Três pontos que correm de um lado para o outro, no sentido em que o treino viaja (`back`: de volta). */
function FlowDots({ back = false }: { back?: boolean }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const dots = [0, 1, 2].map((i) => {
    const start = (back ? 2 - i : i) / 4;
    const opacity = t.interpolate({ inputRange: [0, start, start + 0.25, start + 0.5, 1], outputRange: [0.25, 0.25, 1, 0.25, 0.25], extrapolate: 'clamp' });
    return <Animated.View key={i} style={[styles.dot, { opacity }]} />;
  });
  return (
    <View style={styles.dots}>
      {back ? <Ionicons name="chevron-back" size={14} color={colors.primary} /> : null}
      {dots}
      {back ? null : <Ionicons name="chevron-forward" size={14} color={colors.primary} />}
    </View>
  );
}

/**
 * Cabeçalho de cada bloco da tela com o desenho do caminho do treino: em Dispositivos o treino vai e volta (Operax ⇄
 * aparelho); em Apps e celular ele só chega (app → Operax). Os pontos correndo mostram o sentido.
 */
export function BlockHeader({ title, mode }: { title: string; mode: 'both' | 'in' }) {
  const operax = (
    <View style={styles.operax}>
      <Image source={MARK} style={{ width: 20, height: 20 }} resizeMode="contain" />
    </View>
  );
  const device = (
    <View style={styles.watch}>
      <Ionicons name={mode === 'both' ? 'watch-outline' : 'apps-outline'} size={19} color={colors.primaryDeep} />
    </View>
  );
  const label = mode === 'both' ? `${i18n.t('fitness:watch.flowOut')}. ${i18n.t('fitness:watch.flowIn')}.` : i18n.t('fitness:watch.flowIn');
  return (
    <View style={styles.block}>
      <View style={styles.flowRow} accessible accessibilityLabel={label}>
        {mode === 'both' ? operax : device}
        {mode === 'both' ? (
          <View style={{ gap: 6 }}>
            <FlowDots />
            <FlowDots back />
          </View>
        ) : (
          <FlowDots />
        )}
        {mode === 'both' ? device : operax}
      </View>
      <Text style={styles.blockTitle} accessibilityRole="header">{title}</Text>
    </View>
  );
}

export function Status({ label }: { label: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusDot} />
      <T role="captionStrong" style={{ color: colors.success, flexShrink: 1 }}>
        {label}
      </T>
    </View>
  );
}

/**
 * Linha das listas da tela (dispositivos, apps e celular): marca, nome, subtítulo e uma ação à direita. `details` abre
 * ao tocar na linha (com a seta); a ação à direita fica fora da área tocável (botão dentro de botão quebra na web).
 */
export function ListRow({ mark, title, subtitle, right, details, first, toggleLabel }: {
  mark: ReactNode; title: string; subtitle: ReactNode; right?: ReactNode; details?: ReactNode; first: boolean; toggleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const head = (
    <>
      {mark}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* A Garmin não permite abreviar nem cortar o nome do app: sem numberOfLines aqui. */}
        <Text style={styles.rowName}>{title}</Text>
        {subtitle}
      </View>
      {details ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} /> : null}
    </>
  );
  return (
    <View style={!first && styles.rowBorder}>
      <View style={styles.row}>
        {details ? (
          <PressableScale onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={toggleLabel} style={styles.rowPress}>
            {head}
          </PressableScale>
        ) : (
          <View style={styles.rowPress}>{head}</View>
        )}
        {right}
      </View>
      {details && open ? <View style={styles.details}>{details}</View> : null}
    </View>
  );
}

/** Ação à direita da linha: conectar (link), sincronizar, ou carregando. */
export function RowAction({ icon, label, busy, onPress }: { icon: 'link' | 'sync' | 'download-outline'; label: string; busy?: boolean; onPress: () => void }) {
  return busy ? (
    <View style={styles.iconSlot}><ActivityIndicator color={colors.primary} /></View>
  ) : (
    <IconButton icon={icon} tone="soft" size={40} accessibilityLabel={label} onPress={onPress} />
  );
}

export function ConnectedLine({ detail }: { detail: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusDot} />
      <T role="captionStrong" style={{ color: colors.success }}>{i18n.t('fitness:watch.connected')}</T>
      {detail ? <Muted>{`· ${detail}`}</Muted> : null}
    </View>
  );
}

/** Mandar sozinho e os tipos de treino de um relógio. Os tipos ficam apagados (não somem) com o envio automático desligado. */
function PushPrefs({ provider }: { provider: ProviderView }) {
  const save = useSavePushPrefs();
  const prefs = provider.push ?? { auto: true, kinds: WATCH_KINDS.map((k) => k.id) };
  const set = (next: typeof prefs) => save.mutate({ id: provider.id, prefs: next });
  return (
    <View style={styles.prefs}>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.panelTitle}>{i18n.t('fitness:watch.autoTitle')}</Text>
          <Muted style={{ marginTop: 2 }}>{prefs.auto ? i18n.t('fitness:watch.autoOn') : i18n.t('fitness:watch.autoOff')}</Muted>
        </View>
        <Switch
          value={prefs.auto}
          onValueChange={(auto) => set({ ...prefs, auto })}
          accessibilityLabel={i18n.t('fitness:watch.autoTitle')}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#fff"
        />
      </View>
      <View style={styles.kindsBlock}>
        <T role="captionStrong" tone="soft">{i18n.t('fitness:watch.kindsTitle')}</T>
        <View style={[styles.kinds, !prefs.auto && { opacity: 0.45 }]}>
          {WATCH_KINDS.map((k) => {
            const on = prefs.kinds.includes(k.id);
            return (
              <PressableScale
                key={k.id}
                disabled={!prefs.auto}
                onPress={() => set({ ...prefs, kinds: toggleKind(prefs.kinds, k.id) })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !prefs.auto }}
                style={[styles.kind, on && styles.kindOn]}
              >
                <Ionicons name={on ? 'checkmark' : k.icon} size={15} color={on ? colors.primary : colors.textMuted} />
                <Text style={[styles.kindText, on && { color: colors.primaryDeep }]} numberOfLines={1}>
                  {i18n.t(`fitness:watch.kind.${k.id}`)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <Muted>{prefs.auto ? i18n.t('fitness:watch.kindsBody') : i18n.t('fitness:watch.kindsOff')}</Muted>
      </View>
    </View>
  );
}

/**
 * Uma linha de dispositivo ou app. Sem conexão: conectar à direita (ícone de link), ou "Em breve". Conectado: sincronizar
 * à direita e, tocando na linha, as opções (envio para o aparelho, quando ele recebe treino, e desconectar).
 */
function IntegrationRow({ item, kind, healthName, first }: { item: IntegrationItem; kind: 'watch' | 'app'; healthName: string; first: boolean }) {
  const connect = useConnectProvider();
  const sync = useSyncProvider();
  const disconnect = useDisconnectProvider();
  const p = item.provider;
  const name = providerDisplayName(item.id, item.label);
  const sends = !!(p?.can_push && p.push);
  const subtitle =
    item.connected && p ? (
      <>
        <ConnectedLine detail={`${p.last_sync_at ? timeAgo(p.last_sync_at) : i18n.t('time.now')} · ${i18n.t('fitness:watch.workouts', { count: p.imported })}`} />
        {sends && p.push ? (
          <Muted style={{ marginTop: 2 }}>{p.push.auto ? i18n.t('fitness:watch.pushAuto', { count: p.push.kinds.length }) : i18n.t('fitness:watch.pushManual')}</Muted>
        ) : null}
      </>
    ) : (
      <Muted style={{ marginTop: 2 }}>
        {item.state === 'soon'
          ? item.id === 'apple'
            ? i18n.t('fitness:watch.soonOut', { health: healthName })
            : i18n.t('fitness:watch.soonBoth')
          : kind === 'watch' && (sends || item.id === 'garmin')
            ? i18n.t('fitness:watch.watchBoth')
            : i18n.t('fitness:watch.capIn')}
      </Muted>
    );
  const right =
    item.state === 'soon' ? (
      <Badge label={i18n.t('fitness:watch.soon')} />
    ) : item.connected ? (
      <RowAction icon="sync" label={i18n.t('fitness:watch.syncNamed', { name })} busy={sync.isPending} onPress={() => sync.mutate(item.id)} />
    ) : (
      <RowAction icon="link" label={i18n.t('fitness:watch.connect', { name })} busy={connect.isPending && connect.variables === item.id} onPress={() => connect.mutate(item.id)} />
    );
  const details =
    item.connected && p ? (
      <>
        {sends ? (
          <>
            <T role="captionStrong" tone="soft">{i18n.t('fitness:watch.pushTitle')}</T>
            <PushPrefs provider={p} />
          </>
        ) : null}
        <Button label={i18n.t('fitness:watch.disconnect')} variant="ghost" compact onPress={() => disconnect.mutate(item.id)} style={{ alignSelf: 'flex-start' }} />
      </>
    ) : undefined;
  return (
    <ListRow
      first={first}
      mark={<ProviderMark id={item.id} label={item.label} size={40} />}
      title={name}
      subtitle={subtitle}
      right={right}
      details={details}
      toggleLabel={i18n.t('fitness:watch.options', { name })}
    />
  );
}

/** Lista de dispositivos ou de apps (`extra`: linhas do celular, como o Saúde e o Galaxy Watch); a dos dispositivos termina com os que já chegam por outro caminho. */
export function IntegrationList({ items, kind, healthName, extra }: { items: IntegrationItem[]; kind: 'watch' | 'app'; healthName: string; extra?: (first: boolean) => ReactNode }) {
  return (
    <Card style={styles.list}>
      {items.map((item, i) => (
        <IntegrationRow key={item.id} item={item} kind={kind} healthName={healthName} first={i === 0} />
      ))}
      {extra ? extra(items.length === 0) : null}
      {kind === 'watch' ? (
        <View style={[styles.row, items.length > 0 && styles.rowBorder]}>
          <View style={styles.others}>
            <Ionicons name="apps-outline" size={19} color={colors.textSoft} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowName}>{i18n.t('fitness:watch.othersTitle')}</Text>
            <Muted style={{ marginTop: 2 }}>{i18n.t('fitness:watch.othersBody', { health: healthName })}</Muted>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** Abre o Samsung Health (pela loja, que mostra "Abrir" quando já está instalado). */
function openSamsungHealth() {
  Linking.openURL(`market://details?id=${SAMSUNG_HEALTH}`).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${SAMSUNG_HEALTH}`));
}

/**
 * Galaxy Watch: o relógio grava no Samsung Health, que repassa ao Health Connect, de onde o Operax lê. Linha da lista de
 * dispositivos: conectar o Health Connect à direita; tocando, os passos no Samsung Health.
 */
export function GalaxyRow({ first }: { first: boolean }) {
  const { data: availability } = useHealthAvailability();
  const { data: state } = useHealthState();
  const connect = useConnectHealth();
  const connected = !!state?.connected;
  return (
    <ListRow
      first={first}
      mark={<ProviderMark id="galaxy" label="Galaxy Watch" size={40} />}
      title="Galaxy Watch"
      subtitle={connected ? <Status label={i18n.t('fitness:watch.galaxyOn')} /> : <Muted style={{ marginTop: 2 }}>{i18n.t('fitness:watch.galaxySubtitle')}</Muted>}
      right={!connected && availability === 'available' ? (
        <RowAction icon="link" label={i18n.t('fitness:watch.connect', { name: 'Galaxy Watch' })} busy={connect.isPending} onPress={() => connect.mutate()} />
      ) : undefined}
      details={
        <>
          {!connected ? <T role="callout" tone="soft">{i18n.t('fitness:watch.galaxySteps')}</T> : null}
          <Button label={i18n.t('fitness:watch.galaxyOpen')} variant="soft" compact icon="open-outline" onPress={openSamsungHealth} style={{ alignSelf: 'flex-start' }} />
        </>
      }
      toggleLabel={i18n.t('fitness:watch.options', { name: 'Galaxy Watch' })}
    />
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 28, marginBottom: 12, gap: 10 },
  blockTitle: { ...text.title, color: colors.text },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  operax: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.chromeNavy, alignItems: 'center', justifyContent: 'center' },
  watch: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  rowName: { ...text.bodyStrong, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  rowPress: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Opções do conectado: recuadas até o texto da linha, com fundo suave, para ler como "deste relógio".
  details: { marginLeft: 66, marginRight: 14, marginBottom: 14, gap: 10 },
  prefs: { gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.pageBg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelTitle: { ...text.bodyStrong, color: colors.text },
  kindsBlock: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg },
  kindOn: { borderColor: colors.primarySoft, backgroundColor: colors.primaryWash },
  kindText: { ...text.captionStrong, color: colors.textSoft },
  iconSlot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  others: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
});
