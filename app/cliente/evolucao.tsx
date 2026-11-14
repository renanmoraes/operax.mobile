import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Path, Polyline, Stop } from 'react-native-svg';
import { Badge, Card, IconButton, Muted, Num, PressableScale, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useAddCheckin, useCheckins } from '@/src/features/fitness/useFitness';
import type { BodyCheckin } from '@/src/features/fitness/types';
import { formatKg, isoDate, monthShort } from '@/src/shared/format';

const SILHOUETTE = 'M76 90Q100 80 124 90L146 102Q154 106 152 118L144 190Q142 200 135 198L136 228Q138 242 132 254L127 340H107L102 260H98L93 340H73L68 254Q62 242 64 228L65 198Q58 200 56 190L48 118Q46 106 54 102Z';

function Photo({ c, tone, width }: { c: BodyCheckin; tone: 'before' | 'after'; width: number }) {
  if (c.photo_uri) return <Image source={{ uri: c.photo_uri }} style={{ width, height: '100%' }} contentFit="cover" />;
  return (
    <LinearGradient colors={tone === 'before' ? ['#d3dae6', '#8e9bb2'] : ['#afc6ff', '#4c74e8']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={{ width, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Svg width={210} height={340} viewBox="0 0 200 340">
        <Circle cx={100} cy={48} r={25} fill="rgba(255,255,255,0.22)" />
        <Path d={SILHOUETTE} fill="rgba(255,255,255,0.22)" />
      </Svg>
    </LinearGradient>
  );
}

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${monthShort(d)}`;
};

export default function BodyEvolutionScreen() {
  const insets = useSafeAreaInsets();
  const { data: checkins } = useCheckins();
  const add = useAddCheckin();
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState(0.5);
  const [beforeIdx, setBeforeIdx] = useState(0);
  const startPos = useRef(0.5);
  const widthRef = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const w = widthRef.current || 1;
          const p = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
          startPos.current = p;
          setPos(p);
        },
        onPanResponderMove: (_, g) => {
          const w = widthRef.current || 1;
          setPos(Math.max(0, Math.min(1, startPos.current + g.dx / w)));
        },
      }),
    [],
  );

  if (!checkins?.length) return <Screen>{null}</Screen>;
  const after = checkins[checkins.length - 1];
  const before = checkins[Math.min(beforeIdx, checkins.length - 2)] ?? checkins[0];
  const days = Math.round((new Date(after.date).getTime() - new Date(before.date).getTime()) / 86_400_000);

  const delta = (a?: number, b?: number, unit = '') => (a != null && b != null ? `${b - a <= 0 ? '−' : '+'}${formatKg(Math.abs(b - a))}${unit}` : '—');

  const weights = checkins.map((c) => c.weight_kg);
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  const pts = weights.map((v, i) => [6 + (i * 298) / Math.max(1, weights.length - 1), 18 + ((wMax - v) / Math.max(0.1, wMax - wMin)) * 78]);

  async function addPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled) return;
    add.mutate({ date: isoDate(new Date()), weight_kg: after.weight_kg, body_fat_pct: after.body_fat_pct, waist_cm: after.waist_cm, hip_cm: after.hip_cm, photo_uri: r.assets[0].uri });
  }

  return (
    <Screen>
      <TopBar safe title="Evolução corporal" onBack={() => router.back()} right={<IconButton icon="add" tone="primary" accessibilityLabel="Adicionar foto de evolução" onPress={() => void addPhoto()} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Rise>
          <View
            style={styles.compare}
            onLayout={(e: LayoutChangeEvent) => {
              setWidth(e.nativeEvent.layout.width);
              widthRef.current = e.nativeEvent.layout.width;
            }}
            {...pan.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Comparar antes e depois"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pos * 100) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => setPos((p) => Math.max(0, Math.min(1, p + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
          >
            {width ? (
              <>
                <View style={StyleSheet.absoluteFill}>
                  <Photo c={after} tone="after" width={width} />
                </View>
                <View style={[StyleSheet.absoluteFill, { width: pos * width, overflow: 'hidden' }]}>
                  <Photo c={before} tone="before" width={width} />
                </View>
                <View pointerEvents="none" style={[styles.handleLine, { left: pos * width - 1.5 }]} />
                <View pointerEvents="none" style={[styles.handle, { left: pos * width - 22 }]}>
                  <Ionicons name="code-outline" size={20} color={colors.text} />
                </View>
              </>
            ) : null}
            <View pointerEvents="none" style={[styles.tag, { left: 16, backgroundColor: 'rgba(255,255,255,0.75)' }]}>
              <Text style={styles.tagText}>{`Antes · ${shortDate(before.date)}`}</Text>
            </View>
            <View pointerEvents="none" style={[styles.tag, { right: 16, backgroundColor: 'rgba(255,255,255,0.92)' }]}>
              <Text style={styles.tagText}>{`Depois · ${shortDate(after.date)}`}</Text>
            </View>
            <View pointerEvents="none" style={styles.journey}>
              <Text style={styles.journeyText}>{`${days} dias de jornada`}</Text>
            </View>
          </View>
        </Rise>

        <Text style={styles.compareLabel}>Comparar com</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
          {checkins.slice(0, -1).map((c, i) => {
            const on = c.id === before.id;
            return (
              <PressableScale
                key={c.id}
                onPress={() => setBeforeIdx(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Comparar com ${shortDate(c.date)}, ${formatKg(c.weight_kg)} quilos`}
                style={[styles.pick, on ? styles.pickOn : styles.pickOff]}
              >
                <Text style={[styles.pickDate, on && styles.pickDateOn]}>{shortDate(c.date)}</Text>
                <Text style={[styles.pickKg, on && styles.pickKgOn]}>
                  {formatKg(c.weight_kg)}
                  <Text style={[styles.pickUnit, on && styles.pickDateOn]}> kg</Text>
                </Text>
                {on ? (
                  <View style={styles.pickCheck} accessible={false}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </ScrollView>

        <Rise index={1} style={styles.measures}>
          {[
            ['Peso', formatKg(after.weight_kg), 'kg', delta(before.weight_kg, after.weight_kg, ' kg')],
            ['Gordura', after.body_fat_pct != null ? formatKg(after.body_fat_pct) : '—', '%', delta(before.body_fat_pct, after.body_fat_pct, ' pontos')],
            ['Cintura', after.waist_cm != null ? formatKg(after.waist_cm) : '—', 'cm', delta(before.waist_cm, after.waist_cm, ' cm')],
            ['Quadril', after.hip_cm != null ? formatKg(after.hip_cm) : '—', 'cm', delta(before.hip_cm, after.hip_cm, ' cm')],
          ].map(([label, value, unit, d]) => (
            <Card key={label} style={styles.measure}>
              <Muted style={{ fontSize: 12.5 }}>{label}</Muted>
              <Num size="md" style={{ marginTop: 6 }}>
                {value}
                <Text style={{ fontSize: 13, color: colors.textMuted }}>{` ${unit}`}</Text>
              </Num>
              <View style={{ marginTop: 8 }}>
                <Badge label={d} tone="primary" />
              </View>
            </Card>
          ))}
        </Rise>

        <Rise index={2} style={{ marginTop: 12 }}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Peso</Text>
              <Muted>{`${formatKg(weights[0])} → ${formatKg(weights[weights.length - 1])} kg`}</Muted>
            </View>
            <Svg width="100%" height={120} viewBox="0 0 310 120" style={{ marginTop: 12 }} accessibilityLabel="Gráfico de peso">
              <Defs>
                <SvgLinear id="wArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                </SvgLinear>
              </Defs>
              <Path d={`M${pts.map((p) => p.join(' ')).join(' L')} L304 116 L6 116 Z`} fill="url(#wArea)" />
              <Polyline points={pts.map((p) => p.join(',')).join(' ')} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={5.5} fill={colors.primary} stroke="#fff" strokeWidth={2.5} />
            </Svg>
            <View style={styles.months}>
              {checkins.map((c) => (
                <Muted key={c.id} style={{ fontSize: 11.5 }}>{monthShort(new Date(`${c.date}T12:00:00`))}</Muted>
              ))}
            </View>
          </Card>
        </Rise>

        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.primaryDeep} />
          <Text style={styles.privacyText}>Suas fotos ficam só com você e com o seu personal.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  compare: { height: 380, borderRadius: radii.hero, overflow: 'hidden', backgroundColor: '#dce6fa', ...shadows.hero },
  handleLine: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: '#fff' },
  handle: { position: 'absolute', top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadows.card },
  tag: { position: 'absolute', top: 16, height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  tagText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: colors.text },
  journey: { position: 'absolute', bottom: 16, alignSelf: 'center', height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center' },
  journeyText: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.primary },
  compareLabel: { marginTop: 18, marginBottom: 10, fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  rail: { flexGrow: 0, marginHorizontal: -20 },
  railContent: { gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  pick: { width: 84, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pickOn: { backgroundColor: colors.primaryWash, borderWidth: 1.5, borderColor: colors.primary },
  pickOff: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6ebf3' },
  pickDate: { ...text.label, color: colors.textMuted },
  pickDateOn: { color: colors.primary },
  pickKg: { ...numbers.sm, color: colors.text },
  pickKgOn: { color: colors.primaryDeep },
  pickUnit: { ...text.label, color: colors.textMuted },
  pickCheck: { position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  measures: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  measure: { width: '48%', flexGrow: 1, padding: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  months: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 14, borderRadius: radii.lg - 2, backgroundColor: colors.primarySoft },
  privacyText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 13, color: colors.primaryDeep },
});
