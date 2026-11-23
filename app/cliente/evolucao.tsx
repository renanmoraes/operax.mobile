import { router } from 'expo-router';
import i18n, { locale } from '@/src/i18n';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Card, EmptyState, HeroCard, IconButton, Loading, PressableScale, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { LoadError } from '@/src/design-system/OfflineState';
import { clientDataMode } from '@/src/features/client/dataMode';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useAddCheckin, useBodyAssessments } from '@/src/features/fitness/useFitness';
import { BodyPhotoCompare } from '@/src/features/fitness/BodyPhotoCompare';
import { EvolutionChart, MiniChart } from '@/src/features/fitness/EvolutionChart';
import { FOLDS_SUM, compareRows, daysBetween, deltaTone, pointsOf, previousValue, type CompareRow, type DeltaTone, type MetricDef } from '@/src/features/fitness/bodyEvolution';
import { valueOf } from '@/src/features/portal/assessments';
import { isoDate, monthShort } from '@/src/shared/format';

const num = (key: string) => (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: key === 'waist_hip_ratio' ? 2 : 1 });
const dayMonth = (iso: string, withYear = false) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${monthShort(d)}${withYear ? ` ${String(d.getFullYear()).slice(2)}` : ''}`;
};
const label = (key: string): string =>
  key === 'body_fat_percent' ? i18n.t('portal:assess.fat') : key === FOLDS_SUM ? i18n.t('fitness:body.foldsSum') : String(i18n.t(`portal:meas.${key}` as never));
/** Nome curto para caber no destaque e no histórico. */
const shortLabel = (key: string): string =>
  key === 'body_fat_percent' ? i18n.t('fitness:body.fat') : key.endsWith('_mm') ? label(key).replace(/^(Dobra|Pliegue)\s+/i, '').replace(/^./, (c) => c.toUpperCase()) : label(key);
/** Gordura em % muda em pontos, não em %. */
const deltaUnit = (m: { key: string; unit: string }) => (m.key === 'body_fat_percent' ? i18n.t('fitness:body.pointsUnit') : m.unit);
const signed = (key: string, diff: number) => `${diff > 0.049 ? '+' : diff < -0.049 ? '−' : ''}${num(key)(Math.abs(diff))}`;
const unitText = (u: string) => (u ? (u === '%' ? '%' : ` ${u}`) : '');

const TONE: Record<DeltaTone, { bg: string; fg: string }> = {
  good: { bg: colors.successSoft, fg: colors.success },
  neutral: { bg: colors.primarySoft, fg: colors.primaryDeep },
  flat: { bg: colors.borderSoft, fg: colors.textMuted },
};

function DeltaPill({ m, diff, big }: { m: MetricDef; diff: number; big?: boolean }) {
  const tone = TONE[deltaTone(m.key, diff)];
  const txt = Math.abs(diff) < 0.05 ? i18n.t('fitness:body.noChange') : `${signed(m.key, diff)}${unitText(deltaUnit(m))}`;
  return (
    <View style={[styles.pill, big && styles.pillBig, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, big && styles.pillTextBig, { color: tone.fg }]} numberOfLines={1}>
        {txt}
      </Text>
    </View>
  );
}

export default function BodyEvolutionScreen() {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= 640;
  const { data, isPending, isError, error, refetch } = useBodyAssessments();
  const add = useAddCheckin();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const chartY = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [metric, setMetric] = useState('weight_kg');
  const [group, setGroup] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(() => (data ?? []).filter((a) => Object.keys(a.measures).length > 0), [data]);
  const rows = useMemo(() => compareRows(items), [items]);

  if (!items.length || !rows.length) {
    return (
      <Screen>
        <TopBar safe title={i18n.t('fitness:tab.bodyProgress')} onBack={() => router.back()} />
        {isPending ? <Loading /> : isError ? <LoadError error={error} onRetry={() => void refetch()} /> : <EmptyState icon="body-outline" title={i18n.t('fitness:body.emptyTitle')} subtitle={i18n.t('fitness:body.emptySub')} />}
      </Screen>
    );
  }

  const first = items[0];
  const last = items[items.length - 1];
  const many = items.length > 1;
  const lead = rows.find((r) => r.key === 'weight_kg') ?? rows[0];
  // Os dias contam entre as avaliações que deram o número do destaque.
  const days = daysBetween(lead.from.date, lead.to.date);
  // Avaliações em anos diferentes: as datas levam o ano, senão "10 mar → 5 fev" parece voltar no tempo.
  const crossYear = first.assessed_on.slice(0, 4) !== last.assessed_on.slice(0, 4);
  const dateOf = (iso: string) => dayMonth(iso, crossYear);
  const side = ['body_fat_percent', 'lean_mass_kg', 'waist_cm', 'abdomen_cm', 'hip_cm', 'chest_cm']
    .map((k) => rows.find((r) => r.key === k && r.count > 1))
    .filter((r): r is CompareRow => !!r)
    .slice(0, 3);
  const current = rows.find((r) => r.key === metric) ?? rows[0];
  const groups = [...new Set(rows.map((r) => r.group))];
  const activeGroup = group && groups.includes(group as CompareRow['group']) ? group : groups[0];
  const hasPhotos = items.some((a) => !!a.photo_uri);
  const canAdd = clientDataMode() !== 'live';

  const pickMetric = (key: string) => {
    setMetric(key);
    scroll.current?.scrollTo({ y: Math.max(0, chartY.current - 12), animated: true });
  };

  async function addPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled) return;
    const m = last.measures;
    add.mutate({ date: isoDate(new Date()), weight_kg: m.weight_kg, body_fat_pct: m.body_fat_percent, waist_cm: m.waist_cm, hip_cm: m.hip_cm, photo_uri: r.assets[0].uri });
  }

  return (
    <Screen>
      <TopBar
        safe
        title={i18n.t('fitness:tab.bodyProgress')}
        onBack={() => router.back()}
        right={canAdd ? <IconButton icon="add" tone="primary" accessibilityLabel={i18n.t('fitness:body.addPhoto')} onPress={() => void addPhoto()} /> : undefined}
      />
      <ScrollView ref={scroll} scrollEnabled={!dragging} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 16 }}>
        {/* A jornada: de quanto para quanto, do primeiro ao último dia. */}
        <Rise>
          <HeroCard>
            <View style={styles.heroTop}>
              <View style={styles.range}>
                <Ionicons name="calendar-outline" size={14} color={colors.primaryDeep} />
                <Text style={styles.rangeText}>{many ? `${dateOf(first.assessed_on)}  →  ${dateOf(last.assessed_on)}` : dateOf(last.assessed_on)}</Text>
              </View>
              <Text style={styles.count}>{i18n.t('fitness:body.assessments', { count: items.length })}</Text>
            </View>

            <Text style={styles.heroLabel}>{label(lead.key)}</Text>
            {many ? (
              <>
                <Text style={styles.heroBig} numberOfLines={1} adjustsFontSizeToFit>
                  {signed(lead.key, lead.diff)}
                  <Text style={styles.heroUnit}>{unitText(deltaUnit(lead))}</Text>
                </Text>
                <Text style={styles.heroSub}>
                  {i18n.t('fitness:body.fromTo', { from: num(lead.key)(lead.from.value), to: num(lead.key)(lead.to.value), unit: lead.unit, count: days })}
                </Text>
              </>
            ) : (
              <Text style={styles.heroBig} numberOfLines={1} adjustsFontSizeToFit>
                {num(lead.key)(lead.to.value)}
                <Text style={styles.heroUnit}>{unitText(lead.unit)}</Text>
              </Text>
            )}

            {side.length ? (
              <View style={styles.heroStats}>
                {side.map((r, i) => (
                  <View key={r.key} style={[styles.heroStat, i > 0 && styles.heroStatDivider]}>
                    <Text style={styles.statLabel} numberOfLines={1}>{shortLabel(r.key)}</Text>
                    <Text style={[styles.statValue, { color: TONE[deltaTone(r.key, r.diff)].fg === colors.textMuted ? colors.text : TONE[deltaTone(r.key, r.diff)].fg }]} numberOfLines={1} adjustsFontSizeToFit>
                      {signed(r.key, r.diff)}
                      <Text style={styles.statUnit}>{unitText(r.key === 'body_fat_percent' ? i18n.t('fitness:body.pointsShort') : r.unit)}</Text>
                    </Text>
                    <Text style={styles.statFrom} numberOfLines={1} adjustsFontSizeToFit>{`${num(r.key)(r.from.value)} → ${num(r.key)(r.to.value)}`}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </HeroCard>
        </Rise>

        {hasPhotos && many ? <BodyPhotoCompare before={first} after={last} onDragging={setDragging} /> : null}

        {/* A medida escolhida em detalhe, com o valor de cada avaliação. */}
        <View onLayout={(e) => (chartY.current = e.nativeEvent.layout.y)}>
          <Rise index={1}>
            <Card style={styles.card}>
              <View style={styles.chartHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.chartLabel} numberOfLines={1}>{label(current.key)}</Text>
                  <Text style={styles.chartValue}>
                    {num(current.key)(current.to.value)}
                    <Text style={styles.chartUnit}>{unitText(current.unit)}</Text>
                  </Text>
                  <Text style={styles.chartSub} numberOfLines={1}>
                    {current.count > 1
                      ? `${num(current.key)(current.from.value)} → ${num(current.key)(current.to.value)}${unitText(current.unit)}`
                      : i18n.t('fitness:body.latest', { date: dateOf(current.to.date) })}
                  </Text>
                </View>
                {current.count > 1 ? <DeltaPill m={current} diff={current.diff} big /> : null}
              </View>
              <EvolutionChart
                points={pointsOf(items, current.key)}
                fmt={num(current.key)}
                dateOf={dateOf}
                a11y={i18n.t('fitness:body.chartA11yOf', { label: label(current.key) })}
              />
            </Card>
          </Rise>
        </View>

        {/* Um gráfico por medida, separado por grupo. Tocar abre a medida em detalhe lá em cima. */}
        <Rise index={2}>
          <Text style={styles.sectionTitle}>{i18n.t('fitness:body.chartTitle')}</Text>
          {groups.length > 1 ? (
            <View style={styles.groupRow}>
              {groups.map((g) => {
                const on = g === activeGroup;
                return (
                  <PressableScale key={g} onPress={() => setGroup(g)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.group, on && styles.groupOn]}>
                    <Text style={[styles.groupText, on && styles.groupTextOn]} numberOfLines={1}>{i18n.t(`fitness:body.group.${g}`)}</Text>
                  </PressableScale>
                );
              })}
            </View>
          ) : null}
          <View style={styles.tiles}>
            {rows
              .filter((r) => r.group === activeGroup)
              .map((r) => {
                const on = r.key === current.key;
                const fmt = num(r.key);
                const tone = TONE[deltaTone(r.key, r.diff)];
                const deltaUnitShort = r.key === 'body_fat_percent' ? i18n.t('fitness:body.pointsShort') : r.unit;
                return (
                  <PressableScale
                    key={r.key}
                    onPress={() => pickMetric(r.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={i18n.t('fitness:body.rowA11y', { label: label(r.key), from: fmt(r.from.value), to: fmt(r.to.value), unit: r.unit })}
                    style={[styles.tile, wide && { flexBasis: '30%' }, on && styles.tileOn]}
                  >
                    <Text style={styles.tileLabel} numberOfLines={1}>{shortLabel(r.key)}</Text>
                    <View style={styles.tileTop}>
                      <Text style={styles.tileValue} numberOfLines={1}>
                        {fmt(r.to.value)}
                        <Text style={styles.tileUnit}>{unitText(r.unit)}</Text>
                      </Text>
                      {r.count > 1 ? (
                        <Text style={[styles.tileDelta, { color: tone.fg }]} numberOfLines={1}>
                          {Math.abs(r.diff) < 0.05 ? i18n.t('fitness:body.noChange') : `${signed(r.key, r.diff)}${r.key === 'body_fat_percent' ? unitText(deltaUnitShort) : ''}`}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ marginTop: 6 }}>
                      <MiniChart id={r.key} points={pointsOf(items, r.key)} color={tone.fg === colors.textMuted ? colors.primary : tone.fg} />
                    </View>
                    <Text style={styles.tileFrom} numberOfLines={1}>
                      {r.count > 1 ? `${fmt(r.from.value)} → ${fmt(r.to.value)}${unitText(r.unit)}` : dateOf(r.to.date)}
                    </Text>
                  </PressableScale>
                );
              })}
          </View>
        </Rise>

        {/* Todas as avaliações, da mais nova para a mais antiga. */}
        <Rise index={3}>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{i18n.t('fitness:body.historyTitle')}</Text>
            <View style={{ marginTop: 10 }}>
              {[...items].reverse().map((a, ri) => {
                const idx = items.length - 1 - ri;
                const d = new Date(`${a.assessed_on}T12:00:00`);
                const w = valueOf(a, 'weight_kg');
                const prevW = previousValue(items, idx, 'weight_kg');
                const isOpen = open === a.id;
                const subtitle = ['body_fat_percent', 'waist_cm', 'lean_mass_kg']
                  .flatMap((k) => {
                    const v = valueOf(a, k);
                    return typeof v === 'number' ? [`${shortLabel(k)} ${num(k)(v)}${unitText(rows.find((r) => r.key === k)?.unit ?? '')}`] : [];
                  })
                  .slice(0, 2)
                  .join('\n');
                const lastRow = ri === items.length - 1;
                const all = rows.flatMap((r) => {
                  const v = valueOf(a, r.key);
                  return typeof v === 'number' ? [{ r, v, prev: previousValue(items, idx, r.key) }] : [];
                });
                return (
                  <View key={a.id} style={styles.tlItem}>
                    <View style={styles.tlRail}>
                      <View style={[styles.tlDot, ri === 0 && styles.tlDotNow]} />
                      {!lastRow ? <View style={styles.tlLine} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: lastRow ? 0 : 18 }}>
                      <PressableScale onPress={() => setOpen(isOpen ? null : a.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={styles.tlHead}>
                        <View style={styles.dateBox}>
                          <Text style={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</Text>
                          <Text style={styles.dateMonth}>{`${monthShort(d)} ${String(d.getFullYear()).slice(2)}`}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.tlTop}>
                            <Text style={styles.tlWeight}>
                              {typeof w === 'number' ? num('weight_kg')(w) : '—'}
                              <Text style={styles.tlUnit}> kg</Text>
                            </Text>
                            {typeof w === 'number' && typeof prevW === 'number' ? (
                              <DeltaPill m={{ key: 'weight_kg', unit: 'kg', group: 'composition' }} diff={w - prevW} />
                            ) : (
                              <View style={[styles.pill, { backgroundColor: '#fff' }]}>
                                <Text style={[styles.pillText, { color: colors.textMuted }]}>{i18n.t('fitness:body.first')}</Text>
                              </View>
                            )}
                          </View>
                          {subtitle ? <Text style={styles.tlSub} numberOfLines={2}>{subtitle}</Text> : null}
                        </View>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                      </PressableScale>
                      {isOpen ? (
                        <View style={styles.grid}>
                          {all.map(({ r, v, prev }) => (
                            <View key={r.key} style={styles.gridCell}>
                              <Text style={styles.gridLabel} numberOfLines={1}>{label(r.key)}</Text>
                              <Text style={styles.gridValue} numberOfLines={1}>
                                {num(r.key)(v)}
                                <Text style={styles.gridUnit}>{unitText(r.unit)}</Text>
                              </Text>
                              {typeof prev === 'number' && Math.abs(v - prev) >= 0.05 ? (
                                <Text style={[styles.gridDelta, { color: TONE[deltaTone(r.key, v - prev)].fg }]} numberOfLines={1}>
                                  {`${signed(r.key, v - prev)}${unitText(deltaUnit(r))}`}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </Rise>

        {hasPhotos ? (
          <View style={styles.privacy}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primaryDeep} />
            <Text style={styles.privacyText}>{i18n.t('fitness:body.privacy')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: '#ffffff' },
  rangeText: { ...text.label, color: colors.primaryDeep },
  count: { ...text.label, color: colors.textMuted },
  heroLabel: { ...text.calloutStrong, color: colors.textSoft, marginTop: 20 },
  heroBig: { fontFamily: typography.fontFamilyBold, fontSize: 52, lineHeight: 58, letterSpacing: -2, color: colors.primaryDeep, fontVariant: ['tabular-nums'] },
  heroUnit: { fontFamily: typography.fontFamilySemiBold, fontSize: 22, letterSpacing: -0.4, color: colors.primary },
  heroSub: { ...text.callout, color: colors.textSoft },
  heroStats: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#d6e1fb' },
  heroStat: { flex: 1, minWidth: 0, gap: 3 },
  heroStatDivider: { paddingLeft: 12, marginLeft: 12, borderLeftWidth: 1, borderLeftColor: '#d6e1fb' },
  statLabel: { ...text.label, color: colors.textMuted },
  statValue: { ...numbers.md, color: colors.text },
  statUnit: { fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  statFrom: { ...text.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  card: { padding: 18 },
  cardTitle: { ...text.section, color: colors.text },
  chartHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  chartLabel: { ...text.captionStrong, color: colors.textSoft, marginBottom: 2 },
  chartValue: { ...numbers.lg, color: colors.text },
  chartUnit: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.textMuted },
  chartSub: { ...text.caption, color: colors.textMuted, marginTop: 2 },

  groupRow: { flexDirection: 'row', gap: 4, marginTop: 10, padding: 4, borderRadius: radii.control, backgroundColor: colors.pageBg },
  group: { flex: 1, height: 34, paddingHorizontal: 2, borderRadius: radii.control - 4, alignItems: 'center', justifyContent: 'center' },
  groupOn: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  groupText: { ...text.captionStrong, fontSize: 12.5, color: colors.textMuted },
  groupTextOn: { color: colors.primaryDeep },
  sectionTitle: { ...text.section, color: colors.text, marginTop: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tile: { flexGrow: 1, flexBasis: '46%', minWidth: 140, padding: 14, borderRadius: radii.lg, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fff', ...shadows.card },
  tileOn: { borderColor: colors.primary },
  tileTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 4 },
  tileLabel: { ...text.captionStrong, color: colors.textSoft },
  tileDelta: { ...text.captionStrong, fontVariant: ['tabular-nums'] },
  tileValue: { ...numbers.md, color: colors.text, flexShrink: 1 },
  tileUnit: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted },
  tileFrom: { ...text.caption, fontSize: 12, color: colors.textMuted, marginTop: 6, fontVariant: ['tabular-nums'] },

  pill: { height: 26, paddingHorizontal: 10, borderRadius: radii.pill, justifyContent: 'center' },
  pillBig: { height: 32, paddingHorizontal: 14 },
  pillText: { ...text.label, fontVariant: ['tabular-nums'] },
  pillTextBig: { fontSize: 13.5 },

  tlItem: { flexDirection: 'row', gap: 12 },
  tlRail: { width: 14, alignItems: 'center', paddingTop: 20 },
  tlDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: colors.primary, backgroundColor: '#fff' },
  tlDotNow: { backgroundColor: colors.primary },
  tlLine: { flex: 1, width: 2, marginTop: 4, marginBottom: -20, backgroundColor: colors.track },
  tlHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, backgroundColor: colors.pageBg },
  dateBox: { width: 48, height: 52, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dateDay: { ...numbers.md, color: colors.primaryDeep, lineHeight: 22 },
  dateMonth: { ...text.label, fontSize: 10.5, color: colors.textMuted },
  tlTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tlWeight: { ...numbers.md, color: colors.text },
  tlUnit: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  tlSub: { ...text.caption, color: colors.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 14, paddingHorizontal: 4 },
  gridCell: { width: '50%', paddingRight: 10, gap: 1 },
  gridLabel: { ...text.caption, color: colors.textMuted },
  gridValue: { ...numbers.sm, color: colors.text },
  gridUnit: { fontFamily: typography.fontFamily, fontSize: 12, color: colors.textMuted },
  gridDelta: { ...text.label, fontSize: 11 },

  privacy: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radii.lg - 2, backgroundColor: colors.primarySoft },
  privacyText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 13, color: colors.primaryDeep },
});
