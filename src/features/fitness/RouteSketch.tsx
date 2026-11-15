import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/src/design-system/tokens';

export type LatLng = { lat: number; lng: number };
export type RouteMapProps = {
  /** Caminho em [latitude, longitude]. */
  route: [number, number][];
  /** Onde a pessoa está agora (gravação). */
  here?: LatLng | null;
  /** Gravando: o mapa acompanha a posição. Parado: enquadra o caminho inteiro. */
  follow?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Espaço coberto por botões em cima e pela folha embaixo: o caminho fica na parte visível. */
  inset?: { top?: number; bottom?: number };
};

/**
 * O caminho desenhado sem mapa por baixo: a forma do percurso numa grade, com largada e chegada.
 * Vale no navegador e no app sem chave do Google Maps; o desenho é o mesmo em qualquer aparelho.
 */
export function RouteSketch({ route, here, style, inset }: RouteMapProps) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const pts = useMemo(() => {
    const all = here ? [...route, [here.lat, here.lng] as [number, number]] : route;
    if (!box.w || !box.h || all.length === 0) return null;
    // Projeção plana: a longitude encolhe com o cosseno da latitude, senão o percurso sai esticado.
    const lat0 = all.reduce((a, p) => a + p[0], 0) / all.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = all.map((p) => p[1] * k);
    const ys = all.map((p) => -p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 28;
    const top = (inset?.top ?? 0) + pad;
    const bottom = (inset?.bottom ?? 0) + pad;
    // Trecho curto (ou só a posição atual): enquadra ao menos ~150 m, centrado, para não virar um ponto no canto.
    const MIN_SPAN = 0.0014;
    const spanX = Math.max(maxX - minX, MIN_SPAN);
    const spanY = Math.max(maxY - minY, MIN_SPAN);
    const scale = Math.min((box.w - pad * 2) / spanX, Math.max(40, box.h - top - bottom) / spanY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const midY = top + (box.h - top - bottom) / 2;
    const xy = all.map((_, i) => ({ x: box.w / 2 + (xs[i] - cx) * scale, y: midY + (ys[i] - cy) * scale }));
    return { line: xy.slice(0, route.length), here: here ? xy[xy.length - 1] : null };
  }, [route, here, box, inset?.top, inset?.bottom]);

  const d = pts?.line.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') ?? '';
  const start = pts?.line[0];
  const end = pts && pts.line.length > 1 ? pts.line[pts.line.length - 1] : null;
  const grid = 26;

  return (
    <View style={[styles.wrap, style]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id="route" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.cyan} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          {Array.from({ length: Math.ceil(box.w / grid) }, (_, i) => (
            <Line key={`v${i}`} x1={i * grid} y1={0} x2={i * grid} y2={box.h} stroke="#dfe7f5" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.ceil(box.h / grid) }, (_, i) => (
            <Line key={`h${i}`} x1={0} y1={i * grid} x2={box.w} y2={i * grid} stroke="#dfe7f5" strokeWidth={1} />
          ))}
          {d ? <Path d={d} stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
          {d ? <Path d={d} stroke="url(#route)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
          {start ? <Circle cx={start.x} cy={start.y} r={6} fill="#ffffff" stroke={colors.success} strokeWidth={3} /> : null}
          {end && !pts?.here ? <Circle cx={end.x} cy={end.y} r={6} fill={colors.chromeNavy} stroke="#ffffff" strokeWidth={2.5} /> : null}
          {pts?.here ? (
            <>
              <Circle cx={pts.here.x} cy={pts.here.y} r={16} fill={colors.primary} opacity={0.16} />
              <Circle cx={pts.here.x} cy={pts.here.y} r={7.5} fill={colors.primary} stroke="#ffffff" strokeWidth={3} />
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#eef3fb', overflow: 'hidden' },
});
