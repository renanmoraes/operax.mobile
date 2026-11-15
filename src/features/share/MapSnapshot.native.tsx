import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/src/design-system/tokens';
import { Maps } from '@/src/features/fitness/RouteMap.native';
import type { MapSnapshotProps } from './MapSnapshot';

const TIMEOUT_MS = 10_000;

/**
 * Mapa real enquadrado na rota, coberto pela tela (precisa estar montado e visível para carregar), e a captura
 * nativa dele com o traçado. Sem mapa no aparelho ou sem carregar a tempo, responde `null` e o modelo usa o desenho.
 */
export function MapSnapshot(props: MapSnapshotProps) {
  if (!Maps) return <NoMap {...props} />;
  return <NativeSnapshot {...props} />;
}

function NoMap({ onResult }: MapSnapshotProps) {
  useEffect(() => onResult(null), [onResult]);
  return null;
}

function NativeSnapshot({ route, onResult, bottomShare = 0.42 }: MapSnapshotProps) {
  const { default: MapView, Polyline, Marker } = Maps!;
  const ref = useRef<InstanceType<typeof MapView>>(null);
  const done = useRef(false);
  const [h, setH] = useState(0);
  const coords = useMemo(() => route.map(([latitude, longitude]) => ({ latitude, longitude })), [route]);

  const finish = (uri: string | null) => {
    if (done.current) return;
    done.current = true;
    onResult(uri);
  };

  useEffect(() => {
    const id = setTimeout(() => finish(null), TIMEOUT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = coords[0];
  const end = coords[coords.length - 1];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h ? (
        <MapView
          ref={ref}
          style={StyleSheet.absoluteFill}
          initialRegion={start ? { latitude: start.latitude, longitude: start.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 } : undefined}
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          onMapReady={() =>
            ref.current?.fitToCoordinates(coords, { edgePadding: { top: h * 0.12, right: 48, bottom: h * bottomShare, left: 48 }, animated: false })
          }
          onMapLoaded={() => {
            // Um respiro para as linhas e os marcadores entrarem no quadro antes da captura.
            setTimeout(() => {
              ref.current
                ?.takeSnapshot({ format: 'png', quality: 1, result: 'file' })
                .then((uri) => finish(uri))
                .catch(() => finish(null));
            }, 700);
          }}
        >
          <Polyline coordinates={coords} strokeColor="#ffffff" strokeWidth={10} lineCap="round" lineJoin="round" />
          <Polyline coordinates={coords} strokeColor={colors.primary} strokeWidth={6} lineCap="round" lineJoin="round" />
          {start ? (
            <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.dot, { borderColor: colors.success, backgroundColor: '#fff' }]} />
            </Marker>
          ) : null}
          {end && coords.length > 1 ? (
            <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.dot, { borderColor: '#fff', backgroundColor: colors.chromeNavy }]} />
            </Marker>
          ) : null}
        </MapView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
});
