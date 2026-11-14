import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Loading, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { RouteMap } from '@/src/features/fitness/RouteMap';
import { formatKm, formatPace } from '@/src/features/fitness/runTracker';
import { FEELINGS, effortWord, historySportLabel, sportInfo } from '@/src/features/fitness/sports';
import { useActivityDetail, useHistory } from '@/src/features/fitness/useFitness';
import type { ActivityDetail } from '@/src/features/fitness/types';
import { formatClock } from '@/src/shared/format';

/** Um treino do histórico: o caminho no mapa, os números, as parciais e o "como foi". */
export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = raw ? decodeURIComponent(raw) : undefined;
  const history = useHistory();
  const entry = history.data?.find((e) => e.id === id);
  const detail = useActivityDetail(entry?.session_id || entry?.kind === 'free' ? id : undefined);

  if (history.isLoading) {
    return (
      <Screen>
        <TopBar safe title="Treino" onBack={() => router.back()} />
        <Loading label="Abrindo o treino" />
      </Screen>
    );
  }
  if (!entry) {
    return (
      <Screen>
        <TopBar safe title="Treino" onBack={() => router.back()} />
        <EmptyState icon="time-outline" title="Treino não encontrado" subtitle="Ele pode ter sido removido do histórico." actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = detail.data ?? null;
  const route = d?.route ?? [];
  const sport = sportInfo(entry.modality);
  const sportLabel = historySportLabel(entry.modality);
  const date = new Date(entry.started_at ?? `${entry.date}T12:00:00`);
  const day = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const when = `${day.charAt(0).toUpperCase()}${day.slice(1)}${entry.started_at ? ` · ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
  const feeling = FEELINGS.find((f) => f.id === entry.feeling);
  const secs = entry.duration_seconds ?? d?.seconds ?? null;
  const pace = entry.distance_meters && secs ? (secs / entry.distance_meters) * 1000 : null;
  const kmh = entry.distance_meters && secs ? (entry.distance_meters / secs) * 3.6 : null;
  const showSpeed = d?.rate_unit === 'kmh' || entry.modality === 'bike';

  return (
    <Screen>
      <TopBar safe title={sportLabel ?? 'Treino'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <Rise>
          <View style={styles.hero}>
            {route.length > 1 ? (
              <RouteMap route={route} style={styles.map} />
            ) : (
              <LinearGradient colors={['#e3ecff', '#ddf3ff']} style={[styles.map, styles.noMap]}>
                <MaterialCommunityIcons name={sport.icon} size={52} color={colors.primary} />
                {detail.isLoading ? <Muted style={{ marginTop: 8 }}>Carregando o caminho…</Muted> : null}
              </LinearGradient>
            )}
            <View style={{ padding: 18 }}>
              <Text style={styles.title} numberOfLines={2}>{entry.title}</Text>
              <Muted style={{ marginTop: 4 }}>{when}</Muted>
              <View style={styles.badges}>
                {entry.sources.map((s) => <Badge key={s.label} label={s.label} tone={s.origin === 'celular' ? 'primary' : 'neutral'} />)}
                {entry.kind === 'free' ? <Badge label="Treino livre" /> : null}
              </View>
              <View style={styles.stats}>
                {entry.distance_meters ? <Stat label="Distância" value={formatKm(entry.distance_meters)} unit="km" /> : null}
                {secs ? <Stat label="Tempo" value={formatClock(secs)} /> : null}
                {showSpeed && kmh ? <Stat label="Velocidade" value={kmh.toFixed(1).replace('.', ',')} unit="km/h" /> : pace ? <Stat label="Ritmo" value={formatPace(pace)} unit="/km" /> : null}
                {d?.summary.elevation_gain_m ? <Stat label="Subida" value={String(d.summary.elevation_gain_m)} unit="m" /> : null}
                {entry.avg_hr ? <Stat label="FC média" value={String(entry.avg_hr)} unit="bpm" /> : null}
              </View>
            </View>
          </View>
        </Rise>

        {feeling || entry.effort || entry.notes ? (
          <Rise index={1}>
            <Card style={{ gap: 12 }}>
              <Text style={styles.section}>Como foi</Text>
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
                    <Text style={styles.pillText}>{`Esforço · ${effortWord(entry.effort)}`}</Text>
                  </View>
                ) : null}
              </View>
              {entry.notes ? <Text style={styles.notes}>{entry.notes}</Text> : null}
            </Card>
          </Rise>
        ) : null}

        {d?.splits.length ? (
          <Rise index={2}>
            <SplitsCard detail={d} />
          </Rise>
        ) : null}

        {entry.kind === 'free' ? <Muted style={{ textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 }}>Seu professor vê este treino, o caminho e o que você contou.</Muted> : null}
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

function SplitsCard({ detail }: { detail: ActivityDetail }) {
  const kmh = detail.rate_unit === 'kmh';
  const rates = detail.splits.map((s) => s.rate).filter((r): r is number => r != null);
  // Ritmo: menor é melhor. Velocidade: maior é melhor. A barra mais cheia é o trecho mais rápido.
  const best = rates.length ? (kmh ? Math.max(...rates) : Math.min(...rates)) : null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.section}>{detail.split_basis === 'laps' ? 'Voltas' : 'Parciais'}</Text>
        <Muted style={{ fontSize: 12 }}>{kmh ? 'km/h' : 'ritmo /km'}</Muted>
      </View>
      {detail.splits.map((s) => {
        const fill = s.rate && best ? (kmh ? s.rate / best : best / s.rate) : 0;
        return (
          <View key={s.index} style={styles.splitRow}>
            <Text style={styles.splitKm}>{detail.split_basis === 'laps' ? `V${s.index + 1}` : s.distance_m && s.distance_m < 990 ? `${(s.distance_m / 1000).toFixed(1).replace('.', ',')}` : s.index + 1}</Text>
            <Text style={styles.splitPace}>{s.rate == null ? '–' : kmh ? s.rate.toFixed(1).replace('.', ',') : formatPace(s.rate)}</Text>
            <View style={styles.splitTrack}>
              <View style={[styles.splitBar, { width: `${Math.max(8, Math.min(100, fill * 100))}%` }, s.rate === best && rates.length > 1 && { backgroundColor: colors.success }]} />
            </View>
            {s.avg_hr ? <Muted style={{ width: 52, textAlign: 'right', fontSize: 12 }}>{`${s.avg_hr} bpm`}</Muted> : null}
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
