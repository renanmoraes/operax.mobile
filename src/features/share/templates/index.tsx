import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/src/design-system/tokens';
import { longDate } from '@/src/shared/format';
import type { ShareActivity, ShareTemplate, TemplateProps } from '../types';
import { BibDark, BibLight, hasPlan, PlanDone, Receipt } from './extra';
import { Brand, Records, RouteLine, shadow, SplitBars, StatRow, StatStack, statsOf, styles, VolumeBars } from './parts';

const hasRoute = (a: ShareActivity) => (a.gps?.route.length ?? 0) > 1;
const always = () => true;

function RouteOnly({ activity }: TemplateProps) {
  const s = statsOf(activity);
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center' }]}>
      <RouteLine route={activity.gps!.route} w={900} h={1200} />
      <Text style={[styles.sub, { color: '#fff', marginTop: 40 }, shadow]}>{s.slice(0, 3).map((x) => x.value).join('   ·   ')}</Text>
      <Brand company={activity.company} style={{ marginTop: 60 }} />
    </View>
  );
}

function RouteStats({ activity }: TemplateProps) {
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center', gap: 40 }]}>
      <RouteLine route={activity.gps!.route} w={760} h={820} stroke={16} />
      <StatStack stats={statsOf(activity).slice(0, 3)} size={0.78} />
      <Brand company={activity.company} />
    </View>
  );
}

function Stats({ activity }: TemplateProps) {
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center', gap: 80 }]}>
      <StatStack stats={statsOf(activity).slice(0, 4)} />
      <Brand company={activity.company} />
    </View>
  );
}

function Row({ activity }: TemplateProps) {
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center', gap: 60 }]}>
      <StatRow stats={statsOf(activity)} />
      <Brand company={activity.company} />
    </View>
  );
}

function Splits({ activity }: TemplateProps) {
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center', gap: 80 }]}>
      <SplitBars splits={activity.gps!.splits} kind={activity.gps!.splitsKind} />
      <Brand company={activity.company} />
    </View>
  );
}

function Volume({ activity }: TemplateProps) {
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center', gap: 80 }]}>
      <VolumeBars bars={activity.strength!.volumeHistory} />
      <Brand company={activity.company} />
    </View>
  );
}

function RecordsT({ activity }: TemplateProps) {
  return (
    <View style={[styles.canvas, { alignItems: 'center', justifyContent: 'center', gap: 80 }]}>
      <Records records={activity.strength!.records} />
      <Brand company={activity.company} />
    </View>
  );
}

function Header({ activity }: { activity: ShareActivity }) {
  return (
    <View>
      <Text style={[styles.title, { color: '#fff' }]} numberOfLines={2}>
        {activity.title}
      </Text>
      <Text style={[styles.sub, { color: '#dce6ff', marginTop: 12 }]}>{longDate(new Date(activity.date))}</Text>
    </View>
  );
}

function Card({ activity }: TemplateProps) {
  return (
    <View style={styles.canvas}>
      <LinearGradient colors={['#0b1a3a', '#1e4ed8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, padding: 90, justifyContent: 'space-between' }}>
        <Header activity={activity} />
        {hasRoute(activity) ? (
          <View style={{ alignItems: 'center' }}>
            <RouteLine route={activity.gps!.route} w={900} h={780} stroke={16} />
          </View>
        ) : null}
        <View style={{ gap: 70 }}>
          <StatRow stats={statsOf(activity)} />
          <Brand company={activity.company} />
        </View>
      </View>
    </View>
  );
}

function MapT({ activity, mapUri, onReady }: TemplateProps) {
  return (
    <View style={[styles.canvas, { backgroundColor: '#eef3fb' }]}>
      {mapUri ? (
        <Image source={{ uri: mapUri }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={onReady} />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <RouteLine route={activity.gps!.route} w={1080} h={1400} stroke={16} grid />
        </View>
      )}
      <LinearGradient colors={['rgba(5,10,20,0)', 'rgba(5,10,20,0.88)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 760 }} />
      <View style={{ position: 'absolute', left: 90, right: 90, bottom: 110, gap: 60 }}>
        <Header activity={activity} />
        <StatRow stats={statsOf(activity)} />
        <Brand company={activity.company} />
      </View>
    </View>
  );
}

function Photo({ activity, photoUri, onReady }: TemplateProps) {
  return (
    <View style={[styles.canvas, { backgroundColor: '#1a314f' }]}>
      {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={onReady} /> : <LinearGradient colors={gradients.photo} style={StyleSheet.absoluteFill} />}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 900 }} />
      <View style={{ position: 'absolute', left: 60, right: 60, bottom: 110, gap: 60 }}>
        {hasRoute(activity) ? (
          <View style={{ alignItems: 'center' }}>
            <RouteLine route={activity.gps!.route} w={520} h={420} stroke={12} />
          </View>
        ) : null}
        <StatRow stats={statsOf(activity)} />
        <Brand company={activity.company} />
      </View>
    </View>
  );
}

/** Ordem da grade. Transparentes primeiro, como no Strava. */
export const TEMPLATES: ShareTemplate[] = [
  { id: 'route', labelKey: 'route', transparent: true, supports: hasRoute, Render: RouteOnly },
  { id: 'routeStats', labelKey: 'routeStats', transparent: true, supports: hasRoute, Render: RouteStats },
  { id: 'stats', labelKey: 'stats', transparent: true, supports: always, Render: Stats },
  { id: 'row', labelKey: 'row', transparent: true, supports: always, Render: Row },
  { id: 'receipt', labelKey: 'receipt', transparent: true, supports: always, Render: Receipt },
  { id: 'bib', labelKey: 'bib', transparent: true, supports: always, Render: BibLight },
  { id: 'bibDark', labelKey: 'bibDark', transparent: true, supports: always, Render: BibDark },
  { id: 'splits', labelKey: 'splits', transparent: true, supports: (a) => (a.gps?.splits.length ?? 0) >= 2, Render: Splits },
  { id: 'volume', labelKey: 'volume', transparent: true, supports: (a) => (a.strength?.volumeHistory.length ?? 0) >= 2, Render: Volume },
  { id: 'records', labelKey: 'records', transparent: true, supports: (a) => (a.strength?.records.length ?? 0) > 0, Render: RecordsT },
  { id: 'map', labelKey: 'map', transparent: false, usesMap: true, supports: hasRoute, Render: MapT },
  { id: 'plan', labelKey: 'plan', transparent: false, supports: hasPlan, Render: PlanDone },
  { id: 'card', labelKey: 'card', transparent: false, supports: always, Render: Card },
  { id: 'photo', labelKey: 'photo', transparent: false, needsPhoto: true, supports: always, Render: Photo },
];

export function templatesFor(a: ShareActivity): ShareTemplate[] {
  return TEMPLATES.filter((t) => t.supports(a));
}
