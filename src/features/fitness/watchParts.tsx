import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/src/i18n';
import { Badge, Button, Card, Muted, PressableScale, T } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { ProviderMark, providerDisplayName } from './brands';
import { useConnectProvider, useSavePushPrefs } from './connections';
import { useConnectHealth, useHealthAvailability, useHealthState } from './health/useHealth';
import { toggleKind, WATCH_KINDS, type SendTarget } from './integrations';
import type { ProviderView } from './types';

const MARK = require('@/assets/brand/operax-mark.png');
const SAMSUNG_HEALTH = 'com.sec.android.app.shealth';

/** Três pontos que correm de um lado para o outro, no sentido em que o treino viaja. */
function FlowDots() {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => {
        const start = i / 4;
        const opacity = t.interpolate({ inputRange: [0, start, start + 0.25, start + 0.5, 1], outputRange: [0.25, 0.25, 1, 0.25, 0.25], extrapolate: 'clamp' });
        return <Animated.View key={i} style={[styles.dot, { opacity }]} />;
      })}
      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
    </View>
  );
}

/** Cabeçalho de seção com o desenho do caminho: Operax → relógio ou relógio → Operax. */
export function FlowHeader({ direction, title, body }: { direction: 'out' | 'in'; title: string; body: string }) {
  const operax = (
    <View style={styles.operax}>
      <Image source={MARK} style={{ width: 20, height: 20 }} resizeMode="contain" />
    </View>
  );
  const watch = (
    <View style={styles.watch}>
      <Ionicons name="watch-outline" size={19} color={colors.primaryDeep} />
    </View>
  );
  return (
    <View style={styles.flow}>
      <View
        style={styles.flowRow}
        accessible
        accessibilityLabel={direction === 'out' ? i18n.t('fitness:watch.flowOut') : i18n.t('fitness:watch.flowIn')}
      >
        {direction === 'out' ? operax : watch}
        <FlowDots />
        {direction === 'out' ? watch : operax}
      </View>
      <Text style={styles.flowTitle} accessibilityRole="header">
        {title}
      </Text>
      <Muted style={{ marginTop: 3 }}>{body}</Muted>
    </View>
  );
}

function Status({ label }: { label: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusDot} />
      <T role="captionStrong" style={{ color: colors.success, flexShrink: 1 }}>
        {label}
      </T>
    </View>
  );
}

/** Relógios que recebem o treino do plano, numa lista só. Conectar aqui é a mesma conexão de importar. */
export function SendCard({ targets }: { targets: SendTarget[] }) {
  const connect = useConnectProvider();
  return (
    <Card style={styles.list}>
      {targets.map((s, i) => {
        const name = providerDisplayName(s.id, s.label);
        return (
          <View key={s.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            <ProviderMark id={s.id} label={s.label} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowName}>{name}</Text>
              {s.connected ? (
                <Status label={i18n.t('fitness:watch.sendOn')} />
              ) : (
                <Muted style={{ marginTop: 2 }}>{s.state === 'soon' ? i18n.t('fitness:watch.sendSoon') : i18n.t('fitness:watch.sendOff')}</Muted>
              )}
            </View>
            {s.state === 'soon' ? (
              <Badge label={i18n.t('fitness:watch.soon')} />
            ) : s.connected ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            ) : (
              <Button
                label={i18n.t('fitness:watch.connectShort')}
                compact
                loading={connect.isPending && connect.variables === s.id}
                onPress={() => connect.mutate(s.id as ProviderView['id'])}
              />
            )}
          </View>
        );
      })}
    </Card>
  );
}

/** O que vai para o relógio: mandar sozinho e quais tipos de treino. Vale para o provedor conectado que recebe treino. */
export function PushPrefsCard({ provider }: { provider: ProviderView }) {
  const save = useSavePushPrefs();
  const prefs = provider.push ?? { auto: true, kinds: WATCH_KINDS.map((k) => k.id) };
  const set = (next: typeof prefs) => save.mutate({ id: provider.id, prefs: next });
  return (
    <Card style={styles.card}>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowName}>{i18n.t('fitness:watch.autoTitle')}</Text>
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
      <View style={styles.kindsHead}>
        <Text style={styles.rowName}>{i18n.t('fitness:watch.kindsTitle')}</Text>
        <Muted style={{ marginTop: 2 }}>{i18n.t('fitness:watch.kindsBody')}</Muted>
      </View>
      <View style={styles.kinds}>
        {WATCH_KINDS.map((k) => {
          const on = prefs.kinds.includes(k.id);
          return (
            <PressableScale
              key={k.id}
              onPress={() => set({ ...prefs, kinds: toggleKind(prefs.kinds, k.id) })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.kind, on && styles.kindOn]}
            >
              <Ionicons name={on ? 'checkmark-circle' : k.icon} size={18} color={on ? colors.primary : colors.textSoft} />
              <Text style={[styles.kindText, on && { color: colors.primaryDeep }]} numberOfLines={1}>
                {i18n.t(`fitness:watch.kind.${k.id}`)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}

/** Abre o Samsung Health (pela loja, que mostra "Abrir" quando já está instalado). */
function openSamsungHealth() {
  Linking.openURL(`market://details?id=${SAMSUNG_HEALTH}`).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${SAMSUNG_HEALTH}`));
}

/**
 * Galaxy Watch: o relógio grava no Samsung Health, que repassa ao Health Connect, de onde o Operax lê.
 * O aluno só precisa permitir Exercício no Samsung Health e conectar o Health Connect aqui.
 */
export function GalaxyCard() {
  const { data: availability } = useHealthAvailability();
  const { data: state } = useHealthState();
  const connect = useConnectHealth();
  const connected = !!state?.connected;
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <ProviderMark id="galaxy" label="Galaxy Watch" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>Galaxy Watch</Text>
          {connected ? <Status label={i18n.t('fitness:watch.galaxyOn')} /> : <Muted style={{ marginTop: 2 }}>{i18n.t('fitness:watch.galaxySubtitle')}</Muted>}
        </View>
      </View>
      {!connected ? (
        <T role="callout" tone="soft">
          {i18n.t('fitness:watch.galaxySteps')}
        </T>
      ) : null}
      <View style={styles.actions}>
        {!connected && availability === 'available' ? (
          <Button label={i18n.t('fitness:watch.connectShort')} compact loading={connect.isPending} onPress={() => connect.mutate()} style={{ flex: 1 }} />
        ) : null}
        <Button label={i18n.t('fitness:watch.galaxyOpen')} variant={connected ? 'soft' : 'ghost'} compact icon="open-outline" onPress={openSamsungHealth} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/** O que ainda não chega direto, com o caminho de hoje (Strava ou Saúde/Health Connect) e os outros relógios. */
export function SoonCard({ providers, healthName }: { providers: ProviderView[]; healthName: string }) {
  return (
    <Card style={styles.list}>
      {providers.map((p, i) => (
        <View key={p.id} style={[styles.row, i > 0 && styles.rowBorder]}>
          <ProviderMark id={p.id} label={p.label} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowName}>{providerDisplayName(p.id, p.label)}</Text>
            <Muted style={{ marginTop: 2 }}>{i18n.t('fitness:watch.soonBody', { health: healthName })}</Muted>
          </View>
          <Badge label={i18n.t('fitness:watch.soon')} />
        </View>
      ))}
      <View style={[styles.row, providers.length > 0 && styles.rowBorder]}>
        <View style={styles.others}>
          <Ionicons name="apps-outline" size={19} color={colors.textSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowName}>{i18n.t('fitness:watch.othersTitle')}</Text>
          <Muted style={{ marginTop: 2 }}>{i18n.t('fitness:watch.othersBody', { health: healthName })}</Muted>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flow: { marginTop: 28, marginBottom: 12 },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  operax: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.chromeNavy, alignItems: 'center', justifyContent: 'center' },
  watch: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  flowTitle: { ...text.title, color: colors.text },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  rowName: { ...text.bodyStrong, color: colors.text },
  card: { padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { ...text.section, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kindsHead: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft, paddingTop: 12 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { flexBasis: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  kindOn: { borderColor: colors.primary, backgroundColor: colors.primaryWash },
  kindText: { ...text.captionStrong, color: colors.textSoft, flexShrink: 1 },
  others: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
});
