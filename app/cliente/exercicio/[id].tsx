import { router, useLocalSearchParams } from 'expo-router';
import { showDialog } from '@/src/design-system/Dialog';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Badge, Body, Button, Card, Chip, EmptyState, Glow, IconButton, Loading, PressableScale, Rise, Screen, StatStrip } from '@/src/design-system/ui';
import { fetchMediaUrl } from '@/src/features/fitness/fitnessApi';
import { openViewer } from '@/src/features/media/viewer';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { flattenWorkout } from '@/src/features/fitness/flatten';
import { useLoadHistory, useWorkout } from '@/src/features/fitness/useFitness';
import { useSendChat , useActiveCompanySlug } from '@/src/features/client/useClientData';
import { formatKg } from '@/src/shared/format';

function LoadChart({ values }: { values: number[] }) {
  const w = 300;
  const h = 110;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [10 + (i * (w - 20)) / (values.length - 1), max === min ? h / 2 : h - 14 - ((v - min) / (max - min)) * (h - 34)]);
  const last = pts[pts.length - 1];
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} accessibilityLabel={`Carga subiu de ${formatKg(values[0])} para ${formatKg(values[values.length - 1])} kg`}>
      <Line x1={0} y1={h - 6} x2={w} y2={h - 6} stroke={colors.border} strokeWidth={1.5} />
      <Polyline points={pts.map((p) => p.join(',')).join(' ')} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={5.5} fill={colors.primary} stroke="#fff" strokeWidth={2.5} />
      <SvgText x={pts[0][0]} y={pts[0][1] - 10} fontSize={11} fill={colors.textMuted}>{`${formatKg(values[0])} kg`}</SvgText>
      <SvgText x={last[0] - 38} y={last[1] - 12} fontSize={11} fontWeight="bold" fill={colors.primary}>{`${formatKg(values[values.length - 1])} kg`}</SvgText>
    </Svg>
  );
}

export default function ExerciseDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, treino } = useLocalSearchParams<{ id: string; treino?: string }>();
  const { data: fetched, isLoading } = useWorkout(treino);
  const workout = fetched ?? undefined;
  const LOAD_HISTORY = useLoadHistory();
  const row = workout ? flattenWorkout(workout).find((r) => r.exerciseId === id) : undefined;
  const snap = row?.snapshot ?? workout?.exercise_snapshots.find((s) => s.id === id);
  const slug = useActiveCompanySlug();
  const send = useSendChat(slug);
  const [requested, setRequested] = useState(false);
  const [opening, setOpening] = useState(false);

  if (!snap && isLoading) return <Screen><Loading label="Carregando o exercício" /></Screen>;
  if (!snap) return <Screen><EmptyState icon="barbell-outline" title="Exercício não encontrado" actionLabel="Voltar" onAction={() => router.back()} /></Screen>;

  const hist = LOAD_HISTORY[snap.id];
  const steps = snap.instructions?.split('\n').filter(Boolean) ?? [];
  const hasVideo = snap.media.length > 0;

  // O arquivo é privado: pede o endereço assinado na hora e abre no player do celular (vídeo) ou no visualizador (foto, GIF).
  async function play() {
    const m = snap!.media[0];
    setOpening(true);
    try {
      const url = await fetchMediaUrl(m.media_file_id);
      if (!url) {
        void showDialog({ title: 'Vídeo indisponível', message: 'No modo demonstração os vídeos do professor não ficam disponíveis.', tone: 'info', icon: 'videocam-off-outline' });
        return;
      }
      if (m.kind === 'video') await WebBrowser.openBrowserAsync(url);
      else openViewer({ kind: 'image', uri: url, title: m.name });
    } catch {
      void showDialog({ title: 'Não deu para abrir o vídeo', message: 'Confira a internet e tente de novo.', tone: 'warn', icon: 'cloud-offline-outline' });
    } finally {
      setOpening(false);
    }
  }

  return (
    <Screen backdrop="none">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={styles.media}>
          <LinearGradient colors={['#a9c2ff', '#4c74e8', '#1e4ed8']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={320} opacity={0.35} style={{ right: -120, top: -120 }} />
          <View style={[styles.mediaTop, { paddingTop: insets.top + 12 }]}>
            <IconButton icon="chevron-back" tone="glass" accessibilityLabel="Voltar" onPress={() => router.back()} />
            {hasVideo ? (
              <View style={styles.mediaBadge}>
                <Text style={styles.mediaBadgeText}>Vídeo do seu personal</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.playWrap}>
            {hasVideo ? (
              <PressableScale onPress={() => void play()} disabled={opening} accessibilityRole="button" accessibilityLabel={`Reproduzir ${snap.media[0].name}`} style={styles.play}>
                {opening ? <ActivityIndicator color={colors.text} /> : <Ionicons name={snap.media[0].kind === 'video' ? 'play' : 'image-outline'} size={26} color={colors.text} style={snap.media[0].kind === 'video' ? { marginLeft: 3 } : undefined} />}
              </PressableScale>
            ) : (
              <View style={styles.play} accessible accessibilityLabel="Sem vídeo para este exercício">
                <Ionicons name="image-outline" size={26} color={colors.text} />
              </View>
            )}
          </View>
          {hasVideo ? (
            <View style={styles.mediaFoot}>
              <Ionicons name={snap.media[0].kind === 'video' ? 'videocam' : 'image'} size={16} color="#fff" />
              <Text style={styles.mediaFootText} numberOfLines={1}>{`${snap.media.length > 1 ? `${snap.media.length} arquivos do professor` : 'Arquivo do professor'} · toque para abrir`}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Rise>
            <Text style={styles.title}>{snap.name}</Text>
          </Rise>
          <Rise index={1} style={styles.chips}>
            {[snap.muscle_group, snap.equipment, snap.secondary_muscles?.length ? 'Unilateral' : null].filter(Boolean).map((c) => (
              <Chip key={String(c)} label={String(c)} />
            ))}
          </Rise>

          {row ? (
            <Rise index={2} style={styles.facts}>
              <StatStrip
                items={[
                  { value: `${row.sets.length} × ${row.reps}`, label: 'séries' },
                  { value: row.tag === 'Drop set' ? row.loadLabel : `${formatKg(row.kg)} kg`, label: 'carga' },
                  { value: `${row.restSeconds} s`, label: 'descanso' },
                ]}
              />
            </Rise>
          ) : null}

          {steps.length ? (
            <Rise index={3} style={{ marginTop: 12 }}>
              <Card>
                <Text style={styles.cardTitle}>Como executar</Text>
                {steps.map((s, i) => (
                  <View key={i} style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Body style={{ flex: 1, fontSize: 14, lineHeight: 21 }}>{s}</Body>
                  </View>
                ))}
                {snap.tips ? (
                  <View style={styles.tip}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.warnText} />
                    <Body style={{ flex: 1, fontSize: 13.5, color: colors.warnText, lineHeight: 19 }}>{snap.tips}</Body>
                  </View>
                ) : null}
              </Card>
            </Rise>
          ) : null}

          {hist ? (
            <Rise index={4} style={{ marginTop: 12 }}>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Sua carga neste exercício</Text>
                  <Text style={styles.delta}>{`+${formatKg(hist[hist.length - 1] - hist[0])} kg em ${hist.length} semanas`}</Text>
                </View>
                <View style={{ marginTop: 12 }}>
                  <LoadChart values={hist} />
                </View>
              </Card>
            </Rise>
          ) : null}

          <Rise index={5} style={{ marginTop: 12 }}>
            <Card>
              <Text style={styles.cardTitle}>Músculos trabalhados</Text>
              <View style={styles.muscles}>
                <Badge label={`${snap.muscle_group} · principal`} tone="solid" />
                {snap.secondary_muscles?.map((m) => <Badge key={m} label={m} tone="primary" />)}
              </View>
            </Card>
          </Rise>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {requested ? (
          <View style={styles.requested} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
            <Text style={styles.requestedText}>Pedido de troca enviado. A resposta chega no chat.</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label={requested ? 'Troca pedida' : 'Pedir troca'}
            variant={requested ? 'soft' : 'secondary'}
            disabled={requested}
            loading={send.isPending}
            style={{ flex: 1 }}
            onPress={async () => {
              await send.mutateAsync({ text: `Pedido de troca de exercício: ${snap.name} (${workout?.title}). Pode me sugerir outro?` });
              setRequested(true);
            }}
          />
          <Button label="Tirar dúvida" icon="chatbubble-outline" style={{ flex: 1 }} onPress={() => router.push(`/cliente/chat/${slug}`)} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  media: { height: 300, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', ...shadows.hero },
  mediaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  mediaBadge: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center' },
  mediaBadgeText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 12.5 },
  playWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: 'rgba(255,255,255,0.25)' },
  mediaFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 18 },
  mediaFootText: { color: '#eef3ff', fontFamily: typography.fontFamily, fontSize: 13 },
  title: { marginTop: 20, ...text.display, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  facts: { marginTop: 16 },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  step: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.primaryDeep },
  tip: { flexDirection: 'row', gap: 10, marginTop: 16, padding: 14, borderRadius: radii.md + 4, backgroundColor: colors.warnSoft },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  delta: { fontFamily: typography.fontFamilyBold, fontSize: 12.5, color: colors.primary },
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, gap: 10, backgroundColor: 'rgba(244,247,252,0.94)' },
  requested: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radii.md + 4, backgroundColor: colors.successSoft },
  requestedText: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.success },
});
