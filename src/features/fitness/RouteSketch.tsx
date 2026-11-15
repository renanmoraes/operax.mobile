import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/src/design-system/tokens';
import { pathOf, projectRoute } from './routeProjection';

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
    const pad = 28;
    const xy = projectRoute(all, box.w, box.h, { side: pad, top: (inset?.top ?? 0) + pad, bottom: (inset?.bottom ?? 0) + pad });
    return { line: xy.slice(0, route.length), here: here ? xy[xy.length - 1] : null };
  }, [route, here, box, inset?.top, inset?.bottom]);

  const d = pts ? pathOf(pts.line) : '';
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
