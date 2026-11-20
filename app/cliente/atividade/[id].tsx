import { router, useLocalSearchParams } from 'expo-router';
import { locale } from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, IconButton, Loading, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { useActiveCompanyName } from '@/src/features/client/useClientData';
import { fromHistoryDetail } from '@/src/features/share/fromSources';
import { setShareActivity } from '@/src/features/share/store';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { ActivityCharts, ActivityChartsSkeleton, HrZonesCard } from '@/src/features/fitness/ActivityCharts';
import { PlanCard } from '@/src/features/fitness/PlanCard';
import { RouteMap } from '@/src/features/fitness/RouteMap';
import { RATE_UNIT, rateUnitOfSport } from '@/src/features/fitness/rateUnit';
import { formatKm, formatPace } from '@/src/features/fitness/runTracker';
import { FEELINGS, effortWord, historySportLabel, sportInfo, tagLabel } from '@/src/features/fitness/sports';
import { useActivityDetail, useHistory } from '@/src/features/fitness/useFitness';
import type { ActivityDetail } from '@/src/features/fitness/types';
import { formatClock } from '@/src/shared/format';

/** Um treino do histórico: o caminho no mapa, os números, as parciais e o "como foi". */
export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = raw ? decodeURIComponent(raw) : undefined;
  const history = useHistory();
  const entry = history.data?.find((e) => e.id === id);
  const detail = useActivityDetail(entry?.session_id || entry?.kind === 'free' ? id : undefined);
  const companyName = useActiveCompanyName();

  if (history.isLoading) {
    return (
      <Screen>
        <TopBar safe title={t('detail.workout')} onBack={() => router.back()} />
        <Loading label={t('detail.loading')} />
      </Screen>
    );
  }
  if (!entry) {
    return (
      <Screen>
        <TopBar safe title={t('detail.workout')} onBack={() => router.back()} />
        <EmptyState icon="time-outline" title={t('gate.notFound')} subtitle={t('detail.notFoundSub')} actionLabel={t('common:actions.back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = detail.data ?? null;
  const route = d?.route ?? [];
  const sport = sportInfo(entry.modality);
  const sportLabel = historySportLabel(entry.modality);
  const date = new Date(entry.started_at ?? `${entry.date}T12:00:00`);
  const day = date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const when = `${day.charAt(0).toUpperCase()}${day.slice(1)}${entry.started_at ? ` · ${date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}` : ''}`;
  const feeling = FEELINGS.find((f) => f.id === entry.feeling);
  const secs = entry.duration_seconds ?? d?.seconds ?? null;
  // Ritmo na unidade do esporte: natação por 100 m (1'42"/100 m), remo por 500 m, corrida e caminhada por km.
  const paceUnit = RATE_UNIT[d && d.rate_unit !== 'kmh' ? d.rate_unit : rateUnitOfSport(entry.modality === 'bike' ? null : entry.modality)];
  const pace = entry.distance_meters && secs && paceUnit.meters ? (secs / entry.distance_meters) * paceUnit.meters : null;
  const kmh = entry.distance_meters && secs ? (entry.distance_meters / secs) * 3.6 : null;
  const showSpeed = d?.rate_unit === 'kmh' || entry.modality === 'bike';

  return (
    <Screen>
      <TopBar
        safe
        title={sportLabel ?? t('detail.workout')}
        onBack={() => router.back()}
        right={
          <IconButton
            icon="share-outline"
            accessibilityLabel={t('done.share')}
            onPress={() => {
              setShareActivity(fromHistoryDetail(entry, d, companyName));
              router.push('/cliente/compartilhar');
            }}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <Rise>
          <View style={styles.hero}>
            {route.length > 1 ? (
              <RouteMap route={route} style={styles.map} />
            ) : (
              <LinearGradient colors={['#e3ecff', '#ddf3ff']} style={[styles.map, styles.noMap]}>
                <MaterialCommunityIcons name={sport.icon} size={52} color={colors.primary} />
              </LinearGradient>
            )}
            <View style={{ padding: 18 }}>
              <Text style={styles.title} numberOfLines={2}>{entry.title}</Text>
              <Muted style={{ marginTop: 4 }}>{when}</Muted>
              <View style={styles.badges}>
                {entry.sources.map((s) => <Badge key={s.label} label={s.label} tone={s.origin === 'celular' ? 'primary' : 'neutral'} />)}
                {entry.kind === 'free' ? <Badge label={t('freeWorkout')} /> : null}
                {tagLabel(entry.tag) ? <Badge label={tagLabel(entry.tag)!} tone="primary" /> : null}
              </View>
              <View style={styles.stats}>
                {entry.distance_meters ? <Stat label={t('rec.distance')} value={formatKm(entry.distance_meters)} unit="km" /> : null}
                {secs ? <Stat label={t('rec.time')} value={formatClock(secs)} /> : null}
                {showSpeed && kmh ? <Stat label={t('rec.speed')} value={new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(kmh)} unit="km/h" /> : pace ? <Stat label={t('rec.pace')} value={formatPace(pace)} unit={paceUnit.label} /> : null}
                {d?.summary.elevation_gain_m ? <Stat label={t('rec.climb')} value={String(d.summary.elevation_gain_m)} unit="m" /> : null}
                {entry.avg_hr ?? d?.summary.avg_hr ? <Stat label={t('detail.avgHr')} value={String(entry.avg_hr ?? d?.summary.avg_hr)} unit="bpm" /> : null}
                {d?.summary.max_hr ? <Stat label={t('charts.maxHr')} value={String(d.summary.max_hr)} unit="bpm" /> : null}
                {entry.energy_kcal ? <Stat label={t('log.calories')} value={new Intl.NumberFormat(locale()).format(entry.energy_kcal)} unit="kcal" /> : null}
                {d?.summary.avg_cadence ? <Stat label={t('charts.avgCadence')} value={String(Math.round(d.summary.avg_cadence))} unit={entry.modality === 'bike' ? 'rpm' : 'spm'} /> : null}
                {d?.summary.avg_power ? <Stat label={t('charts.avgPower')} value={String(Math.round(d.summary.avg_power))} unit="W" /> : null}
                {entry.sets ? <Stat label={t('rec.sets')} value={String(entry.sets)} /> : null}
              </View>
            </View>
          </View>
        </Rise>

        {feeling || entry.effort || entry.notes ? (
          <Rise index={1}>
            <Card style={{ gap: 12 }}>
              <Text style={styles.section}>{t('detail.howItWent')}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {feeling ? (
                  <View style={styles.pill}>
                    <MaterialCommunityIcons name={feeling.icon} size={20} color={colors.primary} />
                    <Text style={styles.pillText}>{feeling.label}</Text>
                  </View>
                ) : null}
                {entry.effort ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillNum}>{entry.effort}</Text>
                    <Text style={styles.pillText}>{t('detail.effortWord', { word: effortWord(entry.effort) })}</Text>
                  </View>
                ) : null}
              </View>
              {entry.notes ? <Text style={styles.notes}>{entry.notes}</Text> : null}
            </Card>
          </Rise>
        ) : null}

        {d?.plan || d?.planned?.length ? (
          <Rise index={2}>
            <PlanCard detail={d} />
          </Rise>
        ) : null}

        {d ? (
          <Rise index={2}>
            <ActivityCharts detail={d} />
          </Rise>
        ) : detail.isLoading ? (
          <ActivityChartsSkeleton />
        ) : null}

        {d?.zones?.length ? (
          <Rise index={3}>
            <HrZonesCard detail={d} />
          </Rise>
        ) : null}

        {d && hasSplits(d) ? (
          <Rise index={4}>
            <SplitsCard detail={d} />
          </Rise>
        ) : null}

      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Muted style={{ fontSize: 11.5 }}>{label}</Muted>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.statUnit}>{` ${unit}`}</Text> : null}
      </Text>
    </View>
  );
}

/** Lista que diz algo: dois trechos ou mais (uma volta só repete o resumo) e pelo menos um com ritmo. */
function hasSplits(d: ActivityDetail): boolean {
  return d.splits.length > 1 && d.splits.some((s) => s.rate != null);
}

/** Último trecho de km que não fechou o km (corrida, bike, remo): mostra a distância dele (0,4) no lugar do número. A natação vai de 100 em 100 m. */
function isShortLast(d: ActivityDetail, s: ActivityDetail['splits'][number]): boolean {
  return d.split_basis === 'distance' && d.rate_unit !== 'min_100m' && s.index === d.splits.length && s.distance_m != null && s.distance_m < 990;
}

function SplitsCard({ detail }: { detail: ActivityDetail }) {
  const { t } = useTranslation('fitness');
  const kmh = detail.rate_unit === 'kmh';
  const unit = RATE_UNIT[detail.rate_unit].label;
  const laps = detail.split_basis === 'laps';
  const rates = detail.splits.map((s) => s.rate).filter((r): r is number => r != null);
  // Ritmo: menor é melhor. Velocidade: maior é melhor. A barra mais cheia é o trecho mais rápido.
  const best = rates.length ? (kmh ? Math.max(...rates) : Math.min(...rates)) : null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.section}>{detail.split_basis === 'laps' ? t('detail.laps') : t('rec.splits')}</Text>
        <Muted style={{ fontSize: 12 }}>{kmh ? unit : t('detail.pacePer', { unit })}</Muted>
      </View>
      {detail.splits.map((s) => {
        const fill = s.rate && best ? (kmh ? s.rate / best : best / s.rate) : 0;
        return (
          <View key={s.index} style={styles.splitRow}>
            <Text style={styles.splitKm}>{laps ? `V${s.index}` : isShortLast(detail, s) ? new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(s.distance_m! / 1000) : s.index}</Text>
            <Text style={styles.splitPace}>{s.rate == null ? '–' : kmh ? s.rate.toFixed(1).replace('.', ',') : formatPace(s.rate)}</Text>
            <View style={styles.splitTrack}>
              <View style={[styles.splitBar, { width: `${Math.max(8, Math.min(100, fill * 100))}%` }, s.rate === best && rates.length > 1 && { backgroundColor: colors.success }]} />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { borderRadius: radii.xl, backgroundColor: '#fff', overflow: 'hidden', ...shadows.card },
  map: { height: 240 },
  noMap: { alignItems: 'center', justifyContent: 'center' },
  title: { ...text.headline, color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: colors.borderSoft },
  stat: { width: '33.3%' },
  statValue: { marginTop: 2, ...numbers.md, color: colors.text },
  statUnit: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: colors.textMuted, letterSpacing: 0 },
  section: { ...text.section, color: colors.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 38, borderRadius: 999, backgroundColor: colors.primaryWash },
  pillNum: { ...numbers.sm, color: colors.primary },
  pillText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primaryDeep },
  notes: { ...text.body, color: colors.textSoft },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitKm: { width: 30, ...numbers.xs, color: colors.textMuted },
  splitPace: { width: 56, ...numbers.sm, color: colors.text },
  splitTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#e7edf8', overflow: 'hidden' },
  splitBar: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
