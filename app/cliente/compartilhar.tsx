import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { showDialog } from '@/src/design-system/Dialog';
import { IconName } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { reportError, trackAction } from '@/src/shared/telemetry/errorReporter';
import { isCancel, sendTo, type CanvasRef, type Destination } from '@/src/features/share/destinations';
import { MapSnapshot } from '@/src/features/share/MapSnapshot';
import { getShareActivity } from '@/src/features/share/store';
import { templatesFor } from '@/src/features/share/templates';
import { CANVAS, type ShareTemplate } from '@/src/features/share/types';

const DESTS: { key: Destination; icon: IconName }[] = [
  { key: 'story', icon: 'logo-instagram' },
  { key: 'whatsapp', icon: 'logo-whatsapp' },
  { key: 'copy', icon: 'copy-outline' },
  { key: 'save', icon: 'download-outline' },
  { key: 'more', icon: 'ellipsis-horizontal' },
];

const GAP = 12;

/** Espera a imagem de fundo do modelo carregar (até 4 s) e mais dois quadros para o layout chegar à tela nativa. */
async function waitReady(isReady: () => boolean) {
  const until = Date.now() + 4000;
  while (!isReady() && Date.now() < until) await new Promise((r) => setTimeout(r, 80));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}
const SIDE = 16;

function Checker({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="checker" width={20} height={20} patternUnits="userSpaceOnUse">
          <Rect width={20} height={20} fill="#1b2333" />
          <Rect width={10} height={10} fill="#262f42" />
          <Rect x={10} y={10} width={10} height={10} fill="#262f42" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#checker)" />
    </Svg>
  );
}

/** O modelo em 1080×1920, reduzido para caber na caixa e centralizado. */
function Scaled({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  const s = w / CANVAS.w;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: CANVAS.w, height: CANVAS.h, left: (w - CANVAS.w) / 2, top: (h - CANVAS.h) / 2, transform: [{ scale: s }] }}>{children}</View>
    </View>
  );
}

export default function ShareActivityScreen() {
  const { t } = useTranslation(['fitness', 'common']);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const activity = useMemo(() => getShareActivity(), []);
  const templates = useMemo(() => (activity ? templatesFor(activity) : []), [activity]);
  const [selected, setSelected] = useState<string | null>(() => templates[0]?.id ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mapUri, setMapUri] = useState<string | null>(null);
  const [mapDone, setMapDone] = useState(false);
  const [busy, setBusy] = useState<Destination | null>(null);
  const canvasRef = useRef<View>(null) as CanvasRef;
  const ready = useRef<{ key: string; ok: boolean }>({ key: '', ok: false });

  const tileW = Math.floor((width - SIDE * 2 - GAP) / 2);
  const tileH = Math.round((tileW * CANVAS.h) / CANVAS.w);
  const current = templates.find((x) => x.id === selected) ?? null;
  const needsImage = !!current && ((current.needsPhoto && !!photoUri) || (current.usesMap && !!mapUri));
  const readyKey = `${selected}|${photoUri}|${mapUri}`;
  useEffect(() => {
    ready.current = { key: readyKey, ok: !needsImage };
  }, [readyKey, needsImage]);

  const onMap = useCallback((uri: string | null) => {
    setMapUri(uri);
    setMapDone(true);
  }, []);

  async function pickPhoto(): Promise<boolean> {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return false;
    setPhotoUri(r.assets[0].uri);
    return true;
  }

  async function choose(tpl: ShareTemplate) {
    if (tpl.needsPhoto && !photoUri && !(await pickPhoto())) return;
    setSelected(tpl.id);
  }

  async function send(dest: Destination) {
    if (!current || busy) return;
    setBusy(dest);
    trackAction('share', { dest, template: current.id });
    try {
      await waitReady(() => ready.current.key === readyKey && ready.current.ok);
      await sendTo(dest, canvasRef, current.transparent);
    } catch (e) {
      if (!isCancel(e)) {
        void reportError(e, { context: 'share', extra: { dest, template: current.id } });
        void showDialog({ title: t('share.failTitle'), message: t('share.failBody'), tone: 'warn' });
      }
    } finally {
      setBusy(null);
    }
  }

  if (!activity || !current) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>{t('share.empty')}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>{t('common:actions.close')}</Text>
        </Pressable>
      </View>
    );
  }

  const Selected = current.Render;
  const route = activity.gps?.route ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.chromeNavy }}>
      <Stack.Screen options={{ animation: 'slide_from_bottom' }} />
      <StatusBar style="light" />
      {/* Atrás da tela (coberto por ela): o mapa que vira foto e o modelo em tamanho real que vira a imagem. */}
      {route.length > 1 && !mapDone ? <MapSnapshot route={route} onResult={onMap} /> : null}
      <View ref={canvasRef} collapsable={false} style={styles.canvasLayer} pointerEvents="none">
        <Selected activity={activity} photoUri={photoUri} mapUri={mapUri} onReady={() => (ready.current = { key: readyKey, ok: true })} />
      </View>

      <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common:actions.close')} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title}>{t('share.title')}</Text>
          {current.needsPhoto ? (
            <Pressable onPress={() => void pickPhoto()} accessibilityRole="button" accessibilityLabel={t('share.changePhoto')} hitSlop={10} style={styles.headerBtn}>
              <Ionicons name="image-outline" size={22} color="#fff" />
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {templates.map((tpl) => {
            const on = tpl.id === selected;
            const R = tpl.Render;
            const name = t(`share.templates.${tpl.labelKey}` as 'share.templates.route');
            return (
              <View key={tpl.id} style={{ width: tileW }}>
                <Pressable
                  onPress={() => void choose(tpl)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${t('share.templateA11y', { name })}${tpl.transparent ? `, ${t('share.transparent')}` : ''}`}
                  style={[styles.tile, { width: tileW, height: tileH }, on && styles.tileOn]}
                >
                  {tpl.transparent ? <Checker w={tileW} h={tileH} /> : null}
                  {tpl.needsPhoto && !photoUri ? (
                    <View style={[styles.center, { flex: 1, gap: 8 }]}>
                      <Ionicons name="camera-outline" size={28} color="#9fb3d9" />
                      <Text style={styles.photoHint}>{t('share.pickPhoto')}</Text>
                    </View>
                  ) : (
                    <Scaled w={tileW} h={tileH}>
                      <R activity={activity} photoUri={photoUri} mapUri={mapUri} />
                    </Scaled>
                  )}
                </Pressable>
                <Text style={[styles.tileLabel, on && { color: '#fff' }]}>{name}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
          {DESTS.map((d) => (
            <Pressable key={d.key} onPress={() => void send(d.key)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={t(`share.dest.${d.key}`)} style={styles.dest}>
              <View style={[styles.destIcon, d.key === 'story' && styles.destPrimary]}>
                {busy === d.key ? <ActivityIndicator color="#fff" /> : <Ionicons name={d.icon} size={22} color="#fff" />}
              </View>
              <Text style={styles.destLabel}>{t(`share.dest.${d.key}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.chromeNavy },
  center: { alignItems: 'center', justifyContent: 'center' },
  canvasLayer: { position: 'absolute', top: 0, left: 0, width: CANVAS.w, height: CANVAS.h },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 48 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 24 },
  tile: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#111a2b', borderWidth: 2, borderColor: 'transparent' },
  tileOn: { borderColor: colors.cyan },
  tileLabel: { marginTop: 6, marginBottom: 4, textAlign: 'center', color: '#8a9bbd', fontFamily: typography.fontFamilySemiBold, fontSize: 12.5 },
  photoHint: { color: '#9fb3d9', fontFamily: typography.fontFamilySemiBold, fontSize: 13 },
  dock: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#22304a', backgroundColor: '#0a1222' },
  dest: { alignItems: 'center', gap: 6, minWidth: 60 },
  destIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1a2740', alignItems: 'center', justifyContent: 'center' },
  destPrimary: { backgroundColor: colors.primary },
  destLabel: { color: '#c5d2ea', fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  empty: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 16 },
  emptyBtn: { marginTop: 16, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center' },
  emptyBtnText: { color: '#fff', fontFamily: typography.fontFamilySemiBold, fontSize: 14 },
});
